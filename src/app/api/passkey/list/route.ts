import { NextRequest, NextResponse } from "next/server";
import { getKey, setKey } from "@/lib/keyv";
import { UserSecurityService } from "@/lib/database";

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
    const sessionPasskeys = Array.isArray(session.passkeys) ? session.passkeys : [];

    const security = session.userId
      ? await UserSecurityService.getSecurity(session.userId)
      : null;

    const passkeys = security ? (security.passkeys || []) : sessionPasskeys;

    // Sync cached session with persisted passkeys for consistent reads.
    if (security && JSON.stringify(sessionPasskeys) !== JSON.stringify(passkeys)) {
      await setKey(
        `session:${sessionId}`,
        {
          ...session,
          passkeys,
        },
        24 * 60 * 60 * 1000
      );
    }

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
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
