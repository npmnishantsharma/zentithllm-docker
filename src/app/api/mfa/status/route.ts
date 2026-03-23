import { NextRequest, NextResponse } from 'next/server';
import { getKey, setKey, deleteKey } from '@/lib/keyv';
import { SessionUser } from '@/lib/session';

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

    return NextResponse.json({
      success: true,
      mfaEnabled: (userData as any).mfaEnabled || false,
      mfaEnabledAt: (userData as any).mfaEnabledAt,
      backupCodesAvailable: ((userData as any).mfaBackupCodes || []).filter(
        (c: any) => !c.used
      ).length,
    });
  } catch (error: any) {
    console.error('[API] MFA Status Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Disable MFA or regenerate backup codes
 */
export async function POST(request: NextRequest) {
  try {
    const { action, password } = await request.json();

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

      const updatedUserData = {
        ...userData,
        mfaBackupCodes: newBackupCodes.map((code: string) => ({ code, used: false })),
      };

      await setKey(`session:${sessionId}`, updatedUserData, 24 * 60 * 60 * 1000);

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
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
