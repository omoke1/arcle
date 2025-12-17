/**
 * CORS Middleware
 * 
 * Configurable CORS middleware for API routes
 */

import { NextRequest, NextResponse } from "next/server";

export interface CORSConfig {
  allowedOrigins?: string[]; // Specific origins, or ["*"] for all
  allowedMethods?: string[]; // HTTP methods
  allowedHeaders?: string[]; // Request headers
  exposedHeaders?: string[]; // Headers exposed to client
  maxAge?: number; // Preflight cache time in seconds
  credentials?: boolean; // Allow credentials
}

const DEFAULT_CONFIG: Required<CORSConfig> = {
  allowedOrigins: ["*"], // Allow all by default (can be restricted)
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-arcle-user-id"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
  maxAge: 86400, // 24 hours
  credentials: false,
};

/**
 * Create CORS middleware
 */
export function withCORS(
  config: CORSConfig = {}
): (handler: (request: NextRequest) => Promise<NextResponse>) => (request: NextRequest) => Promise<NextResponse> {
  const corsConfig = { ...DEFAULT_CONFIG, ...config };

  return (handler) => {
    return async (request: NextRequest) => {
      const origin = request.headers.get("origin");

      // Handle preflight OPTIONS request
      if (request.method === "OPTIONS") {
        const headers = new Headers();

        // Check if origin is allowed
        if (corsConfig.allowedOrigins.includes("*") || (origin && corsConfig.allowedOrigins.includes(origin))) {
          if (origin) {
            headers.set("Access-Control-Allow-Origin", origin);
          } else if (corsConfig.allowedOrigins.includes("*")) {
            headers.set("Access-Control-Allow-Origin", "*");
          }

          headers.set("Access-Control-Allow-Methods", corsConfig.allowedMethods.join(", "));
          headers.set("Access-Control-Allow-Headers", corsConfig.allowedHeaders.join(", "));
          headers.set("Access-Control-Expose-Headers", corsConfig.exposedHeaders.join(", "));
          headers.set("Access-Control-Max-Age", String(corsConfig.maxAge));

          if (corsConfig.credentials) {
            headers.set("Access-Control-Allow-Credentials", "true");
          }
        }

        return new NextResponse(null, { status: 204, headers });
      }

      // Handle actual request
      const response = await handler(request);

      // Add CORS headers to response
      if (corsConfig.allowedOrigins.includes("*") || (origin && corsConfig.allowedOrigins.includes(origin))) {
        if (origin) {
          response.headers.set("Access-Control-Allow-Origin", origin);
        } else if (corsConfig.allowedOrigins.includes("*")) {
          response.headers.set("Access-Control-Allow-Origin", "*");
        }

        response.headers.set("Access-Control-Expose-Headers", corsConfig.exposedHeaders.join(", "));

        if (corsConfig.credentials) {
          response.headers.set("Access-Control-Allow-Credentials", "true");
        }
      }

      return response;
    };
  };
}

/**
 * Production-ready CORS config (restrictive)
 */
export const productionCORS = {
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["*"], // Set in env
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "x-arcle-user-id"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  maxAge: 86400,
  credentials: false,
};

/**
 * Development CORS config (permissive)
 */
export const developmentCORS = {
  allowedOrigins: ["*"],
  allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"],
  exposedHeaders: ["*"],
  maxAge: 86400,
  credentials: false,
};

