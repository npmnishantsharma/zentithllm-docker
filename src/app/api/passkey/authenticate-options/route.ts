import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { getKeyvInstance } from "@/lib/keyv";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
      userVerification: "preferred",
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
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
