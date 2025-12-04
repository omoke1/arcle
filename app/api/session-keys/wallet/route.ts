/**
 * API Route: Get Wallet Session Keys
 * 
 * This route handles session key retrieval server-side to avoid
 * Vercel KV environment variable issues in the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { getWalletSessionKeys, getSessionKey } from "@/lib/wallet/sessionKeys/sessionStorage";
import { isSessionExpired } from "@/lib/wallet/sessionKeys/sessionPermissions";
import type { CircleSessionKey } from "@/lib/wallet/sessionKeys/sessionPermissions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");
    const userId = searchParams.get("userId");
    const userToken = searchParams.get("userToken");
    const agentId = searchParams.get("agentId");

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "Missing walletId" },
        { status: 400 }
      );
    }

    // Get all session keys for this wallet
    const sessionKeyIds = await getWalletSessionKeys(walletId);

    // If agentId is provided, filter for that agent
    if (agentId) {
      const agentSessionKeys: CircleSessionKey[] = [];
      
      for (const sessionKeyId of sessionKeyIds) {
        const sessionKey = await getSessionKey(sessionKeyId);
        if (
          sessionKey &&
          sessionKey.agentId === agentId &&
          !isSessionExpired(sessionKey)
        ) {
          agentSessionKeys.push(sessionKey);
        }
      }

      return NextResponse.json({
        success: true,
        sessionKeys: agentSessionKeys,
      });
    }

    // Return all session keys for the wallet
    const sessionKeys: CircleSessionKey[] = [];
    for (const sessionKeyId of sessionKeyIds) {
      const sessionKey = await getSessionKey(sessionKeyId);
      if (sessionKey && !isSessionExpired(sessionKey)) {
        sessionKeys.push(sessionKey);
      }
    }

    return NextResponse.json({
      success: true,
      sessionKeys,
    });
  } catch (error: any) {
    console.error("[API] Error getting wallet session keys:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get wallet session keys" },
      { status: 500 }
    );
  }
}

