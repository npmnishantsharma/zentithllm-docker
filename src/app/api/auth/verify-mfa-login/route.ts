import { NextRequest, NextResponse } from 'next/server';
import { deleteKey, getKey, setKey } from '@/lib/keyv';
import { TOTP, Secret } from 'otpauth';
import { createUserSession } from '@/app/login/actions';
import { UserSecurityService } from '@/lib/database';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { token, code } = await request.json();
    
    if (!token || !code) {
      return NextResponse.json(
        { success: false, error: 'Token and code are required' },
        { status: 400 }
      );
    }

    const sessionData: any = await getKey(`temp_login:${token}`);
    
    if (!sessionData) {
      return NextResponse.json(
        { success: false, error: 'Login session expired or invalid' },
        { status: 401 }
      );
    }

    // Verify code
    const isMfaEnabled = sessionData.mfaEnabled;
    const mfaSecret = sessionData.mfaSecret;

    if (isMfaEnabled && mfaSecret) {
      const totp = new TOTP({
        issuer: 'Zentith LLM',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(mfaSecret),
      });

      const isValid = totp.validate({ token: code, window: 1 }) !== null;

      // Check Backup Codes if TOTP fails
      let isValidBackup = false;
      if (!isValid && sessionData.mfaBackupCodes) {
        const backupIndex = sessionData.mfaBackupCodes.findIndex(
          (bc: any) => bc.code === code && !bc.used
        );
        if (backupIndex !== -1) {
          isValidBackup = true;
          sessionData.mfaBackupCodes[backupIndex].used = true;

          // Persist backup-code consumption in both temp session and DB
          await setKey(`temp_login:${token}`, sessionData, 10 * 60 * 1000);
          if (sessionData.userId) {
            await UserSecurityService.updateSecurity(sessionData.userId, {
              mfaBackupCodes: sessionData.mfaBackupCodes,
            });
          }
        }
      }

      if (!isValid && !isValidBackup) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code' },
          { status: 400 }
        );
      }
    }

    // If verified, create the final session
    const sessionResult = await createUserSession(sessionData);

    if (!sessionResult.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create session: ' + sessionResult.error },
        { status: 500 }
      );
    }

    await deleteKey(`temp_login:${token}`);

    // Explicitly set cookie in this route response.
    // Do not rely solely on server-action cookie mutation when called from route handlers.
    const cookieStore = await cookies();
    cookieStore.set('sessionId', sessionResult.sessionId || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] MFA Login Verify Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
