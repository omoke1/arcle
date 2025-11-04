/**
 * Circle Transactions API Routes
 * 
 * Handles transaction creation and status tracking
 * Based on Circle API: POST /v1/w3s/wallets/{walletId}/transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";
import { getUSDCAddress, arcUtils } from "@/lib/arc";

interface CreateTransactionRequest {
  idempotencyKey?: string;
  walletId: string;
  destinationAddress: string;
  amount: string; // Amount in USDC (e.g., "10.50")
  tokenId?: string; // USDC token address on Arc (optional, will use default)
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}

interface CircleTransactionResponse {
  data: {
    id: string;
    walletId: string;
    idempotencyKey: string;
    destination: {
      type: string;
      address: string;
    };
    amount: {
      amount: string;
      currency: string;
    };
    fee: {
      amount: string;
      currency: string;
    };
    status: "pending" | "confirmed" | "failed";
    createDate: string;
    updateDate: string;
  };
}

/**
 * POST /api/circle/transactions
 * Create a new transaction (send USDC on Arc)
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateTransactionRequest = await request.json();
    
    const { walletId, destinationAddress, amount, idempotencyKey, tokenId, feeLevel } = body;

    if (!walletId || !destinationAddress || !amount) {
      return NextResponse.json(
        {
          success: false,
          error: "walletId, destinationAddress, and amount are required",
        },
        { status: 400 }
      );
    }

    if (!arcUtils.isValidAddress(destinationAddress)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid destination address format",
        },
        { status: 400 }
      );
    }

    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = arcUtils.parseUSDC(amount).toString();

    // Use USDC address from Arc config if not provided
    const tokenAddress = tokenId || getUSDCAddress();

    // Create transaction via Circle API
    const transaction = await circleApiRequest<CircleTransactionResponse>(
      `/v1/w3s/wallets/${walletId}/transactions`,
      {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: idempotencyKey || crypto.randomUUID(),
          destinationAddress,
          amount: {
            amount: amountInSmallestUnit,
            currency: "USDC",
          },
          tokenId: tokenAddress,
          feeLevel: feeLevel || "MEDIUM",
          // Note: For ERC-4337 wallets, this will create a user operation
        }),
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: transaction.data.id,
        hash: transaction.data.id, // Circle uses transaction ID
        walletId: transaction.data.walletId,
        from: walletId,
        to: destinationAddress,
        amount: arcUtils.formatUSDC(BigInt(transaction.data.amount.amount)),
        amountRaw: transaction.data.amount.amount,
        token: "USDC",
        network: "ARC",
        status: transaction.data.status,
        fee: transaction.data.fee.amount,
        createdAt: transaction.data.createDate,
        updatedAt: transaction.data.updateDate,
      },
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create transaction",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circle/transactions
 * Get transaction status or list transactions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    const walletId = searchParams.get("walletId");
    const limit = searchParams.get("limit") || "10";

    if (!transactionId && !walletId) {
      return NextResponse.json(
        { success: false, error: "transactionId or walletId is required" },
        { status: 400 }
      );
    }

    let endpoint = "";
    if (transactionId) {
      endpoint = `/v1/w3s/transactions/${transactionId}`;
    } else if (walletId) {
      endpoint = `/v1/w3s/wallets/${walletId}/transactions?limit=${limit}`;
    }

    try {
      const transactions = await circleApiRequest(endpoint, {
        method: "GET",
      });

      return NextResponse.json({
        success: true,
        data: transactions,
      });
    } catch (apiError: any) {
      // Handle 404 gracefully - wallet might not have transactions yet
      // or developer-controlled wallets might use different endpoint
      if (apiError.status === 404 || apiError.message?.includes("Resource not found")) {
        // Return empty array for no transactions found
        return NextResponse.json({
          success: true,
          data: {
            data: [],
          },
        });
      }
      throw apiError; // Re-throw other errors
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}
