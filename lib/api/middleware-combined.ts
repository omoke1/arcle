/**
 * Combined API Middleware
 * 
 * Combines rate limiting, CORS, request size limits, and transaction limits
 */

import { NextRequest, NextResponse } from "next/server";
import { withRateLimit, rateLimitConfigs } from "./rate-limit-middleware";
import { withCORS, developmentCORS } from "./cors-middleware";
import { withRequestSizeLimit, requestSizeLimits } from "./request-size-limit";
import { withTransactionLimits } from "./transaction-limits";

/**
 * Apply all security middlewares to an API route
 */
export function withSecurityMiddleware<T = any>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  options: {
    rateLimit?: typeof rateLimitConfigs[keyof typeof rateLimitConfigs] | null;
    cors?: boolean;
    maxRequestSize?: number;
    transactionLimits?: boolean;
  } = {}
): (request: NextRequest) => Promise<NextResponse<T>> {
  let wrappedHandler: (request: NextRequest) => Promise<NextResponse<T>> = handler;

  // Apply rate limiting
  if (options.rateLimit !== null && options.rateLimit) {
    wrappedHandler = withRateLimit(options.rateLimit)(wrappedHandler) as (request: NextRequest) => Promise<NextResponse<T>>;
  }

  // Apply CORS
  if (options.cors !== false) {
    wrappedHandler = withCORS(developmentCORS)(wrappedHandler) as (request: NextRequest) => Promise<NextResponse<T>>;
  }

  // Apply request size limit
  if (options.maxRequestSize) {
    wrappedHandler = withRequestSizeLimit({
      maxSizeBytes: options.maxRequestSize,
    })(wrappedHandler) as (request: NextRequest) => Promise<NextResponse<T>>;
  }

  // Apply transaction limits
  if (options.transactionLimits) {
    wrappedHandler = withTransactionLimits()(wrappedHandler) as (request: NextRequest) => Promise<NextResponse<T>>;
  }

  return wrappedHandler;
}

/**
 * Pre-configured middleware for common route types
 */
export const routeMiddlewares = {
  // Financial transactions
  transaction: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.transactions,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
      transactionLimits: true,
    }),

  // Bridge operations
  bridge: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.bridge,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
      transactionLimits: true,
    }),

  // User operations
  user: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.users,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
    }),

  // Wallet operations
  wallet: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.wallets,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
    }),

  // Chat/AI
  chat: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.chat,
      cors: true,
      maxRequestSize: requestSizeLimits.medium,
    }),

  // DeFi operations
  defi: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.defi,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
      transactionLimits: true,
    }),

  // Read-only endpoints
  readOnly: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.readOnly,
      cors: true,
      maxRequestSize: requestSizeLimits.small,
    }),

  // General API
  general: (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withSecurityMiddleware(handler, {
      rateLimit: rateLimitConfigs.general,
      cors: true,
      maxRequestSize: requestSizeLimits.default,
    }),
};

