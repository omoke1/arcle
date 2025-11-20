/**
 * Token Refresh API Endpoint
 * 
 * Refreshes user tokens for User-Controlled Wallets.
 * 
 * POST /api/circle/users/refresh
 * 
 * Body:
 *   - userId: string (required)
 *   - refreshToken: string (optional, if available will use refreshUserToken)
 *   - deviceId: string (optional, required if using refreshToken)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, refreshToken, deviceId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    const client = getUserCircleClient();

    // Note: refreshUserToken requires userToken which may be expired
    // For simplicity and reliability, we always use createUserToken
    // which works as long as we have userId
    // This is the recommended approach per Circle docs
    console.log("[TokenRefresh] Creating new token with createUserToken...", { userId });
    try {
      const response = await client.createUserToken({ userId });

      if (!response.data?.userToken) {
        return NextResponse.json(
          { success: false, error: "Failed to create token" },
          { status: 500 }
        );
      }

      console.log("[TokenRefresh] ✅ New token created with createUserToken");
      return NextResponse.json({
        success: true,
        data: {
          userToken: response.data.userToken,
          encryptionKey: response.data.encryptionKey,
          refreshToken: (response.data as any).refreshToken, // May or may not be present
        },
      });
    } catch (createError: any) {
      const status = createError.response?.status || createError.status;
      const message = createError.response?.data?.message || createError.message;

      console.error("[TokenRefresh] createUserToken failed:", {
        status,
        message,
      });

      return NextResponse.json(
        {
          success: false,
          error: message || "Failed to refresh token",
          details: createError.response?.data,
        },
        { status: status || 500 }
      );
    }
  } catch (error: any) {
    console.error("[TokenRefresh] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to refresh token",
      },
      { status: 500 }
    );
  }
}

