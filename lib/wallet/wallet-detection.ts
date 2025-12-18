/**
 * Unified Wallet Detection Service
 * 
 * Prevents duplicate wallet creation by checking for existing wallets from:
 * - Email/Social signup (Circle embedded wallets)
 * - Agent-created wallets
 * - Supabase stored wallets
 * 
 * This ensures users who sign up via email/social don't get duplicate wallets
 * when they interact with the agent.
 */

import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { loadWalletData, loadUserCredentials, getOrCreateSupabaseUser } from "@/lib/supabase-data";
import { getWalletByCircleId } from "@/lib/db/services/wallets";

export interface ExistingWalletInfo {
  walletId: string;
  walletAddress: string;
  userId: string;
  userToken: string;
  encryptionKey?: string;
  source: "signup" | "agent" | "supabase" | "circle";
}

export interface WalletDetectionResult {
  hasExistingWallet: boolean;
  wallet?: ExistingWalletInfo;
  needsCreation: boolean;
  error?: string;
}

/**
 * Check if user already has a wallet from any source
 * 
 * @param userId - Circle user ID
 * @param userToken - Circle user token (optional, for Circle API checks)
 * @param blockchain - Blockchain to check (default: ARC-TESTNET)
 * @returns WalletDetectionResult with existing wallet info or creation flag
 */
export async function detectExistingWallet(
  userId: string,
  userToken?: string,
  blockchain: string = "ARC-TESTNET"
): Promise<WalletDetectionResult> {
  try {
    // Strategy 1: Check Supabase preferences (agent-created or manually saved wallets)
    const supabaseWallet = await loadWalletData(userId);
    if (supabaseWallet.walletId && supabaseWallet.walletAddress) {
      console.log("[Wallet Detection] Found wallet in Supabase preferences:", {
        walletId: supabaseWallet.walletId,
        address: supabaseWallet.walletAddress.substring(0, 10) + "...",
      });

      // Load user credentials if available
      const credentials = await loadUserCredentials(userId);
      
      return {
        hasExistingWallet: true,
          wallet: {
            walletId: supabaseWallet.walletId,
            walletAddress: supabaseWallet.walletAddress,
            userId,
            userToken: credentials?.userToken || userToken || "",
            encryptionKey: credentials?.encryptionKey || undefined,
            source: "supabase",
          },
        needsCreation: false,
      };
    }

    // Strategy 2: Check Circle API directly (for embedded wallets from signup)
    if (userToken) {
      try {
        const client = getUserCircleClient();
        
        const walletsResponse = await (client as any).listWallets({
          userToken,
          blockchain,
        });

        const existingWallets = walletsResponse.data?.wallets || [];
        
        if (existingWallets.length > 0) {
          const wallet = existingWallets[0];
          console.log("[Wallet Detection] Found wallet via Circle API:", {
            walletId: wallet.id,
            address: wallet.address?.substring(0, 10) + "...",
            state: wallet.state,
          });

          // Save to Supabase for future lookups
          try {
            const supabaseUserId = await getOrCreateSupabaseUser(userId, wallet.address);
            await import("@/lib/supabase-data").then(({ saveWalletData }) =>
              saveWalletData(supabaseUserId, {
                walletId: wallet.id,
                walletAddress: wallet.address,
              })
            );
          } catch (saveError) {
            console.warn("[Wallet Detection] Failed to save wallet to Supabase:", saveError);
            // Continue anyway - wallet exists in Circle
          }

          return {
            hasExistingWallet: true,
            wallet: {
              walletId: wallet.id,
              walletAddress: wallet.address,
              userId,
              userToken,
              source: "circle",
            },
            needsCreation: false,
          };
        }
      } catch (circleError: any) {
        console.warn("[Wallet Detection] Circle API check failed:", circleError.message);
        // Continue to next strategy
      }
    }

    // Strategy 3: Check Supabase wallets table (database-backed wallets)
    try {
      const supabaseUserId = await getOrCreateSupabaseUser(userId);
      const walletRecord = await getWalletByCircleId(userId);
      
      if (walletRecord) {
        console.log("[Wallet Detection] Found wallet in Supabase wallets table:", {
          walletId: walletRecord.circle_wallet_id,
          address: walletRecord.address?.substring(0, 10) + "...",
        });

        const credentials = await loadUserCredentials(userId);
        
        return {
          hasExistingWallet: true,
          wallet: {
            walletId: walletRecord.circle_wallet_id,
            walletAddress: walletRecord.address,
            userId,
            userToken: credentials?.userToken || userToken || "",
            source: "supabase",
          },
          needsCreation: false,
        };
      }
    } catch (dbError: any) {
      console.warn("[Wallet Detection] Database check failed:", dbError.message);
      // Continue - will create new wallet
    }

    // No existing wallet found - needs creation
    console.log("[Wallet Detection] No existing wallet found - will create new one");
    return {
      hasExistingWallet: false,
      needsCreation: true,
    };
  } catch (error: any) {
    console.error("[Wallet Detection] Error detecting wallet:", error);
    return {
      hasExistingWallet: false,
      needsCreation: true,
      error: error.message || "Failed to detect existing wallet",
    };
  }
}

/**
 * Get or create wallet for user (unified entry point)
 * 
 * This function:
 * 1. Checks for existing wallets first
 * 2. Returns existing wallet if found
 * 3. Returns creation flag if none exists
 * 
 * @param userId - Circle user ID
 * @param userToken - Circle user token
 * @param blockchain - Blockchain to check/create on
 * @returns WalletDetectionResult
 */
export async function getOrDetectWallet(
  userId: string,
  userToken: string,
  blockchain: string = "ARC-TESTNET"
): Promise<WalletDetectionResult> {
  return detectExistingWallet(userId, userToken, blockchain);
}

