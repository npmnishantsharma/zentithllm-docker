/**
 * Session utilities for accessing user data from Redis
 * Use in API routes and server components
 */

import { cookies } from 'next/headers';
import { getKey } from '@/lib/keyv';

export interface SessionUser {
  userId: string;
  displayName: string;
  email?: string;
  profilePicture?: string;
  [key: string]: any;
}

export interface SessionData {
  user: SessionUser;
  sessionId: string;
  loginTime: string;
}

/**
 * Get user session from Redux using the session cookie
 * Safe to use in Server Components and API routes
 */
export async function getSessionData(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;

    if (!sessionId) {
      return null;
    }

    const userData = await getKey<SessionUser>(`session:${sessionId}`);

    if (!userData) {
      return null;
    }

    return {
      user: userData,
      sessionId,
      loginTime: userData.loginTime || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
}

/**
 * Get only the user data from session
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSessionData();
  return session?.user ?? null;
}

/**
 * Get only the session ID
 */
export async function getSessionId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('sessionId')?.value ?? null;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isUserAuthenticated(): Promise<boolean> {
  const session = await getSessionData();
  return session !== null;
}

/**
 * Example usage in a Server Component:
 *
 * import { getSessionUser } from '@/lib/session';
 *
 * export default async function ChatPage() {
 *   const user = await getSessionUser();
 *
 *   if (!user) {
 *     redirect('/login');
 *   }
 *
 *   return <div>Welcome {user.displayName}!</div>;
 * }
 *
 *
 * Example usage in an API route:
 *
 * import { NextRequest, NextResponse } from 'next/server';
 * import { getSessionUser } from '@/lib/session';
 *
 * export async function GET(request: NextRequest) {
 *   const user = await getSessionUser();
 *
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   return NextResponse.json({ message: `Hello ${user.displayName}!` });
 * }
 *
 *
 * Example logout button (Client Component):
 *
 * import { logout } from '@/app/login/actions';
 *
 * export function LogoutButton() {
 *   return (
 *     <button onClick={() => logout()}>
 *       Logout
 *     </button>
 *   );
 * }
 */
