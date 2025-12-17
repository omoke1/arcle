/**
 * API Middleware for Performance Tracking and Error Logging
 * 
 * Wraps API route handlers to automatically track performance and log errors
 */

import { NextRequest, NextResponse } from "next/server";
import { performanceMonitor } from "./performance-monitor";
import { errorLogger, ErrorCategory } from "./error-logger";

/**
 * Extract endpoint path from request
 */
function getEndpointPath(request: NextRequest): string {
  const url = new URL(request.url);
  return url.pathname;
}

/**
 * Wrap an API route handler with performance tracking and error logging
 */
export function withMonitoring<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  options: {
    category?: ErrorCategory;
    trackPerformance?: boolean;
  } = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  const { category = "api", trackPerformance = true } = options;

  return async (request: NextRequest) => {
    const startTime = Date.now();
    const endpoint = getEndpointPath(request);
    const method = request.method;

    try {
      const response = await handler(request);

      if (trackPerformance) {
        const responseTime = Date.now() - startTime;
        const statusCode = response.status;

        performanceMonitor.record({
          endpoint,
          method,
          responseTime,
          statusCode,
          error: statusCode >= 400,
        });
      }

      return response;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const statusCode = error?.status || error?.response?.status || 500;

      // Log error
      errorLogger.log(error, {
        severity: statusCode >= 500 ? "high" : statusCode >= 400 ? "medium" : "low",
        category,
        context: {
          endpoint,
          method,
          statusCode,
          responseTime,
        },
      });

      // Record performance
      if (trackPerformance) {
        performanceMonitor.record({
          endpoint,
          method,
          responseTime,
          statusCode,
          error: true,
        });
      }

      // Re-throw to let Next.js handle it
      throw error;
    }
  };
}

/**
 * Create a monitored API route handler
 * 
 * Usage:
 * ```typescript
 * export const GET = withMonitoring(async (request: NextRequest) => {
 *   // Your handler code
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function createMonitoredHandler<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  options?: {
    category?: ErrorCategory;
    trackPerformance?: boolean;
  }
): (request: NextRequest) => Promise<NextResponse<T>> {
  return withMonitoring(handler, options);
}

