import { NextRequest, NextResponse } from 'next/server';
import { getKey, setKey } from '@/lib/keyv';
import { SessionUser } from '@/lib/session';
import { UserSecurityService } from '@/lib/database';
import { encryptApiPayload } from '@/lib/api-encryption';

/**
 * Get MFA status, disable MFA, or regenerate backup codes
 */
export async function GET(request: NextRequest) {
  try {
    // Get sessionId from cookie
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'User is not logged in' },
        { status: 401 }
      );
    }

    // Retrieve user data from Redis
    const userData = await getKey<SessionUser>(`session:${sessionId}`);

    if (!userData) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 401 }
      );
    }

    const security = userData.userId
      ? await UserSecurityService.getSecurity(userData.userId)
      : null;

    const sessionMfaEnabled = (userData as any).mfaEnabled || false;
    const sessionBackupCodes = ((userData as any).mfaBackupCodes || []).filter(
      (c: any) => !c.used
    ).length;

    const effectiveMfaEnabled = security ? security.mfaEnabled : sessionMfaEnabled;
    const effectiveBackupCodesAvailable = security
      ? (security.mfaBackupCodes || []).filter((c: any) => !c.used).length
      : sessionBackupCodes;

    // Keep session in sync with persisted security state so UI always reflects latest profile settings.
    if (security && ((userData as any).mfaEnabled !== security.mfaEnabled)) {
      await setKey(
        `session:${sessionId}`,
        {
          ...userData,
          mfaEnabled: security.mfaEnabled,
          mfaSecret: security.mfaSecret,
          mfaBackupCodes: security.mfaBackupCodes || [],
        },
        24 * 60 * 60 * 1000
      );
    }

    const responsePayload = {
      success: true,
      mfaEnabled: effectiveMfaEnabled,
      mfaEnabledAt: (userData as any).mfaEnabledAt,
      backupCodesAvailable: effectiveBackupCodesAvailable,
    };

    const responseEncKey = request.headers.get('x-response-enc-key');
    if (responseEncKey) {
      return NextResponse.json(encryptApiPayload(responsePayload, responseEncKey));
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('[API] MFA Status Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Disable MFA or regenerate backup codes
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get sessionId from cookie
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'User is not logged in' },
        { status: 401 }
      );
    }

    // Retrieve user data from Redis
    const userData = await getKey<SessionUser>(`session:${sessionId}`);

    if (!userData) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 401 }
      );
    }

    if (action === 'disable') {
      // Disable MFA
      const updatedUserData = {
        ...userData,
        mfaEnabled: false,
        mfaSecret: undefined,
        mfaBackupCodes: undefined,
        mfaEnabledAt: undefined,
      };

      await setKey(`session:${sessionId}`, updatedUserData, 24 * 60 * 60 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, {
          mfaEnabled: false,
          mfaSecret: null as any,
          mfaBackupCodes: []
        });
      }

      return NextResponse.json({
        success: true,
        message: 'MFA has been disabled',
      });
    } else if (action === 'regenerate') {
      // Regenerate backup codes
      const crypto = require('crypto');
      const newBackupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      const mfaBackupCodes = newBackupCodes.map((code: string) => ({ code, used: false }));

      const updatedUserData = {
        ...userData,
        mfaBackupCodes
      };

      await setKey(`session:${sessionId}`, updatedUserData, 24 * 60 * 60 * 1000);

      if (userData.userId) {
        await UserSecurityService.updateSecurity(userData.userId, {
          mfaBackupCodes
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Backup codes have been regenerated',
        backupCodes: newBackupCodes,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API] MFA Action Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
