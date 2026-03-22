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

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Passkey ID required" },
        { status: 400 }
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

    // Find the passkey to get credentialID for index cleanup
    const passkeyToDelete = passkeys.find((p: any) => p.id === id);
    
    // Filter out the passkey
    session.passkeys = passkeys.filter((p: any) => p.id !== id);

    // Update session
    await setKey(`session:${sessionId}`, session, 86400 * 1000); // 24-hour TTL

    // Clean up credentialId index
    if (passkeyToDelete?.credentialID) {
      const keyv = await getKeyvInstance();
      await keyv.delete(`passkey:credentialId:${passkeyToDelete.credentialID}`);
    }

    return NextResponse.json({
      success: true,
      message: "Passkey deleted successfully",
    });
  } catch (error) {
    console.error("Delete passkey error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
