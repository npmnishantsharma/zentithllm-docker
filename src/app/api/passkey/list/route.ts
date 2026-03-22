import { NextRequest, NextResponse } from "next/server";
import { getKey } from "@/lib/keyv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("sessionId")?.value;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const sessionData = await getKey(`session:${sessionId}`);
    if (!sessionData || typeof sessionData !== "object") {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    const session = sessionData as Record<string, any>;
    const passkeys = session.passkeys || [];

    // Return passkeys without sensitive data
    const safePasskeys = passkeys.map((p: any) => ({
      id: p.id,
      deviceName: p.deviceName,
      createdAt: p.createdAt,
      transports: p.transports,
    }));

    return NextResponse.json({
      success: true,
      passkeys: safePasskeys,
    });
  } catch (error) {
    console.error("List passkeys error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
