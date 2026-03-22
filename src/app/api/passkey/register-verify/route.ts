import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { getKey, setKey, getKeyvInstance } from "@/lib/keyv";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("sessionId")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { credential, deviceName } = await request.json();

    // Get stored challenge
    const keyv = await getKeyvInstance();
    const storedChallenge = await keyv.get(`passkey:challenge:${sessionId}`);

    if (!storedChallenge) {
      return NextResponse.json(
        { success: false, error: "Challenge not found or expired" },
        { status: 400 }
      );
    }

    const options = storedChallenge;

    // Get user session data
    const sessionData = await getKey(`session:${sessionId}`);
    if (!sessionData || typeof sessionData !== "object") {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionData as Record<string, any>;
    const userId = session.userId || sessionId;

    // Verify the credential
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge: options.challenge,
        expectedOrigin: process.env.NEXT_PUBLIC_APP_URL || "https://supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        expectedRPID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
        requireUserVerification: false,
      });
    } catch (error) {
      console.error("Verification error:", error);
      return NextResponse.json(
        { success: false, error: "Credential verification failed" },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, error: "Credential could not be verified" },
        { status: 400 }
      );
    }

    // Store passkey in user session
    const passkeys = session.passkeys || [];
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
    session.passkeys = passkeys;

    // Update session in Redis
    await setKey(`session:${sessionId}`, session, 86400 * 1000); // 24-hour TTL

    // Create index for credential ID lookup during authentication
    await keyv.set(
      `passkey:credentialId:${credential.id}`,
      sessionId,
      86400 * 1000
    ); // 24-hour TTL

    // Clean up challenge
    await keyv.delete(`passkey:challenge:${sessionId}`);

    return NextResponse.json({
      success: true,
      message: "Passkey registered successfully",
      passkey: {
        id: newPasskey.id,
        deviceName: newPasskey.deviceName,
        createdAt: newPasskey.createdAt,
      },
    });
  } catch (error) {
    console.error("Register verify error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
