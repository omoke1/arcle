/**
 * Session Key API Route
 * 
 * Handles session key creation, renewal, revocation, and status
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  getActiveSession,
  renewSession,
  revokeSession,
  isSessionValid,
} from "@/lib/wallet/sessionKeys/sessionManager";
import { isSessionKeysEnabled } from "@/lib/config/featureFlags";
import { logAuditEntry } from "@/lib/wallet/sessionKeys/auditLogger";

export async function POST(request: NextRequest) {
  try {
    if (!isSessionKeysEnabled()) {
      return NextResponse.json(
        { success: false, error: "Session keys are not enabled" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    // Create session
    if (action === "create") {
      const {
        walletId,
        userId,
        userToken,
        allowedActions,
        spendingLimit,
        duration,
        autoRenew,
        allowedChains,
        allowedTokens,
        maxAmountPerTransaction,
      } = body;

      if (!walletId || !userId || !userToken || !allowedActions || !spendingLimit || !duration) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      const result = await createSession({
        walletId,
        userId,
        userToken,
        allowedActions,
        spendingLimit,
        duration,
        autoRenew,
        allowedChains,
        allowedTokens,
        maxAmountPerTransaction,
      });

      if (result.success && result.sessionKey) {
        // Log audit entry
        await logAuditEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          sessionKeyId: result.sessionKey.sessionKeyId,
          walletId,
          userId,
          action: "session_create",
          success: true,
          executedViaSessionKey: false,
          metadata: {
            allowedActions,
            spendingLimit,
            duration,
          },
        });
      }

      return NextResponse.json(result);
    }

    // Renew session
    if (action === "renew") {
      const { sessionKeyId, userToken, walletId, newDuration } = body;

      if (!sessionKeyId || !userToken || !walletId || !newDuration) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      const result = await renewSession(sessionKeyId, userToken, walletId, newDuration);

      if (result.success) {
        await logAuditEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          sessionKeyId,
          walletId: body.walletId,
          userId: body.userId,
          action: "session_renew",
          success: true,
          executedViaSessionKey: false,
        });
      }

      return NextResponse.json(result);
    }

    // Revoke session
    if (action === "revoke") {
      const { sessionKeyId, userToken, walletId, userId } = body;

      if (!sessionKeyId || !userToken || !walletId) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      const result = await revokeSession(sessionKeyId, userToken, walletId, userId);

      if (result.success) {
        await logAuditEntry({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          sessionKeyId,
          walletId,
          userId: userId || "unknown",
          action: "session_revoke",
          success: true,
          executedViaSessionKey: false,
        });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Session API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isSessionKeysEnabled()) {
      return NextResponse.json(
        { success: false, error: "Session keys are not enabled" },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const walletId = searchParams.get("walletId");
    const userId = searchParams.get("userId");
    const userToken = searchParams.get("userToken");
    const sessionKeyId = searchParams.get("sessionKeyId");

    if (!walletId || !userId || !userToken) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: walletId, userId, userToken" },
        { status: 400 }
      );
    }

    // Get active session
    if (!sessionKeyId) {
      const session = await getActiveSession(walletId, userId, userToken);
      return NextResponse.json({
        success: true,
        sessionKey: session,
      });
    }

    // Check if specific session is valid
    const isValid = await isSessionValid(sessionKeyId, userToken, walletId);
    return NextResponse.json({
      success: true,
      valid: isValid,
    });
  } catch (error: any) {
    console.error("[Session API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

