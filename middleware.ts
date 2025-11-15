/**
 * Middleware: Protect routes that require invite code verification
 * 
 * This middleware checks if the user has verified an invite code
 * before allowing access to protected routes like /chat
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes that require invite verification
  const protectedRoutes = ['/chat'];

  // Check if current route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Check if user has verified invite code (stored in cookie or we'll check client-side)
    // Since we're using localStorage for verification, we'll rely on client-side redirect
    // This middleware is a secondary layer of protection

    // For now, allow through - client-side will handle redirect if no access
    // In the future, you could use cookies for server-side verification
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/chat/:path*',
    // Add other protected routes here
  ],
};



