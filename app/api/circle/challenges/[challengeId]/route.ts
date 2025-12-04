/**
 * Challenge Status API Route
 * Retrieves the status of a Circle challenge, including signatures for EIP-712 signing challenges
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";

export async function GET(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  try {
    const challengeId = params.challengeId;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const userToken = searchParams.get("userToken");

    if (!challengeId) {
      return NextResponse.json(
        { success: false, error: "Challenge ID is required" },
        { status: 400 }
      );
    }

    if (!userToken || !userId) {
      return NextResponse.json(
        { success: false, error: "User token and user ID are required" },
        { status: 400 }
      );
    }

    console.log(`[Challenge API] Getting status for challenge: ${challengeId}`);

    // Fetch challenge details
    // NOTE: Circle's REST API doesn't expose challenge endpoints for User-Controlled Wallets
    // Challenges are handled through the PIN widget, and status should be checked via transaction status
    let signature: string | null = null;
    let challengeStatus: string = "PENDING";
    let transactionId: string | undefined;
    let transactionHash: string | undefined;
    
    try {
      // Try REST API first (may not work for User-Controlled Wallets)
      const { circleApiRequest } = await import("@/lib/circle");
      
      try {
        const response = await circleApiRequest<any>(
          `/v1/w3s/challenges/${challengeId}`,
          {
            method: "GET",
            headers: {
              "X-User-Token": userToken,
            },
          }
        );

        const data = response.data || response;
      
      // Log full response structure for debugging
      console.log(`[Challenge API] Full challenge response:`, {
        status: data?.status,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        challengeType: data?.type,
        challengeId: data?.id,
      });

      challengeStatus = data?.status || "PENDING";
      transactionId = data?.transactionId;
      transactionHash = data?.transactionHash;
      
      // Log the full response structure for debugging
      console.log(`[Challenge API] Checking for signature. Status: ${challengeStatus}, type: ${data?.type}`);
      console.log(`[Challenge API] Full response.data structure:`, JSON.stringify({
        hasData: !!data,
        dataType: typeof data,
        dataKeys: data ? Object.keys(data) : [],
        dataValue: data?.data,
        dataDataType: typeof data?.data,
        dataDataKeys: data?.data && typeof data?.data === 'object' ? Object.keys(data.data) : [],
      }, null, 2));
      
      // Try all possible locations for the signature (regardless of status)
      // Sometimes the signature is available before status updates to COMPLETE
      signature = data?.signature || 
                  data?.data?.signature ||
                  data?.result?.signature ||
                  data?.response?.signature ||
                  data?.challenge?.signature ||
                  (data?.data && typeof data.data === 'string' ? data.data : null) || // Sometimes signature is the data itself
                  null;
      
      // If still no signature, check nested objects more thoroughly
      if (!signature && data?.data && typeof data.data === 'object') {
        const nestedData = data.data as any;
        signature = nestedData?.signature || 
                   nestedData?.result?.signature ||
                   nestedData?.response?.signature ||
                   nestedData?.challenge?.signature ||
                   null;
      }
      
      // For EIP-712 signing challenges, the signature might be in response.data.data as a direct string
      // or in response.data itself if it's a signing challenge
      if (!signature && data?.data) {
        // If data.data is a string and looks like a signature (starts with 0x and is 132 chars)
        if (typeof data.data === 'string' && data.data.startsWith('0x') && data.data.length >= 130) {
          signature = data.data;
        }
      }
      
      // If we found a signature but status is still PENDING, log it (this is expected for signing challenges)
      if (signature && challengeStatus === "PENDING") {
        console.log(`[Challenge API] ⚠️ Found signature but status is still PENDING - this is normal for signing challenges`);
      }

        console.log(`[Challenge API] Challenge status: ${challengeStatus}, has signature: ${!!signature}`);
        if (signature) {
          console.log(`[Challenge API] Signature length: ${signature.length}`);
        }
      } catch (restError: any) {
        // REST API endpoint doesn't exist for User-Controlled Wallets (404 is expected)
        if (restError.response?.status === 404 || restError.message?.includes('Resource not found')) {
          console.log(`[Challenge API] Challenge endpoint not available for User-Controlled Wallets (expected)`);
          console.log(`[Challenge API] For contract executions, check transaction status instead`);
          console.log(`[Challenge API] For EIP-712 signing, signature is returned immediately after user signs`);
          
          // For User-Controlled Wallets, challenges are handled through:
          // 1. Contract executions: Check transaction status via /api/circle/transactions?transactionId=...
          // 2. EIP-712 signing: Signature is available immediately after PIN widget completion
          // Return a helpful response indicating the challenge exists but status must be checked differently
          challengeStatus = "PENDING"; // Assume pending if we can't check
        } else {
          throw restError; // Re-throw if it's a different error
        }
      }
    } catch (error: any) {
      console.warn(`[Challenge API] Error retrieving challenge: ${error.message}`);
      // Continue without signature - status is still useful
    }

    return NextResponse.json({
      success: true,
      data: {
        status: challengeStatus,
        challengeId,
        transactionId,
        transactionHash,
        signature, // Include signature if available
        // For User-Controlled Wallets: Challenge status is not directly queryable
        // For contract executions: Check transaction status via /api/circle/transactions?transactionId=...
        // For EIP-712 signing: Signature is returned immediately after PIN widget completion
        note: challengeStatus === "PENDING" && !signature 
          ? "Challenge endpoint not available for User-Controlled Wallets. Check transaction status or wait for PIN widget callback."
          : undefined,
      },
    });
  } catch (error: any) {
    console.error("[Challenge API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get challenge status",
      },
      { status: 500 }
    );
  }
}

