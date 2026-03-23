import { NextRequest, NextResponse } from 'next/server';
import { getKey, setKey } from '@/lib/keyv';
import { SessionUser } from '@/lib/session';
import { TOTP, Secret } from 'otpauth';

/**
 * Generate a new MFA secret for the user using OTPAuth library
 * Returns a QR code and secret that can be scanned with authenticator apps
 */
export async function POST(request: NextRequest) {
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

    // Create TOTP instance using OTPAuth
    const totp = new TOTP({
      issuer: 'Zentith LLM',
      label: userData.email || userData.displayName || 'User',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    // Generate the otpauth URL which includes the secret
    const otpauthUrl = totp.toString();

    // Extract the secret from the TOTP instance
    const secret = totp.secret.base32;

    // Store pending MFA setup (temporary, not confirmed yet)
    await setKey(
      `mfa:pending:${sessionId}`,
      {
        secret,
        otpInstance: otpauthUrl,
        createdAt: new Date().toISOString(),
      },
      10 * 60 * 1000 // 10 minutes TTL
    );

    return NextResponse.json({
      success: true,
      secret,
      otpauthUrl,
      message: 'MFA secret generated. Scan the QR code or enter the secret manually.',
    });
  } catch (error: any) {
    console.error('[API] MFA Setup Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
