/**
 * Request Size Limit Middleware
 * 
 * Prevents memory issues from large request payloads
 */

import { NextRequest, NextResponse } from "next/server";

export interface RequestSizeLimitConfig {
  maxSizeBytes: number; // Maximum request body size in bytes
  errorMessage?: string;
}

const DEFAULT_MAX_SIZE = 1024 * 1024; // 1 MB default

/**
 * Create request size limit middleware
 */
export function withRequestSizeLimit(
  config: RequestSizeLimitConfig
): (handler: (request: NextRequest) => Promise<NextResponse>) => (request: NextRequest) => Promise<NextResponse> {
  const maxSize = config.maxSizeBytes || DEFAULT_MAX_SIZE;

  return (handler) => {
    return async (request: NextRequest) => {
      const contentLength = request.headers.get("content-length");

      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > maxSize) {
          return NextResponse.json(
            {
              success: false,
              error: config.errorMessage || `Request body too large. Maximum size is ${maxSize / 1024 / 1024}MB.`,
            },
            { status: 413 }
          );
        }
      }

      // For streaming requests, we can't check size upfront
      // But we can limit the body reader
      return handler(request);
    };
  };
}

/**
 * Predefined size limits for different endpoints
 */
export const requestSizeLimits = {
  // Small payloads (JSON, form data)
  small: 100 * 1024, // 100 KB
  // Medium payloads (file uploads, large JSON)
  medium: 5 * 1024 * 1024, // 5 MB
  // Large payloads (file uploads, batch operations)
  large: 50 * 1024 * 1024, // 50 MB
  // Default
  default: DEFAULT_MAX_SIZE, // 1 MB
};

