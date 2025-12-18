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
import { getSupabaseAdmin } from '@/lib/supabase';

// Check if KV is configured
const isKvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Initialize rate limit middleware only when KV is available
// Skip rate limiting in dev/local environments where KV is not configured
const ratelimit: Ratelimit | null = isKvConfigured && kv
  ? new Ratelimit({
      redis: kv,
      // 10 requests from the same IP in 10 seconds
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: '@upstash/ratelimit',
    })
  : null;

/**
 * Extract client IP address from request headers
 * Checks headers in order: cf-connecting-ip, x-forwarded-for, x-real-ip
 * Only trusts proxy headers when running behind known proxies (e.g., Vercel)
 */
function getClientIP(request: NextRequest): string | null {
  // Check if we're behind a known trusted proxy (e.g., Vercel)
  const isBehindTrustedProxy = process.env.VERCEL === '1' || 
                                process.env.VERCEL_ENV !== undefined ||
                                request.headers.get('x-vercel-id') !== null;

  // Only trust proxy headers if behind a known proxy to avoid spoofing
  if (isBehindTrustedProxy) {
    // 1. Check Cloudflare header (highest priority)
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP && cfIP.trim()) {
      return normalizeIP(cfIP.trim());
    }

    // 2. Check x-forwarded-for (may contain multiple IPs, take first)
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map(ip => ip.trim()).filter(ip => ip);
      if (ips.length > 0) {
        return normalizeIP(ips[0]);
      }
    }

    // 3. Check x-real-ip
    const xRealIP = request.headers.get('x-real-ip');
    if (xRealIP && xRealIP.trim()) {
      return normalizeIP(xRealIP.trim());
    }
  }

  // Fallback to request.ip or request.socket.remoteAddress if available
  if (request.ip) {
    return normalizeIP(request.ip);
  }

  // Last resort: return null instead of defaulting to 127.0.0.1
  // This ensures legitimate distinct clients behind proxies are rate-limited correctly
  return null;
}

/**
 * Normalize IP address by removing IPv6/IPv4-mapped prefixes
 */
function normalizeIP(ip: string): string {
  // Remove IPv4-mapped IPv6 prefix (::ffff:)
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Remove IPv6 prefix for IPv4 addresses (::ffff:192.168.1.1 format)
  if (ip.includes('::ffff:')) {
    const parts = ip.split('::ffff:');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
  }

  return ip;
}

/**
 * Get authenticated user from request
 * Extracts session token from Authorization header or cookies and verifies it
 */
async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Middleware] Supabase not configured");
      return null;
    }

    // Try to get token from Authorization header first
    const authHeader = request.headers.get("authorization");
    let accessToken: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    } else {
      // Try to get from cookies - Supabase stores session in cookies
      const cookies = request.cookies;
      
      // Supabase stores access token in cookies with pattern: sb-<project-ref>-auth-token
      // Also check for other common patterns
      for (const cookie of cookies.getAll()) {
        const cookieName = cookie.name.toLowerCase();
        
        // Check for Supabase auth token cookie (standard format: sb-<project-ref>-auth-token)
        if (cookieName.includes("sb-") && cookieName.includes("auth-token")) {
          accessToken = cookie.value;
          break;
        }
        
        // Fallback: Try to parse as JSON (some setups store session as JSON)
        if (cookieName.includes("supabase") || cookieName.includes("sb-")) {
          try {
            const cookieValue = decodeURIComponent(cookie.value);
            const parsed = JSON.parse(cookieValue);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              break;
            }
          } catch {
            // Cookie is not JSON, might be direct token
            if (cookieName.includes("access-token") || cookieName.includes("auth-token")) {
              accessToken = cookie.value;
              break;
            }
          }
        }
      }
    }

    if (!accessToken) {
      return null;
    }

    // Verify token and get user using Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user || !user.id) {
      return null;
    }

    return { id: user.id };
  } catch (error) {
    console.error("[Middleware] Error getting authenticated user:", error);
    return null;
  }
}

/**
 * Check if user has access in user_access table
 */
async function checkUserAccess(userId: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_access')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // PGRST116 = no rows returned (not an error, just no access)
      if (error.code === 'PGRST116') {
        return false;
      }
      console.error("[Middleware] Error checking user access:", error);
      return false;
    }

    // If data exists, user has access
    return !!data;
  } catch (error) {
    console.error("[Middleware] Error checking user access:", error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate Limiting for API routes
  if (pathname.startsWith('/api/') && ratelimit) {
    const ip = getClientIP(request);
    
    // Skip rate limiting if we can't determine the client IP
    // This prevents all clients from being rate-limited as a single entity
    if (!ip) {
      console.warn('[Middleware] Could not determine client IP, skipping rate limit');
    } else {
      try {
        const { success, limit, reset, remaining } = await ratelimit.limit(ip);

        if (!success) {
          const retryAfter = Math.ceil((reset - Date.now()) / 1000);
          return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
              'Retry-After': retryAfter.toString(),
            },
          });
        }
      } catch (error) {
        console.warn('Rate limit failed, failing open:', error);
      }
    }
  }

  // 2. Protected Routes (Invite Verification)
  const protectedRoutes = ['/chat'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Server-side verification for protected routes
    try {
      // Step 1: Get authenticated user from request
      const authenticatedUser = await getAuthenticatedUser(request);
      
      if (!authenticatedUser || !authenticatedUser.id) {
        // Not authenticated - redirect to home page
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }

      const userId = authenticatedUser.id;

      // Step 2: Check if user has access in user_access table
      const hasAccess = await checkUserAccess(userId);
      
      if (!hasAccess) {
        // User doesn't have access - redirect to home page
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }

      // User is authenticated and has access - allow request
      return NextResponse.next();
    } catch (error) {
      console.error('[Middleware] Error verifying access:', error);
      // On error, redirect to home page for safety
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
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



