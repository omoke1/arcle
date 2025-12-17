/**
 * Transaction Amount Limits
 * 
 * Configurable transaction amount limits to prevent accidental large transfers
 */

import { NextRequest, NextResponse } from "next/server";

export interface TransactionLimitConfig {
  maxAmount?: number; // Maximum transaction amount in USDC
  minAmount?: number; // Minimum transaction amount in USDC
  dailyLimit?: number; // Daily limit per user
  weeklyLimit?: number; // Weekly limit per user
  errorMessage?: string;
}

const DEFAULT_LIMITS = {
  maxAmount: 100000, // $100,000 default max
  minAmount: 0.01, // $0.01 minimum
  dailyLimit: 1000000, // $1M daily limit
  weeklyLimit: 5000000, // $5M weekly limit
};

/**
 * Validate transaction amount against limits
 */
export function validateTransactionAmount(
  amount: string | number,
  config: TransactionLimitConfig = {}
): { valid: boolean; error?: string } {
  const limits = { ...DEFAULT_LIMITS, ...config };
  const amountNum = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(amountNum) || amountNum <= 0) {
    return {
      valid: false,
      error: "Invalid transaction amount",
    };
  }

  if (limits.minAmount && amountNum < limits.minAmount) {
    return {
      valid: false,
      error: `Minimum transaction amount is $${limits.minAmount}`,
    };
  }

  if (limits.maxAmount && amountNum > limits.maxAmount) {
    return {
      valid: false,
      error: config.errorMessage || `Maximum transaction amount is $${limits.maxAmount.toLocaleString()}. For larger amounts, please contact support.`,
    };
  }

  return { valid: true };
}

/**
 * Create transaction limit middleware
 */
export function withTransactionLimits(
  config: TransactionLimitConfig = {}
): (handler: (request: NextRequest) => Promise<NextResponse>) => (request: NextRequest) => Promise<NextResponse> {
  return (handler) => {
    return async (request: NextRequest) => {
      // Only validate POST requests with body
      if (request.method === "POST") {
        try {
          const body = await request.clone().json();
          const amount = body.amount || body.amountToSend || body.value;

          if (amount) {
            const validation = validateTransactionAmount(amount, config);
            if (!validation.valid) {
              return NextResponse.json(
                {
                  success: false,
                  error: validation.error,
                },
                { status: 400 }
              );
            }
          }
        } catch (error) {
          // If body parsing fails, let the handler deal with it
        }
      }

      return handler(request);
    };
  };
}

/**
 * Get user-specific limits (can be extended to fetch from database)
 */
export async function getUserLimits(userId?: string): Promise<TransactionLimitConfig> {
  // TODO: Fetch from database based on user tier/subscription
  // For now, return default limits
  return DEFAULT_LIMITS;
}

