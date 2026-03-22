import { NextRequest, NextResponse } from 'next/server';
import { getKey, setKey, deleteKey } from '@/lib/keyv';
import { SessionUser } from '@/lib/session';
import { TOTP, Secret } from 'otpauth';
import { randomBytes } from 'crypto';

/**
 * Verify TOTP code using OTPAuth library and enable MFA for the user
 * Requires the code from their authenticator app
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    
    if (!code || code.trim().length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Verification code must be a 6-digit number' },
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

    // Get pending MFA setup
    const pendingMfa = await getKey<any>(`mfa:pending:${sessionId}`);

    if (!pendingMfa) {
      return NextResponse.json(
        { error: 'No pending MFA setup found. Please generate a new secret.' },
        { status: 400 }
      );
    }

    // Create TOTP instance from the secret
    const totp = new TOTP({
      issuer: 'Zentith LLM',
      label: userData.email || userData.displayName || 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(pendingMfa.secret),
    });

    // Verify the code (allows ±1 time window for accuracy)
    const isValid = totp.validate({ token: code, window: 1 }) !== null;

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Generate backup codes (10 codes for account recovery)
    const backupCodes = Array.from({ length: 10 }, () =>
      randomBytes(4).toString('hex').toUpperCase()
    );

    // Update user session with MFA enabled
    const updatedUserData = {
      ...userData,
      mfaEnabled: true,
      mfaSecret: pendingMfa.secret,
      mfaBackupCodes: backupCodes.map((code: string) => ({ code, used: false })),
      mfaEnabledAt: new Date().toISOString(),
    };

    // Store updated user data in Redis
    await setKey(`session:${sessionId}`, updatedUserData, 24 * 60 * 60 * 1000);

    // Delete pending MFA setup
    await deleteKey(`mfa:pending:${sessionId}`);

    return NextResponse.json({
      success: true,
      message: 'MFA has been successfully enabled',
      backupCodes,
    });
  } catch (error: any) {
    console.error('[API] MFA Verify Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
