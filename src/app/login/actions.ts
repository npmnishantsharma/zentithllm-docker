
'use server';

import { cookies } from 'next/headers';
import { UserService, SessionService, UserSecurityService, AppSettingsService } from '@/lib/database';
import { randomBytes } from 'crypto';
import { setKey } from '@/lib/keyv';

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Store user session in PostgreSQL and set session cookie
 * Automatically makes the first user an admin
 */
export async function createUserSession(userData: any) {
  try {
    if (!userData?.email) {
      return { success: false, error: 'Missing user email for session creation' };
    }

    const canAccess = await AppSettingsService.canAccessByEmail(userData.email);
    if (!canAccess) {
      return {
        success: false,
        error: 'This app is private. Your email is not on the allow list.',
      };
    }

    // Check if this is the first user
    const isFirst = await UserService.isFirstUser();

    if (isFirst) {
      // Make first user an admin
      userData.isAdmin = true;
      console.log('[Session] Making first user an admin:', userData.displayName);
    } else if (userData.isAdmin === undefined) {
      // Default role for non-first users
      userData.isAdmin = false;
    }

    // Create or update user in PostgreSQL
    let user = await UserService.getUserByEmail(userData.email);

    if (!user) {
      user = await UserService.createUser(
        userData.email,
        userData.displayName,
        userData.profilePicture,
        !!userData.isAdmin
      );
    } else {
      // Update last login
      await UserService.updateUser(user.id, { lastLogin: new Date() });
    }

    const promotedAsBootstrapAdmin = await UserService.ensureSingleUserBootstrapAdmin(user.id);
    if (promotedAsBootstrapAdmin) {
      const refreshedUser = await UserService.getUserById(user.id);
      if (refreshedUser) {
        user = refreshedUser;
      }
      console.log('[Session] Bootstrap admin recovery applied for user:', user.email);
    }

    // Create session in PostgreSQL-backed storage
    const sessionId = await SessionService.createSession(user.id, {
      displayName: user.displayName,
      email: user.email,
      profilePicture: user.profilePicture,
      isAdmin: user.isAdmin,
      passkeys: userData.passkeys || [],
      mfaEnabled: userData.mfaEnabled || false,
      mfaSecret: userData.mfaSecret,
      mfaBackupCodes: userData.mfaBackupCodes || [],
      mfaEnabledAt: userData.mfaEnabledAt,
    });

    // Set HttpOnly cookie (accessible only by the app/server)
    const cookieStore = await cookies();
    cookieStore.set('sessionId', sessionId, {
      httpOnly: true,        // Cannot be accessed by JavaScript (secure)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',    // CSRF protection
      maxAge: 24 * 60 * 60,  // 24 hours in seconds
      path: '/',
    });

    return { success: true, sessionId };
  } catch (error: any) {
    console.error('Session creation error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clear user session from PostgreSQL and remove cookie
 */
export async function logout() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;

    if (sessionId) {
      await SessionService.deleteSession(sessionId);
    }

    cookieStore.delete('sessionId');
    return { success: true };
  } catch (error: any) {
    console.error('Logout error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get current user session from PostgreSQL
 */
export async function getUserSession() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;

    if (!sessionId) {
      return { success: false, error: 'No session found' };
    }

    const sessionData = await SessionService.getSession(sessionId);

    if (!sessionData) {
      return { success: false, error: 'Session expired' };
    }

    return { success: true, userData: sessionData, sessionId };
  } catch (error: any) {
    console.error('Get session error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clear user session from Redis and remove cookie
 */
export async function clearUserSession() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;

    if (sessionId) {
      await SessionService.deleteSession(sessionId);
    }

    cookieStore.delete('sessionId');
    return { success: true };
  } catch (error: any) {
    console.error('Clear session error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to handle secure authentication with NexusLLM.
 * This keeps the client_id and client_secret on the server.
 */
export async function authenticateWithNexusLLM() {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing NexusLLM credentials in environment variables.');
  }

  try {
    const response = await fetch('https://zentithllm.nishantapps.in/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Authentication failed');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('NexusLLM Auth Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Finalizes the handshake by exchanging the one-time code for user profile info.
 * Also creates a session in PostgreSQL and sets an HttpOnly cookie.
 */
export async function getUserInfoWithCode(code: string) {
  const clientId = process.env.NEXUSLLM_CLIENT_ID;
  const clientSecret = process.env.NEXUSLLM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing NexusLLM credentials in environment variables.');
  }

  try {
    const response = await fetch('https://zentithllm.nishantapps.in/api/auth/userinfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Handshake failed at user info exchange');
    }

    const data = await response.json();

    // Create session in PostgreSQL and set HttpOnly cookie
    if (data.user) {
      const canAccess = await AppSettingsService.canAccessByEmail(data.user.email || '');
      if (!canAccess) {
        return {
          success: false,
          error: 'This app is private. Your email is not on the allow list.',
        };
      }

      let user = await UserService.getUserByEmail(data.user.email);
      if (!user) {
        const shouldBeAdmin = await UserService.isFirstUser();
        user = await UserService.createUser(
          data.user.email,
          data.user.displayName,
          data.user.profilePicture,
          shouldBeAdmin
        );
      } else {
        await UserService.updateUser(user.id, { lastLogin: new Date() });
      }

      // Check MFA/Passkey security
      const security = await UserSecurityService.getSecurity(user.id);
      
      const sessionData = {
        userId: user.id || data.user.id || data.user.userId,
        displayName: user.displayName || data.user.displayName,
        email: user.email || data.user.email,
        profilePicture: user.profilePicture || data.user.profilePicture,
        loginTime: new Date().toISOString(),
        isAdmin: user.isAdmin,
        passkeys: security?.passkeys || [],
        mfaEnabled: security?.mfaEnabled || false,
        mfaSecret: security?.mfaSecret,
        mfaBackupCodes: security?.mfaBackupCodes || [],
        ...data.user,
      };

      if (security?.mfaEnabled || (security?.passkeys && security.passkeys.length > 0)) {
        // Require MFA or Passkey
        const tempSessionId = generateSessionId();
        await setKey(`temp_login:${tempSessionId}`, sessionData, 10 * 60 * 1000); // 10 minutes

        return { 
          success: true, 
          requireVerification: true, 
          tempSessionId, 
          mfaEnabled: security?.mfaEnabled,
          passkeysEnabled: security?.passkeys && security.passkeys.length > 0 
        };
      }

      const sessionResult = await createUserSession(sessionData);

      if (!sessionResult.success) {
        throw new Error('Failed to create session: ' + sessionResult.error);
      }
      
      return { success: true, data };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('NexusLLM UserInfo Error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function verifyTempLoginWithMfa(tempSessionId: string) {
  try {
    const { getKey } = await import('@/lib/keyv');
    const sessionData = await getKey(`temp_login:${tempSessionId}`);
    
    if (!sessionData) {
      return { success: false, error: 'Login session expired or invalid' };
    }
    
    const sessionResult = await createUserSession(sessionData);

    if (!sessionResult.success) {
      return { success: false, error: 'Failed to create session: ' + sessionResult.error };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('MFA Verification Error:', error.message);
    return { success: false, error: error.message };
  }
}
