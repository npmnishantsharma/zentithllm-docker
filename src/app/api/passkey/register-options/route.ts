import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextRequest, NextResponse } from "next/server";
import { getKey, getKeyvInstance } from "@/lib/keyv";
import { isoUint8Array } from '@simplewebauthn/server/helpers';
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

    // Get user session data
    const sessionData = await getKey(`session:${sessionId}`);
    if (!sessionData || typeof sessionData !== "object") {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionData as Record<string, any>;
    const userEmail = session.email || session.displayName || "user";

    // Get or create user ID for passkey registration
    const userId = session.userId || sessionId;

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpID: process.env.NEXT_PUBLIC_APP_URL?.split("//")[1] || "supreme-couscous-v6495rwrj6r52pr9x-9002.app.github.dev",
      rpName: "Zentith LLM",
      userID: isoUint8Array.fromUTF8String(userId),
      userName: userEmail,
      attestationType: "direct",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });

    // Store challenge in Redis with TTL (10 minutes)
    const keyv = await getKeyvInstance();
    await keyv.set(
      `passkey:challenge:${sessionId}`,
      options,
      600000
    ); // 10 minute TTL

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (error) {
    console.error("Register options error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
