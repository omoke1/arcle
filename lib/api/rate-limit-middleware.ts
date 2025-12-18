/**
 * Rate Limiting Middleware
 * 
 * Reusable middleware for adding rate limiting to API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./rate-limit";

export interface RateLimitConfig {
  limit: number; // Max requests
  windowSeconds: number; // Time window in seconds
  keyPrefix: string; // Prefix for rate limit key
  getIdentifier?: (request: NextRequest) => string; // Custom identifier function
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Create rate limiting middleware
 */
export function withRateLimit(
  config: RateLimitConfig
): (handler: (request: NextRequest) => Promise<NextResponse>) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      const identifier = config.getIdentifier
        ? config.getIdentifier(request)
        : getClientIP(request);
      
      const key = `${config.keyPrefix}:${identifier}`;
      const rl = await rateLimit(key, config.limit, config.windowSeconds);

      if (!rl.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded. Please wait a bit and try again.",
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": String(config.limit),
              "X-RateLimit-Remaining": String(rl.remaining),
              "X-RateLimit-Reset": String(rl.reset),
              "Retry-After": String(Math.ceil((rl.reset - Date.now() / 1000))),
            },
          }
        );
      }

      // Add rate limit headers to successful responses
      const response = await handler(request);
      response.headers.set("X-RateLimit-Limit", String(config.limit));
      response.headers.set("X-RateLimit-Remaining", String(rl.remaining));
      response.headers.set("X-RateLimit-Reset", String(rl.reset));

      return response;
    };
  };
}

/**
 * Predefined rate limit configs for common use cases
 */
export const rateLimitConfigs = {
  // Critical financial operations
  transactions: {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: "circle:transactions",
  },
  bridge: {
    limit: 10,
    windowSeconds: 60,
    keyPrefix: "circle:bridge",
  },
  // User operations
  users: {
    limit: 20,
    windowSeconds: 60,
    keyPrefix: "circle:users",
  },
  wallets: {
    limit: 30,
    windowSeconds: 60,
    keyPrefix: "circle:wallets",
  },
  // Chat/AI
  chat: {
    limit: 60,
    windowSeconds: 60,
    keyPrefix: "chat",
  },
  // DeFi operations
  defi: {
    limit: 30,
    windowSeconds: 60,
    keyPrefix: "defi",
  },
  // General API
  general: {
    limit: 100,
    windowSeconds: 60,
    keyPrefix: "api",
  },
  // Read-only operations
  readOnly: {
    limit: 200,
    windowSeconds: 60,
    keyPrefix: "read",
  },
};


