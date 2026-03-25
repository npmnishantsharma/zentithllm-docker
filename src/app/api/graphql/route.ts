import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import {
  buildSchema,
  graphql,
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { getKey, setKey } from '@/lib/keyv';
import { decryptApiPayload, encryptApiPayload, type EncryptedApiPayload } from '@/lib/api-encryption';

export const dynamic = 'force-dynamic';

const sharedTypesSDL = `
  type UserTag {
    name: String
    color: String
    emoji: String
  }

  type ProfileData {
    uid: String
    userId: String
    displayName: String
    email: String
    photoURL: String
    username: String
    role: String
    userTag: UserTag
  }

  type ProfileResponse {
    success: Boolean!
    data: ProfileData
    error: String
    message: String
  }

  type MfaStatusResponse {
    success: Boolean!
    mfaEnabled: Boolean
    mfaEnabledAt: String
    backupCodesAvailable: Int
    error: String
    message: String
  }

  type MfaSetupResponse {
    success: Boolean!
    secret: String
    otpauthUrl: String
    message: String
    error: String
  }

  type MfaVerifyResponse {
    success: Boolean!
    message: String
    backupCodes: [String!]
    error: String
  }

  type SimpleResponse {
    success: Boolean!
    message: String
    error: String
  }

  type Passkey {
    id: String!
    deviceName: String
    createdAt: String
    transports: [String!]
  }

  type PasskeyListResponse {
    success: Boolean!
    passkeys: [Passkey!]
    error: String
    message: String
  }

  type PasskeyOptionsResponse {
    success: Boolean!
    challengeId: String
    optionsJSON: String
    error: String
    message: String
  }

  type PasskeyVerifyResponse {
    success: Boolean!
    message: String
    error: String
    user: ProfileData
  }
`;

// Subgraph: account/profile domain
const accountSubgraphSDL = `
  type Query {
    profile: ProfileResponse!
    _service: Service!
  }

  type Service {
    sdl: String!
  }
`;

// Subgraph: auth/security domain
const securitySubgraphSDL = `
  extend type Query {
    mfaStatus: MfaStatusResponse!
    passkeyList: PasskeyListResponse!
  }

  type Mutation {
    mfaSetup: MfaSetupResponse!
    mfaVerify(code: String!): MfaVerifyResponse!
    mfaDisable: SimpleResponse!

    passkeyRegisterOptions: PasskeyOptionsResponse!
    passkeyRegisterVerify(credentialJSON: String!, deviceName: String!): SimpleResponse!
    passkeyDelete(id: String!): SimpleResponse!

    passkeyAuthenticateOptions(token: String): PasskeyOptionsResponse!
    passkeyAuthenticateVerify(credentialJSON: String!, challengeId: String!, token: String): PasskeyVerifyResponse!

    verifyMfaLogin(token: String!, code: String!): SimpleResponse!
  }
`;

// Schema stitching/federation-ready composition by modular SDL segments.
const stitchedSchemaSDL = [sharedTypesSDL, accountSubgraphSDL, securitySubgraphSDL].join('\n');
const schema = buildSchema(stitchedSchemaSDL);

const PERSISTED_DOC_PREFIX = 'graphql:persisted:doc:';
const RESPONSE_CACHE_PREFIX = 'graphql:response:';
const PERSISTED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseCookies(raw: string | null): Record<string, string> {
  if (!raw) return {};
  return raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const idx = pair.indexOf('=');
      if (idx === -1) return acc;
      const key = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

async function resolveSource(body: any): Promise<{ source?: string; docId?: string; error?: string }> {
  const sourceFromBody = typeof body?.query === 'string' ? body.query.trim() : '';
  const docId = typeof body?.doc_id === 'string' ? body.doc_id.trim() : '';
  const requirePersisted = process.env.GRAPHQL_REQUIRE_PERSISTED === 'true';

  if (!sourceFromBody && !docId) {
    return { error: 'Missing GraphQL query or doc_id' };
  }

  if (sourceFromBody) {
    const hash = sha256Hex(sourceFromBody);

    if (docId && docId !== hash) {
      return { error: 'doc_id does not match query hash' };
    }

    const effectiveDocId = docId || hash;
    await setKey(`${PERSISTED_DOC_PREFIX}${effectiveDocId}`, sourceFromBody, PERSISTED_TTL_MS);
    return { source: sourceFromBody, docId: effectiveDocId };
  }

  if (!docId) {
    return { error: 'doc_id is required for persisted query lookup' };
  }

  const persistedSource = await getKey<string>(`${PERSISTED_DOC_PREFIX}${docId}`);
  if (!persistedSource) {
    return { error: 'Unknown persisted query doc_id' };
  }

  if (requirePersisted || persistedSource) {
    return { source: persistedSource, docId };
  }

  return { error: 'Persisted query resolution failed' };
}

function findOperationType(document: DocumentNode, operationName?: string): 'query' | 'mutation' | 'subscription' | null {
  const definitions = document.definitions.filter((d: any) => d.kind === 'OperationDefinition') as any[];
  if (!definitions.length) return null;

  if (!operationName) {
    return definitions[0].operation;
  }

  const found = definitions.find((d) => d.name?.value === operationName);
  return found?.operation || null;
}

function estimateSelectionSetCost(
  selectionSet: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
  depth: number
): number {
  let cost = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      const base = 1 + depth;
      cost += base;

      if (selection.selectionSet) {
        cost += estimateSelectionSetCost(selection.selectionSet, fragments, depth + 1);
      }
    } else if (selection.kind === 'InlineFragment') {
      cost += estimateSelectionSetCost(selection.selectionSet, fragments, depth + 1);
    } else if (selection.kind === 'FragmentSpread') {
      const frag = fragments[selection.name.value];
      if (frag) {
        cost += estimateSelectionSetCost(frag.selectionSet, fragments, depth + 1);
      }
    }
  }

  return cost;
}

