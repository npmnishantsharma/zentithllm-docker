import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { getKey, setKey, getKeyvInstance } from "@/lib/keyv";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

// Helper to convert base64url to Uint8Array
function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binaryString = Buffer.from(paddedBase64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function POST(request: NextRequest) {
  try {
    const { credential, challengeId } = await request.json();

    if (!credential?.id) {
      return NextResponse.json(
        { success: false, error: "Invalid credential" },
        { status: 400 }
      );
    }

    console.log(`[Passkey Auth] Attempting authentication with credential ID: ${credential.id}`);

    // Get stored challenge
    const keyv = await getKeyvInstance();
    const storedChallenge = await keyv.get(`passkey:auth:challenge:${challengeId}`);

    if (!storedChallenge) {
      return NextResponse.json(
        { success: false, error: "Challenge not found or expired" },
        { status: 400 }
      );
    }

    const options = storedChallenge;

    // Look up user by credentialId - also try alternative formats
    const credentialIdKey = `passkey:credentialId:${credential.id}`;
    console.log(`[Passkey Auth] Looking up key: ${credentialIdKey}`);
    
    let storedSessionId = await keyv.get(credentialIdKey);
    
    // If not found, log all passkey index keys for debugging
    if (!storedSessionId) {
      console.warn(`[Passkey Auth] Credential ID index not found for: ${credential.id}`);
      console.warn("[Passkey Auth] Attempting to find all passkey indexes in Redis...");
      
      // Try to scan for any passkey:credentialId: keys (this is a workaround for debugging)
      // In production, you might want to maintain a separate index
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);
      return NextResponse.json(
        { success: false, error: "Passkey not found - no user associated with this credential. Please register a passkey first." },
        { status: 404 }
      );
    }

    console.log(`[Passkey Auth] Found session ID: ${storedSessionId} for credential ID: ${credential.id}`);

    // Get user session data
    const sessionData = await getKey(`session:${storedSessionId}`);
    if (!sessionData || typeof sessionData !== "object") {
      console.error(`[Passkey Auth] Session data not found for session ID: ${storedSessionId}`);
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);
      return NextResponse.json(
        { success: false, error: "User session not found" },
        { status: 404 }
      );
    }

    const session = sessionData as Record<string, any>;
    console.log(`[Passkey Auth] Found session with ${session.passkeys?.length || 0} passkeys`);
    
    const passkey = session.passkeys?.find((pk: any) => pk.credentialID === credential.id);

    if (!passkey) {
      console.error(`[Passkey Auth] Passkey not found in session. Looking for credentialID: ${credential.id}`);
      console.error(`[Passkey Auth] Session has ${session.passkeys?.length || 0} passkeys`);
      if (session.passkeys && session.passkeys.length > 0) {
        console.error("[Passkey Auth] Stored credential IDs:", session.passkeys.map((pk: any) => pk.credentialID));
      }
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);
      return NextResponse.json(
        { success: false, error: "Passkey not found in user session" },
        { status: 404 }
      );
    }
    
    console.log(`[Passkey Auth] Found matching passkey in session`);

    // Verify the credential
    let verification;
    try {
      const storedPublicKeyBuffer = Buffer.from(passkey.credentialPublicKey, "base64");
      
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: options.challenge,
        expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "https://supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        credential: {
          id: credential.id,
          publicKey: storedPublicKeyBuffer,
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });
    } catch (error) {
      console.error("Verification error:", error);
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);
      return NextResponse.json(
        { success: false, error: "Credential verification failed" },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      await keyv.delete(`passkey:auth:challenge:${challengeId}`);
      return NextResponse.json(
        { success: false, error: "Credential could not be verified" },
        { status: 400 }
      );
    }

    // Check counter for replay attack prevention
    if (verification.authenticationInfo?.newCounter !== undefined) {
      if (verification.authenticationInfo.newCounter <= passkey.counter) {
        console.warn("Potential replay attack detected");
        return NextResponse.json(
          { success: false, error: "Authentication failed: counter check" },
          { status: 400 }
        );
      }

      // Update counter in passkey
      passkey.counter = verification.authenticationInfo.newCounter;
    }

    // Update session in Redis
    await setKey(`session:${storedSessionId}`, session, 86400 * 1000);

    // Clean up challenge
    await keyv.delete(`passkey:auth:challenge:${challengeId}`);

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set("sessionId", storedSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 86400, // 24 hours
    });

    return NextResponse.json({
      success: true,
      message: "Passkey authentication successful",
      user: {
        userId: session.userId,
        displayName: session.displayName,
        email: session.email,
        photoURL: session.photoURL,
        role: session.role,
      },
    });
  } catch (error) {
    console.error("Authenticate verify error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
