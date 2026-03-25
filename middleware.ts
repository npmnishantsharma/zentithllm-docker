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
  const isApiRoute = pathname.startsWith('/api');
  const isDev = process.env.NODE_ENV === 'development';
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const isHttps = request.nextUrl.protocol === 'https:' || forwardedProto === 'https';
  const enforceHttps =
    !isDev &&
    (process.env.NODE_ENV === 'production' ||
      process.env.ENFORCE_HTTPS_API === 'true' ||
      process.env.FORCE_ENC_DEV === 'true');

  const withApiSecurityHeaders = (response: NextResponse) => {
    if (!isApiRoute) return response;

    if (enforceHttps) {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    return response;
  };

  // Enforce encrypted transport for API calls in production.
  // In local development, plain HTTP is allowed for convenience.
  if (isApiRoute && enforceHttps && !isHttps) {
    return withApiSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          error: 'HTTPS is required for all API requests',
        },
        { status: 426 }
      )
    );
  }

  // Routes that don't require authentication
  const publicRoutes = ['/login', '/api/auth/proxy-stream', '/api/graphql'];
  
  // Check if route is public
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return withApiSecurityHeaders(NextResponse.next());
  }

  // Check for session cookie
  const sessionId = request.cookies.get('sessionId')?.value;

  if (!sessionId) {
    // No session, redirect to login
    return withApiSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
  }

  // Validate session exists in Redis
  try {
    const sessionData = await SessionService.getSession(sessionId);

    if (!sessionData) {
      // Session expired or invalid
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('sessionId');
      return withApiSecurityHeaders(response);
    }
  } catch (error) {
    console.error('Session validation error:', error);
    // Continue anyway - Redis might be down temporarily
    // In production, you might want different error handling
  }

  return withApiSecurityHeaders(NextResponse.next());
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