function estimateDocumentCost(document: DocumentNode, operationName?: string): number {
  const fragments: Record<string, FragmentDefinitionNode> = {};
  for (const def of document.definitions) {
    if (def.kind === 'FragmentDefinition') {
      fragments[def.name.value] = def;
    }
  }

  const operationDefs = document.definitions.filter((d: any) => d.kind === 'OperationDefinition') as any[];
  const op = operationName
    ? operationDefs.find((d) => d.name?.value === operationName)
    : operationDefs[0];

  if (!op) return 0;
  return estimateSelectionSetCost(op.selectionSet, fragments, 1);
}

function parseJsonSafe(value?: string | null): any {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function buildRoot(request: NextRequest, responseSetCookies: string[]) {
  const proxyApi = async (path: string, init?: { method?: 'GET' | 'POST'; body?: any }) => {
    const url = new URL(path, request.url);
    const method = init?.method || 'GET';

    const response = await fetch(url, {
      method,
      headers: {
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...(request.headers.get('cookie') ? { cookie: request.headers.get('cookie') as string } : {}),
      },
      body: method === 'POST' ? JSON.stringify(init?.body ?? {}) : undefined,
      cache: 'no-store',
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      responseSetCookies.push(setCookie);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || `Request failed with status ${response.status}`,
        message: data?.message,
      };
    }

    return data;
  };

  return {
    _service: async () => ({
      sdl: stitchedSchemaSDL,
    }),

    profile: async () => proxyApi('/api/profile'),
    mfaStatus: async () => proxyApi('/api/mfa/status'),
    passkeyList: async () => proxyApi('/api/passkey/list'),

    mfaSetup: async () => proxyApi('/api/mfa/setup', { method: 'POST' }),
    mfaVerify: async ({ code }: { code: string }) => proxyApi('/api/mfa/verify', { method: 'POST', body: { code } }),
    mfaDisable: async () => proxyApi('/api/mfa/status', { method: 'POST', body: { action: 'disable' } }),

    passkeyRegisterOptions: async () => {
      const data = await proxyApi('/api/passkey/register-options', { method: 'POST' });
      return {
        ...data,
        optionsJSON: data?.options ? JSON.stringify(data.options) : null,
      };
    },
    passkeyRegisterVerify: async ({ credentialJSON, deviceName }: { credentialJSON: string; deviceName: string }) => {
      const credential = parseJsonSafe(credentialJSON);
      return proxyApi('/api/passkey/register-verify', {
        method: 'POST',
        body: { credential, deviceName },
      });
    },
    passkeyDelete: async ({ id }: { id: string }) => proxyApi('/api/passkey/delete', { method: 'POST', body: { id } }),

    passkeyAuthenticateOptions: async ({ token }: { token?: string }) => {
      const data = await proxyApi('/api/passkey/authenticate-options', {
        method: 'POST',
        body: token ? { token } : {},
      });
      return {
        ...data,
        optionsJSON: data?.options ? JSON.stringify(data.options) : null,
      };
    },
    passkeyAuthenticateVerify: async ({
      credentialJSON,
      challengeId,
      token,
    }: {
      credentialJSON: string;
      challengeId: string;
      token?: string;
    }) => {
      const credential = parseJsonSafe(credentialJSON);
      return proxyApi('/api/passkey/authenticate-verify', {
        method: 'POST',
        body: {
          credential,
          challengeId,
          ...(token ? { token } : {}),
        },
      });
    },

    verifyMfaLogin: async ({ token, code }: { token: string; code: string }) =>
      proxyApi('/api/auth/verify-mfa-login', {
        method: 'POST',
        body: { token, code },
      }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const serverEncKey = process.env.GRAPHQL_SERVER_ENC_KEY;
    const responseSetCookies: string[] = [];

    const toGraphqlResponse = (payload: any, status: number, headers?: Record<string, string>) => {
      const body = serverEncKey ? encryptApiPayload(payload, serverEncKey) : payload;
      const response = NextResponse.json(body, { status, headers });
      for (const cookie of responseSetCookies) {
        response.headers.append('set-cookie', cookie);
      }
      return response;
    };

    const body = await request.json().catch(() => ({}));
    const sourceResolution = await resolveSource(body);
    if (!sourceResolution.source) {
      return toGraphqlResponse(
        { errors: [{ message: sourceResolution.error || 'Unable to resolve GraphQL source' }] },
        400
      );
    }

    const source = sourceResolution.source;
    const docId = sourceResolution.docId || sha256Hex(source);
    const variableValues = body?.variables as Record<string, any> | undefined;
    const operationName = body?.operationName as string | undefined;

    const document = parse(source);
    const operationType = findOperationType(document, operationName);

    if (!operationType) {
      return toGraphqlResponse({ errors: [{ message: 'No operation found in GraphQL document' }] }, 400);
    }

    // Query cost limiting
    const maxCost = Number(process.env.GRAPHQL_MAX_COST || 180);
    const cost = estimateDocumentCost(document, operationName);
    if (cost > maxCost) {
      return toGraphqlResponse(
        {
          errors: [
            {
              message: `Query cost limit exceeded (${cost} > ${maxCost})`,
            },
          ],
        },
        400
      );
    }

    // Server-side caching (Redis via Keyv) for query operations
    const cacheEnabled = process.env.GRAPHQL_CACHE_ENABLED !== 'false';
    const cacheTtlMs = Number(process.env.GRAPHQL_CACHE_TTL_SECONDS || 20) * 1000;
    const cookieMap = parseCookies(request.headers.get('cookie'));
    const sessionScope = cookieMap.sessionId || 'anon';
    const variablesHash = sha256Hex(JSON.stringify(variableValues || {}));
    const responseCacheKey = `${RESPONSE_CACHE_PREFIX}${docId}:${operationName || 'default'}:${sessionScope}:${variablesHash}`;

    if (cacheEnabled && operationType === 'query') {
      const cached = await getKey<any>(responseCacheKey);
      if (cached) {
        let payload = cached;
        if (cached?.encrypted) {
          if (!serverEncKey) {
            payload = null;
          } else {
            try {
              payload = decryptApiPayload(cached as EncryptedApiPayload, serverEncKey);
            } catch {
              payload = null;
            }
          }
        }

        if (payload?.encrypted) {
          payload = null;
        }

        if (payload) {
          try {
            return toGraphqlResponse(payload, 200, {
              'X-GraphQL-Cache': 'HIT',
            });
          } catch {
            // fall through to recompute result
          }
        }
      }
    }

    const result = await graphql({
      schema,
      source,
      rootValue: buildRoot(request, responseSetCookies),
      variableValues,
      operationName,
    });

    if (cacheEnabled && operationType === 'query' && !result.errors?.length) {
      const cachePayload = serverEncKey ? encryptApiPayload(result, serverEncKey) : result;
      await setKey(responseCacheKey, cachePayload, cacheTtlMs);
    }

    const status = result.errors?.length ? 400 : 200;
    return toGraphqlResponse(result, status, {
      ...(operationType === 'query' ? { 'X-GraphQL-Cache': 'MISS' } : {}),
      'X-GraphQL-DocId': docId,
    });
  } catch (error: any) {
    const serverEncKey = process.env.GRAPHQL_SERVER_ENC_KEY;
    const payload = {
      errors: [{ message: error?.message || 'GraphQL server error' }],
    };

    if (serverEncKey) {
      return NextResponse.json(encryptApiPayload(payload, serverEncKey), { status: 500 });
    }

    return NextResponse.json(
      {
        errors: [{ message: error?.message || 'GraphQL server error' }],
      },
      { status: 500 }
    );
  }
}
