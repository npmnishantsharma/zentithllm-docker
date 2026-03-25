import {
  decryptApiPayloadClient,
  type EncryptedApiPayload,
} from '@/lib/api-encryption-client';

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

const PERSISTED_KEY = 'graphql:persisted:docids';

async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    // Fallback: deterministic non-cryptographic id for legacy environments.
    return `fallback_${encodeURIComponent(input).slice(0, 64)}`;
  }

  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getPersistedDocIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(PERSISTED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function markPersistedDocId(docId: string) {
  if (typeof window === 'undefined') return;
  try {
    const set = getPersistedDocIds();
    set.add(docId);
    window.sessionStorage.setItem(PERSISTED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage failures
  }
}

export async function graphqlRequest<TData>(query: string, variables?: Record<string, any>): Promise<TData> {
  const normalizedQuery = query.trim();
  const docId = await sha256Hex(normalizedQuery);
  const persisted = getPersistedDocIds().has(docId);

  const requestBody: Record<string, any> = {
    doc_id: docId,
    variables,
  };

  // First request sends full query text; later requests can be doc_id-only.
  if (!persisted) {
    requestBody.query = normalizedQuery;
  }

  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const raw = await response.json();

  let payload: GraphQLResponse<TData>;
  if (raw?.encrypted) {
    const key = process.env.NEXT_PUBLIC_GRAPHQL_SERVER_ENC_KEY;
    if (!key) {
      throw new Error('Missing NEXT_PUBLIC_GRAPHQL_SERVER_ENC_KEY for GraphQL response decryption');
    }
    payload = await decryptApiPayloadClient<GraphQLResponse<TData>>(raw as EncryptedApiPayload, key);
  } else {
    payload = raw as GraphQLResponse<TData>;
  }

  if (!response.ok) {
    const message = payload.errors?.[0]?.message || 'GraphQL request failed';
    throw new Error(message);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  if (!payload.data) {
    throw new Error('Empty GraphQL response data');
  }

  markPersistedDocId(docId);

  return payload.data;
}
