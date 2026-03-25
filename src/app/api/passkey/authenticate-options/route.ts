import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { getKey, getKeyvInstance } from "@/lib/keyv";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token as string | undefined;

    let allowCredentials: any[] | undefined;

    // When token is provided (post-Nexus login hardening flow), bind passkey challenge to that temp login
    if (token) {
      const tempSession = await getKey<any>(`temp_login:${token}`);
      if (!tempSession) {
        return NextResponse.json(
          { success: false, error: "Login verification token expired or invalid" },
          { status: 401 }
        );
      }

      const passkeys = (tempSession.passkeys || []) as any[];
      if (!passkeys.length) {
        return NextResponse.json(
          { success: false, error: "No registered passkeys found for this account" },
          { status: 400 }
        );
      }

      allowCredentials = passkeys
        .filter((pk) => pk?.credentialID)
        .map((pk) => ({
          id: pk.credentialID,
          transports: pk.transports,
        }));
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
      userVerification: "preferred",
      allowCredentials,
    });

    // Store challenge in Redis with TTL (10 minutes)
    const keyv = await getKeyvInstance();
    const challengeId = Math.random().toString(36).substring(7);
    await keyv.set(
      `passkey:auth:challenge:${challengeId}`,
      options,
      600000
    ); // 10 minute TTL

    return NextResponse.json({
      success: true,
      challengeId,
      options,
    });
  } catch (error) {
    console.error("Authenticate options error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
