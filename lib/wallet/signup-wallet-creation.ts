/**
 * Wallet Creation After Signup
 * 
 * After social/email signup, we need to:
 * 1. Check if wallet already exists
 * 2. If not, create wallet automatically
 * 3. Save wallet info to Supabase
 * 
 * This ensures users who sign up via social/email get a wallet immediately.
 */

import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { saveWalletData, getOrCreateSupabaseUser } from "@/lib/supabase-data";
import { detectExistingWallet } from "./wallet-detection";

export interface SignupWalletResult {
  success: boolean;
  walletId?: string;
  walletAddress?: string;
  challengeId?: string;
  needsPinSetup?: boolean;
  error?: string;
}

/**
 * Check for existing wallet and create if needed after signup
 * 
 * @param userId - Circle user ID from signup
 * @param userToken - Circle user token from signup
 * @param encryptionKey - Encryption key from signup (for PIN setup)
 * @param blockchain - Blockchain to create wallet on (default: ARC-TESTNET)
 * @returns SignupWalletResult with wallet info or challenge ID for PIN setup
 */
export async function ensureWalletAfterSignup(
  userId: string,
  userToken: string,
  encryptionKey?: string,
  blockchain: string = "ARC-TESTNET"
): Promise<SignupWalletResult> {
  try {
    console.log("[Signup Wallet] Checking for existing wallet after signup...", {
      userId,
      hasEncryptionKey: !!encryptionKey,
      blockchain,
    });

    // Step 1: Check if wallet already exists
    const walletCheck = await detectExistingWallet(userId, userToken, blockchain);
    
    if (walletCheck.hasExistingWallet && walletCheck.wallet) {
      console.log("[Signup Wallet] Wallet already exists, using it:", {
        walletId: walletCheck.wallet.walletId,
        address: walletCheck.wallet.walletAddress.substring(0, 10) + "...",
      });

      // Ensure wallet is saved to Supabase
      try {
        const supabaseUserId = await getOrCreateSupabaseUser(userId, walletCheck.wallet.walletAddress);
        await saveWalletData(supabaseUserId, {
          walletId: walletCheck.wallet.walletId,
          walletAddress: walletCheck.wallet.walletAddress,
        });
      } catch (saveError) {
        console.warn("[Signup Wallet] Failed to save existing wallet to Supabase:", saveError);
        // Continue anyway - wallet exists in Circle
      }

      return {
        success: true,
        walletId: walletCheck.wallet.walletId,
        walletAddress: walletCheck.wallet.walletAddress,
        needsPinSetup: false,
      };
    }

    // Step 2: No wallet exists - create one
    console.log("[Signup Wallet] No wallet found, creating new wallet...");
    
    const client = getUserCircleClient();

    // Check if user has PIN set up
    try {
      const userResponse = await (client as any).getUser({ userId });
      const pinStatus = userResponse.data?.user?.pinStatus;

      if (pinStatus === "ENABLED") {
        // User has PIN - use createWallet
        console.log("[Signup Wallet] User has PIN, creating wallet with createWallet...");
        
        const walletResponse = await (client as any).createWallet({
          userToken,
          blockchains: [blockchain],
          accountType: "SCA",
        });

        if (walletResponse.data?.challengeId) {
          return {
            success: true,
            challengeId: walletResponse.data.challengeId,
            needsPinSetup: false, // PIN exists, just need to verify
          };
        } else {
          // Wallet created directly (shouldn't happen but handle it)
          const walletsResponse = await (client as any).listWallets({
            userToken,
            blockchain,
          });

          const wallets = walletsResponse.data?.wallets || [];
          if (wallets.length > 0) {
            const wallet = wallets[0];
            const supabaseUserId = await getOrCreateSupabaseUser(userId, wallet.address);
            await saveWalletData(supabaseUserId, {
              walletId: wallet.id,
              walletAddress: wallet.address,
            });

            return {
              success: true,
              walletId: wallet.id,
              walletAddress: wallet.address,
              needsPinSetup: false,
            };
          } else {
            // No wallet found after creation attempt
            return {
              success: false,
              error: "Wallet creation completed but wallet not found. Please try again.",
              needsPinSetup: false,
            };
          }
        }
      } else {
        // User doesn't have PIN - use createUserPinWithWallets
        console.log("[Signup Wallet] User doesn't have PIN, creating wallet with PIN setup...");
        
        if (!encryptionKey) {
          return {
            success: false,
            error: "Encryption key required for PIN setup but not provided",
            needsPinSetup: true,
          };
        }

        const pinWalletResponse = await (client as any).createUserPinWithWallets({
          userToken,
          blockchains: [blockchain],
          accountType: "SCA",
        });

        if (pinWalletResponse.data?.challengeId) {
          return {
            success: true,
            challengeId: pinWalletResponse.data.challengeId,
            needsPinSetup: true, // PIN needs to be set up
          };
        } else {
          return {
            success: false,
            error: "Failed to create wallet challenge - no challengeId returned",
            needsPinSetup: true,
          };
        }
      }
    } catch (createError: any) {
      console.error("[Signup Wallet] Error creating wallet:", createError);
      return {
        success: false,
        error: createError.message || "Failed to create wallet after signup",
        needsPinSetup: true,
      };
    }
  } catch (error: any) {
    console.error("[Signup Wallet] Error ensuring wallet after signup:", error);
    return {
      success: false,
      error: error.message || "Failed to ensure wallet after signup",
    };
  }
}

/**
 * Complete wallet creation after PIN challenge is completed
 * 
 * @param userId - Circle user ID
 * @param userToken - Circle user token
 * @param blockchain - Blockchain to check
 * @returns SignupWalletResult with wallet info
 */
export async function completeWalletAfterPinSetup(
  userId: string,
  userToken: string,
  blockchain: string = "ARC-TESTNET"
): Promise<SignupWalletResult> {
  try {
    console.log("[Signup Wallet] Completing wallet creation after PIN setup...");

    // Wait a moment for Circle to process the wallet creation
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check for wallet
    const walletCheck = await detectExistingWallet(userId, userToken, blockchain);
    
    if (walletCheck.hasExistingWallet && walletCheck.wallet) {
      // Save to Supabase
      const supabaseUserId = await getOrCreateSupabaseUser(userId, walletCheck.wallet.walletAddress);
      await saveWalletData(supabaseUserId, {
        walletId: walletCheck.wallet.walletId,
        walletAddress: walletCheck.wallet.walletAddress,
      });

      return {
        success: true,
        walletId: walletCheck.wallet.walletId,
        walletAddress: walletCheck.wallet.walletAddress,
        needsPinSetup: false,
      };
    }

    // Wallet not found yet - might need more time
    return {
      success: false,
      error: "Wallet not found after PIN setup. Please try again.",
      needsPinSetup: false,
    };
  } catch (error: any) {
    console.error("[Signup Wallet] Error completing wallet after PIN setup:", error);
    return {
      success: false,
      error: error.message || "Failed to complete wallet creation",
    };
  }
}

