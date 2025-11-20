/**
 * Circle Balance API Routes
 * 
 * Handles wallet balance queries for USDC on Arc
 * Based on Circle API: GET /v1/w3s/wallets/{walletId}/balances
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";
import { getArcClient, getUSDCAddress, arcUtils } from "@/lib/arc";
import { erc20Abi } from "viem";
import { getMultiCurrencyBalance } from "@/lib/fx/multi-currency-balance";

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

interface CircleBalanceResponse {
  data: Array<{
    tokenId: string;
    amount: string;
    updateDate: string;
  }>;
}

/**
 * GET /api/circle/balance
 * Get wallet balance via Circle API or directly from Arc blockchain
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");
    const address = searchParams.get("address"); // Wallet address from Circle
    const useBlockchain = searchParams.get("useBlockchain") === "true"; // Optional: query directly from blockchain
    const multiCurrency = searchParams.get("multiCurrency") === "true"; // Return all currencies
    const userId = searchParams.get("userId"); // Optional: for user-controlled wallets
    const userToken = searchParams.get("userToken"); // Optional: for user-controlled wallets

    if (!walletId && !address) {
      return NextResponse.json(
        { success: false, error: "walletId or address is required" },
        { status: 400 }
      );
    }
    
    // If multi-currency is requested and walletId is provided, return all currencies
    if (multiCurrency && walletId && !useBlockchain) {
      try {
        const multiBalance = await getMultiCurrencyBalance(walletId);
        return NextResponse.json({
          success: true,
          data: multiBalance,
        });
      } catch (error) {
        console.error("Error fetching multi-currency balance:", error);
        // Fall through to single currency logic
      }
    }

    // Option 1: Query via Circle API (recommended, but requires auth for user-controlled wallets)
    // If address is provided and useBlockchain is true, skip API and go straight to blockchain query
    if (walletId && !useBlockchain && !address) {
      let balances: CircleBalanceResponse | null = null;
      let error: any = null;

      // For user-controlled wallets, try user-specific endpoint first
      if (userToken || userId) {
        try {
          // User-controlled wallets endpoint
          const userEndpoint = userToken 
            ? `/v1/w3s/user/wallets/${walletId}/balances`
            : `/v1/w3s/user/wallets/${walletId}/balances`;
          
          // Note: Circle API might require userToken in headers, but we'll try the endpoint first
          // If it fails, fall through to regular endpoints
          console.log(`[Balance API] Trying user-controlled wallets endpoint for walletId: ${walletId}`);
          
          // For now, fall through to regular endpoints since userToken auth is handled differently
          // The regular endpoints should work if the wallet is accessible
        } catch (userError: any) {
          console.log(`[Balance API] User-controlled endpoint not available, trying regular endpoints...`);
        }
      }

      // Try legacy endpoints first for compatibility
      try {
        balances = await circleApiRequest<CircleBalanceResponse>(
          `/v1/w3s/developer/wallets/${walletId}/balances?blockchain=ARC-TESTNET`,
          {
            method: "GET",
          }
        );
      } catch (devError: any) {
        console.log(`[Balance API] Developer wallets endpoint failed, trying regular wallets endpoint...`);
        error = devError;
        
        // Fallback to regular wallets endpoint
        try {
          balances = await circleApiRequest<CircleBalanceResponse>(
            `/v1/w3s/wallets/${walletId}/balances`,
            {
              method: "GET",
            }
          );
        } catch (regularError: any) {
          console.error(`[Balance API] Both endpoints failed:`, regularError);
          error = regularError;
          
          // If address is provided, fallback to blockchain query
          if (address) {
            console.log(`[Balance API] Falling back to blockchain query for address: ${address}`);
            // Will be handled by Option 2 below
          } else {
            throw error;
          }
        }
      }

      // If we got balances from API, process them
      if (balances && balances.data) {
        // Handle different response formats
        // Circle API can return: { data: [...] } or { data: { tokenBalances: [...] } }
        const tokenBalances = Array.isArray(balances.data)
          ? balances.data
          : (balances.data as any)?.tokenBalances || [];
        
        // Find USDC balance - ensure we return real data, never mock
        const usdcAddress = getUSDCAddress();
        const usdcBalance = tokenBalances.find(
          (b: any) => {
            const tokenId = b.tokenId || b.token?.id || b.token?.address;
            return tokenId && (
              tokenId === usdcAddress || 
              tokenId.toLowerCase() === usdcAddress.toLowerCase()
            );
          }
        );
        
        // If no USDC balance found, return 0 (real zero, not mock)
        if (!usdcBalance) {
          return NextResponse.json({
            success: true,
            data: {
              walletId,
              balance: "0.00",
              balanceRaw: "0",
              token: "USDC",
              network: "ARC",
              lastUpdated: new Date().toISOString(),
            },
          });
        }

        // Extract amount - handle different response structures
        const amount = usdcBalance.amount || usdcBalance.tokenBalance?.amount || "0";
        
        return NextResponse.json({
          success: true,
          data: {
            walletId,
            balance: arcUtils.formatUSDC(BigInt(amount)),
            balanceRaw: amount,
            token: "USDC",
            network: "ARC",
            lastUpdated: usdcBalance.updateDate || new Date().toISOString(),
          },
        });
      }
    }

    // Option 2: Query directly from Arc blockchain
    if (address) {
      if (!arcUtils.isValidAddress(address)) {
        return NextResponse.json(
          { success: false, error: "Invalid address format" },
          { status: 400 }
        );
      }

      const client = getArcClient();
      const usdcAddress = getUSDCAddress();

      const balance = await client.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      const formattedBalance = arcUtils.formatUSDC(balance);

      return NextResponse.json({
        success: true,
        data: {
          address,
          balance: formattedBalance,
          balanceRaw: balance.toString(),
          token: "USDC",
          network: "ARC",
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balance",
      },
      { status: 500 }
    );
  }
}
