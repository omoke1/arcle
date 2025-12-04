/**
 * API Route: Create Agent Session Key
 * 
 * This route handles session key creation server-side since Circle SDK
 * uses Node.js modules (zlib) that aren't available in the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAgentSessionKey } from "@/core/sessionKeys/agentSessionKeys";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, userId, userToken, agent, duration, autoRenew, spendingLimit } = body;

    // Validate required fields
    if (!walletId || !userId || !userToken || !agent) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: walletId, userId, userToken, agent" },
        { status: 400 }
      );
    }

    console.log("[API] Creating agent session key:", { walletId, userId, agent, hasUserToken: !!userToken });
    
    // Create agent session key (server-side)
    const result = await createAgentSessionKey({
      walletId,
      userId,
      userToken,
      agent,
      duration: duration || 7 * 24 * 60 * 60, // Default 7 days
      autoRenew: autoRenew !== undefined ? autoRenew : true,
      spendingLimit,
    });

    console.log("[API] Session key creation result:", { 
      success: result.success, 
      hasSessionKeyId: !!result.sessionKeyId,
      hasChallengeId: !!result.challengeId,
      error: result.error 
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        sessionKeyId: result.sessionKeyId,
        challengeId: result.challengeId,
      });
    } else {
      console.error("[API] Session key creation failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error || "Unknown error creating session key" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[API] Exception creating agent session key:", error);
    console.error("[API] Error stack:", error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Failed to create agent session key",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

