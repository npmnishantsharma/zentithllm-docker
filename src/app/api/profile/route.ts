import { NextRequest, NextResponse } from 'next/server';
import { getKey } from '@/lib/keyv';
import { SessionUser } from '@/lib/session';

/**
 * Internal API route to get user profile by session ID
 * 
 * Automatically uses sessionId from httpOnly cookie if user is logged in.
 * Falls back to query params or headers if needed.
 * 
 * Usage:
 * - GET /api/profile (uses cookie automatically for logged-in users)
 * - GET /api/profile?sessionId=xxx (manual sessionId)
 * - GET /api/profile with X-Session-Id header
 */
export async function GET(request: NextRequest) {
  try {
    // Priority 1: Get sessionId from httpOnly cookie (automatic for logged-in users)
    let sessionId = request.cookies.get('sessionId')?.value;
    
    // Priority 2: Fall back to query parameter
    if (!sessionId) {
      sessionId = request.nextUrl.searchParams.get('sessionId') ?? undefined;
    }
    
    // Priority 3: Fall back to header
    if (!sessionId) {
      sessionId = request.headers.get('X-Session-Id') ?? undefined;
    }

    if (!sessionId || sessionId.trim() === '') {
      return NextResponse.json(
        { error: 'User is not logged in', message: 'No valid session found' },
        { status: 401 }
      );
    }

    // Retrieve user data from Redis
    const userData = await getKey<SessionUser>(`session:${sessionId}`);

    if (!userData) {
      return NextResponse.json(
        { error: 'Session not found or expired', message: 'Please log in again' },
        { status: 401 }
      );
    }

    const safeProfile = {
      userId: userData.userId,
      uid: (userData as any).uid ?? userData.userId,
      displayName: userData.displayName,
      email: userData.email,
      photoURL: (userData as any).photoURL,
      profilePicture: userData.profilePicture,
      username: (userData as any).username,
      role: (userData as any).role,
      userTag: (userData as any).userTag,
      sessionId,
    };

    // Return only safe profile fields (never full session blob)
    return NextResponse.json({
      success: true,
      profile: safeProfile,
      data: safeProfile,
    });
  } catch (error: any) {
    console.error('[API] Get Profile Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST request handler - alternative way to get profile
 * Also automatically uses cookie if user is logged in
 */
export async function POST(request: NextRequest) {
  try {
    // Priority 1: Get sessionId from httpOnly cookie (automatic for logged-in users)
    let sessionId = request.cookies.get('sessionId')?.value;
    
    // Priority 2: Get from request body
    if (!sessionId) {
      const body = await request.json().catch(() => ({}));
      sessionId = body.sessionId ?? undefined;
    }

    if (!sessionId || sessionId.trim() === '') {
      return NextResponse.json(
        { error: 'User is not logged in', message: 'No valid session found' },
        { status: 401 }
      );
    }

    // Retrieve user data from Redis
    const userData = await getKey<SessionUser>(`session:${sessionId}`);

    if (!userData) {
      return NextResponse.json(
        { error: 'Session not found or expired', message: 'Please log in again' },
        { status: 401 }
      );
    }

    const safeProfile = {
      userId: userData.userId,
      uid: (userData as any).uid ?? userData.userId,
      displayName: userData.displayName,
      email: userData.email,
      photoURL: (userData as any).photoURL,
      profilePicture: userData.profilePicture,
      username: (userData as any).username,
      role: (userData as any).role,
      userTag: (userData as any).userTag,
      sessionId,
    };

    // Return only safe profile fields (never full session blob)
    return NextResponse.json({
      success: true,
      profile: safeProfile,
      data: safeProfile,
    });
  } catch (error: any) {
    console.error('[API] Post Profile Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
