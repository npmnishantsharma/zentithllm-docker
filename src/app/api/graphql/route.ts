import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import {
  buildSchema,
  graphql,
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  type SelectionSetNode,
} from 'graphql';
import { getKey, setKey, deleteKey, getKeyvInstance } from '@/lib/keyv';
import { decryptApiPayload, encryptApiPayload, type EncryptedApiPayload } from '@/lib/api-encryption';
import { UserSecurityService } from '@/lib/database';
import { SessionUser } from '@/lib/session';
import { TOTP, Secret } from 'otpauth';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { createUserSession } from '@/app/login/actions';

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
  const getSessionId = () => {
    return request.cookies.get('sessionId')?.value || request.headers.get('X-Session-Id') || '';
  };

  const getSessionData = async () => {
    const sessionId = getSessionId();
    if (!sessionId) return null;
    return await getKey<any>(`session:${sessionId}`);
  };

  return {
    _service: async () => ({
      sdl: stitchedSchemaSDL,
    }),

    profile: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found or expired' };

      const safeProfile = {
        userId: userData.userId,
        uid: userData.uid ?? userData.userId,
        displayName: userData.displayName,
        email: userData.email,
        photoURL: userData.photoURL,
        profilePicture: userData.profilePicture,
        username: userData.username,
        role: userData.role,
        userTag: userData.userTag,
        sessionId,
      };

      return { success: true, data: safeProfile, profile: safeProfile };
    },

    mfaStatus: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found or expired' };

      const security = userData.userId ? await UserSecurityService.getSecurity(userData.userId) : null;
      const sessionMfaEnabled = userData.mfaEnabled || false;
      const sessionBackupCodes = (userData.mfaBackupCodes || []).filter((c: any) => !c.used).length;

      const effectiveMfaEnabled = security ? security.mfaEnabled : sessionMfaEnabled;
      const effectiveBackupCodesAvailable = security
        ? (security.mfaBackupCodes || []).filter((c: any) => !c.used).length
        : sessionBackupCodes;

      if (security && userData.mfaEnabled !== security.mfaEnabled) {
        await setKey(`session:${sessionId}`, {
          ...userData,
          mfaEnabled: security.mfaEnabled,
          mfaSecret: security.mfaSecret,
          mfaBackupCodes: security.mfaBackupCodes || [],
        }, 24 * 60 * 60 * 1000);
      }

      return {
        success: true,
        mfaEnabled: effectiveMfaEnabled,
        mfaEnabledAt: userData.mfaEnabledAt,
        backupCodesAvailable: effectiveBackupCodesAvailable,
      };
    },

    passkeyList: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found' };

      const sessionPasskeys = Array.isArray(userData.passkeys) ? userData.passkeys : [];
      const security = userData.userId ? await UserSecurityService.getSecurity(userData.userId) : null;
      const passkeys = security ? (security.passkeys || []) : sessionPasskeys;

      if (security && JSON.stringify(sessionPasskeys) !== JSON.stringify(passkeys)) {
        await setKey(`session:${sessionId}`, { ...userData, passkeys }, 24 * 60 * 60 * 1000);
      }

      return {
        success: true,
        passkeys: passkeys.map((p: any) => ({
          id: p.id,
          deviceName: p.deviceName,
          createdAt: p.createdAt,
          transports: p.transports,
        })),
      };
    },

    mfaSetup: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found or expired' };

      const totp = new TOTP({
        issuer: 'Zentith LLM',
        label: userData.email || userData.displayName || 'User',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      const otpauthUrl = totp.toString();
      const secret = totp.secret.base32;

      await setKey(`mfa:pending:${sessionId}`, {
        secret,
        otpInstance: otpauthUrl,
        createdAt: new Date().toISOString(),
      }, 10 * 60 * 1000);

      return {
        success: true,
        secret,
        otpauthUrl,
        message: 'MFA secret generated. Scan the QR code or enter the secret manually.',
      };
    },

    mfaVerify: async ({ code }: { code: string }) => {
      if (!code || code.trim().length !== 6 || !/^\d{6}$/.test(code)) {
        return { success: false, error: 'Verification code must be a 6-digit number' };
      }
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found or expired' };

      const pendingMfa = await getKey<any>(`mfa:pending:${sessionId}`);
      if (!pendingMfa) return { success: false, error: 'No pending MFA setup found. Please generate a new secret.' };

      const totp = new TOTP({
        issuer: 'Zentith LLM',
        label: userData.email || userData.displayName || 'User',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(pendingMfa.secret),
      });

      const isValid = totp.validate({ token: code, window: 1 }) !== null;
      if (!isValid) return { success: false, error: 'Invalid verification code. Please try again.' };

      const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase());
      const backupCodesMapped = backupCodes.map((code: string) => ({ code, used: false }));

      await setKey(`session:${sessionId}`, {
        ...userData,
        mfaEnabled: true,
        mfaSecret: pendingMfa.secret,
        mfaBackupCodes: backupCodesMapped,
        mfaEnabledAt: new Date().toISOString(),
      }, 24 * 60 * 60 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, {
          mfaEnabled: true,
          mfaSecret: pendingMfa.secret,
          mfaBackupCodes: backupCodesMapped
        });
      }
      await deleteKey(`mfa:pending:${sessionId}`);

      return { success: true, message: 'MFA has been successfully enabled', backupCodes };
    },

    mfaDisable: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'User is not logged in' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found or expired' };

      await setKey(`session:${sessionId}`, {
        ...userData,
        mfaEnabled: false,
        mfaSecret: undefined,
        mfaBackupCodes: undefined,
        mfaEnabledAt: undefined,
      }, 24 * 60 * 60 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, {
          mfaEnabled: false,
          mfaSecret: null as any,
          mfaBackupCodes: []
        });
      }
      return { success: true, message: 'MFA has been disabled' };
    },

    passkeyRegisterOptions: async () => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'Not authenticated' };
      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found' };

      const userEmail = userData.email || userData.displayName || "user";
      const userId = userData.userId || sessionId;

      const options = await generateRegistrationOptions({
        rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        rpName: "Zentith LLM",
        userID: isoUint8Array.fromUTF8String(userId),
        userName: userEmail,
        attestationType: "direct",
        authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      });

      const keyv = await getKeyvInstance();
      await keyv.set(`passkey:challenge:${sessionId}`, options, 600000);

      return { success: true, optionsJSON: JSON.stringify(options) };
    },

    passkeyRegisterVerify: async ({ credentialJSON, deviceName }: { credentialJSON: string; deviceName: string }) => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'Not authenticated' };
      const credential = parseJsonSafe(credentialJSON);

      const keyv = await getKeyvInstance();
      const storedChallenge = await keyv.get(`passkey:challenge:${sessionId}`);
      if (!storedChallenge) return { success: false, error: 'Challenge not found or expired' };

      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found' };

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: storedChallenge.challenge,
          expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "https://supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
          expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
          requireUserVerification: false,
        });
      } catch (error) {
        return { success: false, error: 'Credential verification failed' };
      }

      if (!verification.verified) return { success: false, error: 'Credential could not be verified' };

      const passkeys = userData.passkeys || [];
      const credentialPublicKey = verification.registrationInfo?.credential.publicKey;
      const newPasskey = {
        id: credential.id,
        credentialID: credential.id,
        credentialPublicKey: credentialPublicKey ? Buffer.from(credentialPublicKey).toString("base64") : "",
        counter: verification.registrationInfo?.credential.counter || 0,
        transports: credential.response.transports,
        deviceName: deviceName || "Passkey",
        createdAt: new Date().toISOString(),
      };

      passkeys.push(newPasskey);
      userData.passkeys = passkeys;
      await setKey(`session:${sessionId}`, userData, 86400 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, { passkeys: userData.passkeys });
      }

      await keyv.set(`passkey:credentialId:${credential.id}`, sessionId, 86400 * 1000);
      await keyv.delete(`passkey:challenge:${sessionId}`);

      return { success: true, message: 'Passkey registered successfully' };
    },

    passkeyDelete: async ({ id }: { id: string }) => {
      const sessionId = getSessionId();
      if (!sessionId) return { success: false, error: 'Not authenticated' };
      if (!id) return { success: false, error: 'Passkey ID required' };

      const userData = await getSessionData();
      if (!userData) return { success: false, error: 'Session not found' };

      const passkeys = userData.passkeys || [];
      const passkeyToDelete = passkeys.find((p: any) => p.id === id);
      userData.passkeys = passkeys.filter((p: any) => p.id !== id);
      await setKey(`session:${sessionId}`, userData, 86400 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, { passkeys: userData.passkeys });
      }
      if (passkeyToDelete?.credentialID) {
        const keyv = await getKeyvInstance();
        await keyv.delete(`passkey:credentialId:${passkeyToDelete.credentialID}`);
      }
      return { success: true, message: 'Passkey deleted successfully' };
    },

    passkeyAuthenticateOptions: async ({ token }: { token?: string }) => {
      let allowCredentials: any[] | undefined;
      if (token) {
        const tempSession = await getKey<any>(`temp_login:${token}`);
        if (!tempSession) return { success: false, error: 'Login verification token expired or invalid' };
        const passkeys = (tempSession.passkeys || []) as any[];
        if (!passkeys.length) return { success: false, error: 'No registered passkeys found for this account' };
        allowCredentials = passkeys.filter((pk) => pk?.credentialID).map((pk) => ({ id: pk.credentialID, transports: pk.transports }));
      }

      const options = await generateAuthenticationOptions({
        rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        userVerification: "preferred",
        allowCredentials,
      });

      const keyv = await getKeyvInstance();
      const challengeId = Math.random().toString(36).substring(7);
      await keyv.set(`passkey:auth:challenge:${challengeId}`, options, 600000);
      return { success: true, challengeId, optionsJSON: JSON.stringify(options) };
    },

    passkeyAuthenticateVerify: async ({ credentialJSON, challengeId, token }: { credentialJSON: string; challengeId: string; token?: string }) => {
      const credential = parseJsonSafe(credentialJSON);
      if (!credential?.id) return { success: false, error: 'Invalid credential' };

      const keyv = await getKeyvInstance();
      const storedChallenge = await keyv.get(`passkey:auth:challenge:${challengeId}`);
      if (!storedChallenge) return { success: false, error: 'Challenge not found or expired' };

      if (token) {
        const tempSession = await getKey<any>(`temp_login:${token}`);
        if (!tempSession) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: 'Temporary login token expired or invalid' };
        }
        const passkey = tempSession.passkeys?.find((pk: any) => pk.credentialID === credential.id);
        if (!passkey) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: 'Passkey not found for this account' };
        }

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: storedChallenge.challenge,
            expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "https://supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
            expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
            credential: { id: credential.id, publicKey: Buffer.from(passkey.credentialPublicKey, "base64"), counter: passkey.counter, transports: passkey.transports },
            requireUserVerification: false,
          });
        } catch (e) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: 'Credential verification failed' };
        }

        if (!verification.verified) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: 'Credential could not be verified' };
        }

        if (verification.authenticationInfo?.newCounter !== undefined) {
          if (verification.authenticationInfo.newCounter <= passkey.counter) {
            await keyv.delete(`passkey:auth:challenge:${challengeId}`);
            return { success: false, error: 'Authentication failed: counter check' };
          }
          passkey.counter = verification.authenticationInfo.newCounter;
        }

        await setKey(`temp_login:${token}`, tempSession, 10 * 60 * 1000);
        const sessionResult = await createUserSession(tempSession);
        if (!sessionResult.success) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: `Failed to create session: ${sessionResult.error}` };
        }

        responseSetCookies.push(`sessionId=${sessionResult.sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);

        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        await deleteKey(`temp_login:${token}`);
        return { success: true, message: 'Passkey verification successful' };
      }

      let storedSessionId = await keyv.get(`passkey:credentialId:${credential.id}`);
      if (!storedSessionId) {
        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        return { success: false, error: 'Passkey not found' };
      }

      const sessionData = await getKey<any>(`session:${storedSessionId}`);
      if (!sessionData) {
        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        return { success: false, error: 'User session not found' };
      }

      const passkey = sessionData.passkeys?.find((pk: any) => pk.credentialID === credential.id);
      if (!passkey) {
        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        return { success: false, error: 'Passkey not found in user session' };
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: storedChallenge.challenge,
          expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "https://supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
          expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
          credential: { id: credential.id, publicKey: Buffer.from(passkey.credentialPublicKey, "base64"), counter: passkey.counter, transports: passkey.transports },
          requireUserVerification: false,
        });
      } catch (e) {
        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        return { success: false, error: 'Credential verification failed' };
      }

      if (!verification.verified) {
        await keyv.delete(`passkey:auth:challenge:${challengeId}`);
        return { success: false, error: 'Credential could not be verified' };
      }

      if (verification.authenticationInfo?.newCounter !== undefined) {
        if (verification.authenticationInfo.newCounter <= passkey.counter) {
          await keyv.delete(`passkey:auth:challenge:${challengeId}`);
          return { success: false, error: 'Authentication failed: counter check' };
        }
        passkey.counter = verification.authenticationInfo.newCounter;
      }

      await setKey(`session:${storedSessionId}`, sessionData, 86400 * 1000);
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);

      responseSetCookies.push(`sessionId=${storedSessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);

      return {
        success: true,
        message: 'Passkey authentication successful',
        user: { userId: sessionData.userId, displayName: sessionData.displayName, email: sessionData.email, photoURL: sessionData.photoURL, role: sessionData.role },
      };
    },

    verifyMfaLogin: async ({ token, code }: { token: string; code: string }) => {
      if (!token || !code) return { success: false, error: 'Token and code are required' };
      const tempSessionData = await getKey<any>(`temp_login:${token}`);
      if (!tempSessionData) return { success: false, error: 'Login session expired or invalid' };

      if (tempSessionData.mfaEnabled && tempSessionData.mfaSecret) {
        const totp = new TOTP({
          issuer: 'Zentith LLM',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
          secret: Secret.fromBase32(tempSessionData.mfaSecret),
        });

        const isValid = totp.validate({ token: code, window: 1 }) !== null;
        let isValidBackup = false;
        if (!isValid && tempSessionData.mfaBackupCodes) {
          const backupIndex = tempSessionData.mfaBackupCodes.findIndex((bc: any) => bc.code === code && !bc.used);
          if (backupIndex !== -1) {
            isValidBackup = true;
            tempSessionData.mfaBackupCodes[backupIndex].used = true;
            await setKey(`temp_login:${token}`, tempSessionData, 10 * 60 * 1000);
            if (tempSessionData.userId) {
              await UserSecurityService.updateSecurity(tempSessionData.userId, { mfaBackupCodes: tempSessionData.mfaBackupCodes });
            }
          }
        }

        if (!isValid && !isValidBackup) return { success: false, error: 'Invalid verification code' };
      }

      const sessionResult = await createUserSession(tempSessionData);
      if (!sessionResult.success) return { success: false, error: 'Failed to create session: ' + sessionResult.error };

      await deleteKey(`temp_login:${token}`);
      responseSetCookies.push(`sessionId=${sessionResult.sessionId}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
      return { success: true };
    },
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
