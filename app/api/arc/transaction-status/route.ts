/**
 * Arc Network Transaction Status API
 * 
 * Check transaction status on Arc blockchain
 */

import { NextRequest, NextResponse } from "next/server";
import { getArcClient, arcUtils } from "@/lib/arc";

/**
 * GET /api/arc/transaction-status
 * Get transaction status and receipt
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get("hash");

    if (!txHash) {
      return NextResponse.json(
        { success: false, error: "transaction hash is required" },
        { status: 400 }
      );
    }

    if (!arcUtils.isValidAddress(txHash)) {
      return NextResponse.json(
        { success: false, error: "Invalid transaction hash format" },
        { status: 400 }
      );
    }

    const client = getArcClient();

    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    // Get transaction details
    const transaction = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        hash: txHash,
        status: receipt.status === "success" ? "confirmed" : "failed",
        blockNumber: receipt.blockNumber.toString(),
        blockHash: receipt.blockHash,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value.toString(),
        gasUsed: receipt.gasUsed.toString(),
        confirmations: receipt.status === "success" ? 1 : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching transaction status:", error);
    
    // Transaction might not exist yet (pending)
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({
        success: true,
        data: {
          status: "pending",
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transaction status",
      },
      { status: 500 }
    );
  }
}

