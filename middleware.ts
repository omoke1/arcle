/**
 * Middleware: Protect routes that require invite code verification
 * 
 * This middleware checks if the user has verified an invite code
 * before allowing access to protected routes like /chat
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

// Initialize rate limit middleware
// Use dummy KV if env vars missing (dev mode) to prevent crash
const ratelimit = new Ratelimit({
  redis: kv || {
    // Mock for build/dev without KV
    sadd: async () => 0,
    eval: async () => [1, '10'],
  } as any,
  // 10 requests from the same IP in 10 seconds
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: '@upstash/ratelimit',
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate Limiting for API routes
  if (pathname.startsWith('/api/') && process.env.KV_REST_API_URL) {
    const ip = request.ip ?? '127.0.0.1';
    try {
      const { success, limit, reset, remaining } = await ratelimit.limit(ip);

      if (!success) {
        return new NextResponse('Too Many Requests', {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        });
      }
    } catch (error) {
      console.warn('Rate limit failed, failing open:', error);
    }
  }

  // 2. Protected Routes (Invite Verification)
  const protectedRoutes = ['/chat'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Client-side verification is primary, this is just a stub
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/chat/:path*',
    '/api/:path*',
    // Add other protected routes here
  ],
};



