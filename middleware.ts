import { NextRequest, NextResponse } from 'next/server';
import { SessionService } from '@/lib/database';

/**
 * Middleware to check if user has a valid session
 * Protects /chat and other authenticated routes
 * 
 * Note: This middleware works with the trustHost: true setting in next.config.ts
 * which allows Server Actions to work with forwarded headers (GitHub Codespaces, etc.)
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/proxy-stream'];
  
  // Check if route is public
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionId = request.cookies.get('sessionId')?.value;

  if (!sessionId) {
    // No session, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Validate session exists in Redis
  try {
    const sessionData = await SessionService.getSession(sessionId);

    if (!sessionData) {
      // Session expired or invalid
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('sessionId');
      return response;
    }
  } catch (error) {
    console.error('Session validation error:', error);
    // Continue anyway - Redis might be down temporarily
    // In production, you might want different error handling
  }

  return NextResponse.next();
}

/**
 * Configure which routes to run middleware on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
