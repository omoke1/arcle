/**
 * Module Installation API
 * 
 * Handles installation of SessionKeyModule on Circle MSCA wallets
 */

import { NextRequest, NextResponse } from "next/server";
import { installModule, isModuleInstalled, getSessionKeyModuleAddress } from "@/lib/wallet/msca/moduleIntegration";
import { isMSCAEnabled } from "@/lib/config/featureFlags";

export async function POST(request: NextRequest) {
  try {
    if (!isMSCAEnabled()) {
      return NextResponse.json(
        { success: false, error: "MSCA is not enabled" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { walletId, userId, userToken, chainId } = body;

    if (!walletId || !userId || !userToken || !chainId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: walletId, userId, userToken, chainId" },
        { status: 400 }
      );
    }

    // Get module address for the chain
    const moduleAddress = getSessionKeyModuleAddress(chainId);
    if (!moduleAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: `SessionKeyModule not deployed on chain ${chainId}. Please deploy the module first.` 
        },
        { status: 400 }
      );
    }

    // Check if module is already installed
    // TODO: Get wallet address from Circle API
    const walletAddress = body.walletAddress; // Should be provided or fetched
    if (walletAddress) {
      const alreadyInstalled = await isModuleInstalled(walletAddress, moduleAddress, chainId);
      if (alreadyInstalled) {
        return NextResponse.json({
          success: true,
          message: "Module already installed",
          moduleAddress,
        });
      }
    }

    // Install module
    const result = await installModule(walletId, userId, userToken, moduleAddress, chainId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        moduleAddress,
        challengeId: result.challengeId,
        message: "Module installation initiated. User approval required.",
      });
    }

    return NextResponse.json(
      { success: false, error: result.error || "Failed to install module" },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("[Module Installation API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get("walletAddress");
    const chainId = searchParams.get("chainId");

    if (!walletAddress || !chainId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: walletAddress, chainId" },
        { status: 400 }
      );
    }

    const moduleAddress = getSessionKeyModuleAddress(chainId);
    if (!moduleAddress) {
      return NextResponse.json({
        success: false,
        installed: false,
        error: "Module not deployed on this chain",
      });
    }

    const installed = await isModuleInstalled(walletAddress, moduleAddress, chainId);

    return NextResponse.json({
      success: true,
      installed,
      moduleAddress: installed ? moduleAddress : null,
    });
  } catch (error: any) {
    console.error("[Module Installation API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

