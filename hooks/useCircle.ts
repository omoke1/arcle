/**
 * React Hook for Circle API interactions
 */

import { useState, useCallback } from "react";
import type { Wallet, Transaction } from "@/types";
import { refreshUserToken } from "@/lib/circle/token-refresh";

interface BridgeRequest {
  walletId: string;
  amount: string;
  fromChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  toChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  destinationAddress: string;
}

interface BridgeStatus {
  bridgeId: string;
  status: "pending" | "attesting" | "completed" | "failed";
  fromChain: string;
  toChain: string;
  amount: string;
  progress: number;
  transactionHash?: string;
  error?: string;
}

type CreateWalletResult = 
  | { type: "challenge"; challengeId: string; userId: string; userToken: string; blockchains: string[] }
  | { type: "wallet"; wallet: Wallet }
  | null;

type SendTransactionResult =
  | { type: "challenge"; challengeId: string; walletId: string; destinationAddress: string; amount: string }
  | { type: "transaction"; transaction: Transaction }
  | null;

interface UseCircleReturn {
      createUser: () => Promise<{ userId: string; userToken: string; encryptionKey?: string } | null>;
      createWallet: (forceNew?: boolean, userToken?: string, userId?: string) => Promise<CreateWalletResult>;
      listWallets: (userId: string, userToken: string) => Promise<Wallet[] | null>;
      createUserWithEmail: (email: string, deviceId?: string) => Promise<{ deviceId: string; deviceToken: string; deviceEncryptionKey: string; otpToken: string; email: string } | null>;
      resendEmailOTP: (userId: string, userToken: string, email: string, deviceToken: string, otpToken: string) => Promise<boolean>;
      getBalance: (walletId: string, address?: string, userId?: string, userToken?: string) => Promise<string | null>;
      sendTransaction: (
        walletId: string,
        to: string,
        amount: string,
        walletAddress?: string,
        userId?: string,
        userToken?: string
      ) => Promise<SendTransactionResult>;
      bridgeTransaction: (request: BridgeRequest) => Promise<BridgeStatus | null>;
      getBridgeStatus: (bridgeId: string) => Promise<BridgeStatus | null>;
      getTransactionStatus: (transactionId: string) => Promise<Transaction | null>;
      requestTestnetTokens: (address: string) => Promise<boolean>;
      loading: boolean;
      error: string | null;
    }

export function useCircle(): UseCircleReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = useCallback(async (): Promise<{ userId: string; userToken: string; encryptionKey?: string } | null> => {
    setLoading(true);
    setError(null);
    try {
      // Check if user already exists (try Supabase first, then localStorage for migration)
      if (typeof window !== 'undefined') {
        // Try to load from Supabase if we have a userId from preferences
        try {
          const { loadPreference } = await import("@/lib/supabase-data");
          // Try to get userId from a preference (if it exists)
          // Note: This is a migration helper - in production, userId should come from context
          const userIdPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
          if (userIdPref?.value) {
            const credentials = await import("@/lib/supabase-data").then(m => m.loadUserCredentials(userIdPref.value));
            if (credentials.userToken) {
              console.log("Using existing user from Supabase");
              return {
                userId: userIdPref.value,
                userToken: credentials.userToken,
                ...(credentials.encryptionKey && { encryptionKey: credentials.encryptionKey })
              };
            }
          }
        } catch (error) {
          // Supabase not available or no user found, fall through to localStorage
        }
        
        // Migration fallback: Check localStorage
        const storedUserId = localStorage.getItem('arcle_user_id');
        const storedUserToken = localStorage.getItem('arcle_user_token');
        const storedEncryptionKey = localStorage.getItem('arcle_encryption_key');
        
        if (storedUserId && storedUserToken) {
          console.log("Using existing user from localStorage (migration)");
          return { 
            userId: storedUserId, 
            userToken: storedUserToken,
            ...(storedEncryptionKey && { encryptionKey: storedEncryptionKey })
          };
        }
      }

      // Create new user
      const response = await fetch("/api/circle/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Optional: provide userId or let Circle generate
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create user");
      }

      const userData = {
        userId: data.data.userId,
        userToken: data.data.userToken,
        ...(data.data.encryptionKey && { encryptionKey: data.data.encryptionKey }),
        ...(data.data.refreshToken && { refreshToken: data.data.refreshToken }),
      };

      // Store user in Supabase (and localStorage for migration)
      if (typeof window !== 'undefined') {
        try {
          const { saveUserCredentials, savePreference } = await import("@/lib/supabase-data");
          await saveUserCredentials(userData.userId, {
            userToken: userData.userToken,
            encryptionKey: userData.encryptionKey,
          });
          if (userData.refreshToken) {
            await savePreference({ userId: userData.userId, key: "refresh_token", value: userData.refreshToken });
          }
          // Generate and store deviceId for token refresh
          const deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          await savePreference({ userId: userData.userId, key: "device_id", value: deviceId });
          // Also record the "current" Circle user for future lookups across the app
          await savePreference({ userId: "current", key: "current_user_id", value: userData.userId });
        } catch (error) {
          console.error("[useCircle] Failed to save user to Supabase:", error);
        }
        
        // Migration: Also save to localStorage (will be removed after full migration)
        localStorage.setItem('arcle_user_id', userData.userId);
        localStorage.setItem('arcle_user_token', userData.userToken);
        if (userData.encryptionKey) {
          localStorage.setItem('arcle_encryption_key', userData.encryptionKey);
        }
        if (userData.refreshToken) {
          localStorage.setItem('arcle_refresh_token', userData.refreshToken);
        }
        const deviceId = localStorage.getItem('arcle_device_id') || `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('arcle_device_id', deviceId);
      }

      return userData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const createWallet = useCallback(async (forceNew: boolean = false, userToken?: string, userId?: string): Promise<CreateWalletResult> => {
    setLoading(true);
    setError(null);
    try {
      // For User-Controlled Wallets, return challenge data
      const useUserControlled = !!userToken && !!userId;
      
      const requestBody: any = {
        idempotencyKey: crypto.randomUUID(),
        forceNew: forceNew,
      };

      if (useUserControlled) {
        requestBody.userToken = userToken;
        requestBody.userId = userId;
        requestBody.useUserControlled = true;
      }

      const response = await fetch("/api/circle/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create wallet");
      }

      // User-Controlled Wallets return challenge data
      // Challenge must be completed client-side with PIN widget
      if (data.data.challengeId) {
        return {
          type: "challenge",
          challengeId: data.data.challengeId,
          userId: data.data.userId,
          userToken: data.data.userToken,
          blockchains: data.data.blockchains,
        };
      }

      // User-Controlled Wallets: Direct wallet creation (when user already has PIN)
      if (data.data.wallet) {
        const wallet: Wallet = {
          id: data.data.wallet.id,
          address: data.data.wallet.address,
          network: "arc" as const,
          createdAt: new Date(),
        };

        // Store wallet in Supabase (and localStorage for migration)
        if (typeof window !== 'undefined' && userId) {
          try {
            const { saveWalletData } = await import("@/lib/supabase-data");
            await saveWalletData(userId, { walletId: wallet.id, walletAddress: wallet.address });
          } catch (error) {
            console.error("[useCircle] Failed to save wallet to Supabase:", error);
          }
          // Migration: Also save to localStorage
          localStorage.setItem('arcle_wallet_id', wallet.id);
          localStorage.setItem('arcle_wallet_address', wallet.address);
        }

        return { type: "wallet", wallet };
      }

      // Legacy: Direct wallet creation (Developer-Controlled)
      const wallet: Wallet = {
        id: data.data.walletId,
        address: data.data.address || data.data.walletId,
        network: "arc" as const,
        createdAt: new Date(),
      };

      // Store wallet in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('arcle_wallet_id', wallet.id);
        localStorage.setItem('arcle_wallet_address', wallet.address);
      }

      return { type: "wallet", wallet };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBalance = useCallback(
    async (walletId: string, address?: string, userId?: string, userToken?: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        // Get user credentials from localStorage if not provided (for user-controlled wallets)
        let finalUserId = userId;
        let finalUserToken = userToken;
        
        if (typeof window !== 'undefined' && (!finalUserId || !finalUserToken)) {
          finalUserId = finalUserId || localStorage.getItem('arcle_user_id') || undefined;
          finalUserToken = finalUserToken || localStorage.getItem('arcle_user_token') || undefined;
        }

        // Build URL with optional user credentials for user-controlled wallets
        const params = new URLSearchParams();
        if (address) {
          params.append('address', address);
          params.append('useBlockchain', 'true');
        } else {
          params.append('walletId', walletId);
        }
        
        // Add user credentials if available (for user-controlled wallets)
        if (finalUserId) params.append('userId', finalUserId);
        if (finalUserToken) params.append('userToken', finalUserToken);

        const url = `/api/circle/balance?${params.toString()}`;

        let response = await fetch(url);
        let data = await response.json();

        // Check for token expiration and auto-refresh
        const isTokenExpired = response.status === 403 && (
          data?.errorCode === 'TOKEN_EXPIRED' ||
          data?.code === 155104 ||
          data?.error?.includes('expired') ||
          data?.message?.includes('expired')
        );

        if (isTokenExpired) {
          console.log("[useCircle] 🔄 Token expired in getBalance, attempting automatic refresh...");
          const newToken = await refreshUserToken();
          
          if (newToken) {
            console.log("[useCircle] ✅ Token refreshed, retrying getBalance...");
            // Retry with new token
            const retryParams = new URLSearchParams();
            if (address) {
              retryParams.append('address', address);
              retryParams.append('useBlockchain', 'true');
            } else {
              retryParams.append('walletId', walletId);
            }
            if (finalUserId) retryParams.append('userId', finalUserId);
            if (newToken.userToken) retryParams.append('userToken', newToken.userToken);
            
            const retryUrl = `/api/circle/balance?${retryParams.toString()}`;
            response = await fetch(retryUrl);
            data = await response.json();
          }
        }

        if (!data.success) {
          throw new Error(data.error || "Failed to get balance");
        }

        // Return formatted balance from API
        return data.data.balance || "0.00";
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const sendTransaction = useCallback(
    async (
      walletId: string,
      to: string,
      amount: string,
      walletAddress?: string,
      userId?: string,
      userToken?: string
    ): Promise<SendTransactionResult> => {
      setLoading(true);
      setError(null);
      try {
        // Get user token from localStorage if not provided
        let finalUserId = userId;
        let finalUserToken = userToken;
        
        if (typeof window !== 'undefined' && (!finalUserId || !finalUserToken)) {
          finalUserId = finalUserId || localStorage.getItem('arcle_user_id') || undefined;
          finalUserToken = finalUserToken || localStorage.getItem('arcle_user_token') || undefined;
        }

        if (!finalUserId || !finalUserToken) {
          throw new Error("User authentication required. Please create a user first.");
        }

        const response = await fetch("/api/circle/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletId,
            walletAddress,
            destinationAddress: to,
            amount,
            userId: finalUserId,
            userToken: finalUserToken,
            idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          }),
        });
        
        // Log response for debugging
        console.log("[useCircle] Transaction API response status:", response.status);
        const data = await response.json().catch((parseError) => {
          console.error("[useCircle] Failed to parse response JSON:", parseError);
          return null;
        });
        console.log("[useCircle] Transaction API response data:", data);
        console.log("[useCircle] Checking for challengeId - data.data?.challengeId:", data?.data?.challengeId);
        console.log("[useCircle] Checking for challengeId - data.data?.requiresChallenge:", data?.data?.requiresChallenge);

        if (!response.ok) {
          // Check for token expiration (403 with specific error codes)
          const isTokenExpired = response.status === 403 && (
            data?.errorCode === 'TOKEN_EXPIRED' ||
            data?.code === 155104 ||
            data?.error?.includes('expired') ||
            data?.message?.includes('expired')
          );

          if (isTokenExpired) {
            console.log("[useCircle] 🔄 Token expired, attempting automatic refresh...");
            const newToken = await refreshUserToken();
            
            if (newToken) {
              console.log("[useCircle] ✅ Token refreshed, retrying transaction...");
              // Retry the request with new token
              const retryResponse = await fetch("/api/circle/transactions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  walletId,
                  walletAddress,
                  destinationAddress: to,
                  amount,
                  userId: finalUserId,
                  userToken: newToken.userToken, // Use refreshed token
                  idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
                }),
              });
              
              const retryData = await retryResponse.json().catch(() => null);
              
              if (!retryResponse.ok) {
                const errorMsg = retryData?.error || `Failed to send transaction after token refresh (HTTP ${retryResponse.status})`;
                throw new Error(errorMsg);
              }
              
              // Use retryData instead of data for the rest of the function
              const finalData = retryData;
              
              // Check for challenge in retry response
              if (finalData && (finalData.data?.challengeId || finalData.data?.requiresChallenge)) {
                const challengeId = finalData.data.challengeId || 'unknown';
                console.log("[useCircle] ✅✅✅ Transaction requires PIN challenge detected (after refresh)!");
                
                return {
                  type: "challenge" as const,
                  challengeId: challengeId,
                  walletId: finalData.data.walletId || walletId,
                  destinationAddress: finalData.data.destinationAddress || to,
                  amount: finalData.data.amount || amount,
                };
              }
              
              // Process successful transaction from retry
              if (!finalData?.success) {
                const errorMsg = finalData?.error || "Failed to send transaction";
                throw new Error(errorMsg);
              }
              
              const blockchainHash = finalData.data.txHash ||
                                    finalData.data.transactionHash ||
                                    finalData.data.hash ||
                                    null;

              const transaction: Transaction = {
                id: finalData.data.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
                hash: blockchainHash || finalData.data.id || "",
                from: finalData.data.from || walletId,
                to: finalData.data.to || to,
                amount: finalData.data.amount || amount,
                token: finalData.data.token || "USDC",
                status: (finalData.data.status || "pending") as "pending" | "confirmed" | "failed",
                timestamp: finalData.data.createdAt ? new Date(finalData.data.createdAt) : new Date(),
              };

              return {
                type: "transaction" as const,
                transaction,
              };
            } else {
              // Token refresh failed - clear credentials
              if (typeof window !== 'undefined') {
                localStorage.removeItem('arcle_user_id');
                localStorage.removeItem('arcle_user_token');
                localStorage.removeItem('arcle_encryption_key');
                localStorage.removeItem('arcle_refresh_token');
              }
              setError("Session expired and token refresh failed. Please re-create your user and PIN.");
              throw new Error("SESSION_EXPIRED: Token expired and refresh failed. Please set up your wallet PIN again.");
            }
          }
          
          if (response.status === 401 || response.status === 403) {
            // Other auth errors - clear cached credentials
            if (typeof window !== 'undefined') {
              localStorage.removeItem('arcle_user_id');
              localStorage.removeItem('arcle_user_token');
              localStorage.removeItem('arcle_encryption_key');
              localStorage.removeItem('arcle_refresh_token');
            }
            setError("Session expired. Please re-create your user and PIN.");
            throw new Error("SESSION_EXPIRED: Circle user session expired. Please set up your wallet PIN again.");
          }

          const errorMsg = data?.error || `Failed to send transaction (HTTP ${response.status})`;
          const detailsMsg = data?.details ? ` Details: ${JSON.stringify(data.details)}` : "";
          throw new Error(`${errorMsg}${detailsMsg}`);
        }

        // Check if transaction requires challenge (PIN confirmation) FIRST
        // For user-controlled wallets, transactions require PIN approval
        // The API returns success: true with challengeId when challenge is required
        // IMPORTANT: Check this BEFORE checking !data?.success
        if (data && (data.data?.challengeId || data.data?.requiresChallenge)) {
          // Return challenge information - client needs to complete challenge using Web SDK
          // This is expected behavior for user-controlled wallets
          const challengeId = data.data.challengeId || 'unknown';
          console.log("[useCircle] ✅✅✅ Transaction requires PIN challenge detected!");
          console.log("[useCircle] ChallengeId:", challengeId);
          console.log("[useCircle] Full challenge response:", JSON.stringify(data, null, 2));
          
          // Return challenge result instead of throwing error
          return {
            type: "challenge" as const,
            challengeId: challengeId,
            walletId: data.data.walletId || walletId,
            destinationAddress: data.data.destinationAddress || to,
            amount: data.data.amount || amount,
          };
        }
        
        console.log("[useCircle] No challengeId found in response, proceeding with normal transaction flow");

        if (!data?.success) {
          const errorMsg = data?.error || "Failed to send transaction";
          const detailsMsg = data?.details ? ` Details: ${JSON.stringify(data.details)}` : "";
          throw new Error(`${errorMsg}${detailsMsg}`);
        }

        // Map Circle API response to Transaction type
        // Extract blockchain hash from multiple possible fields
        const blockchainHash = data.data.txHash || 
                              data.data.transactionHash || 
                              data.data.hash || 
                              null;
        
        const transaction: Transaction = {
          id: data.data.id || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          hash: blockchainHash || data.data.id || "", // Use blockchain hash if available, otherwise transaction ID
          from: data.data.from || walletId,
          to: data.data.to || to,
          amount: data.data.amount || amount,
          token: data.data.token || "USDC",
          status: (data.data.status || "pending") as "pending" | "confirmed" | "failed",
          timestamp: data.data.createdAt ? new Date(data.data.createdAt) : new Date(),
        };
        
        return {
          type: "transaction" as const,
          transaction,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getTransactionStatus = useCallback(
    async (transactionId: string): Promise<Transaction | null> => {
      setLoading(true);
      setError(null);
      try {
        let finalUserId: string | undefined;
        let finalUserToken: string | undefined;

        if (typeof window !== "undefined") {
          finalUserId = localStorage.getItem("arcle_user_id") || undefined;
          finalUserToken = localStorage.getItem("arcle_user_token") || undefined;
        }

        const queryParams = new URLSearchParams({ transactionId });
        if (finalUserId && finalUserToken) {
          queryParams.append("userId", finalUserId);
          queryParams.append("userToken", finalUserToken);
        }

        const response = await fetch(`/api/circle/transactions?${queryParams.toString()}`);

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to get transaction status");
        }

        // Map response to Transaction type
        const txData = data.data.data || data.data;
        const actualTxData = Array.isArray(txData) ? txData[0] : txData;
        
        // Handle nested transaction object (Circle API wraps transaction in a transaction field)
        const actualTx = actualTxData?.transaction || actualTxData;
        
        // Extract blockchain hash from various possible fields
        // Circle API uses txHash field for the blockchain transaction hash (priority)
        const blockchainHash = actualTx?.txHash ||
                              actualTx?.transactionHash || 
                              actualTx?.onChainTxHash || 
                              actualTx?.hash ||
                              null;
        
        // Map Circle transaction state to our status format
        const circleState = actualTx?.state || actualTx?.status;
        let mappedStatus: "pending" | "confirmed" | "failed" = "pending";
        
        if (circleState === "COMPLETE" || circleState === "COMPLETED" || circleState === "CONFIRMED" || circleState === "SENT") {
          mappedStatus = "confirmed";
        } else if (circleState === "FAILED" || circleState === "DENIED" || circleState === "CANCELLED") {
          mappedStatus = "failed";
        }
        
        console.log(`[getTransactionStatus] Transaction ${transactionId} - Hash: ${blockchainHash || 'none'}, State: ${circleState} -> Status: ${mappedStatus}`);
        
        // Extract amount - Circle API uses amounts array or amount object
        const amountValue = actualTx?.amounts && actualTx.amounts.length > 0 
          ? actualTx.amounts[0] 
          : (actualTx?.amount?.amount || actualTx?.amount || actualTxData?.amount || "0");
        
        return {
          id: actualTx?.id || actualTxData?.id || transactionId,
          hash: blockchainHash || actualTx?.id || actualTxData?.id || transactionId,
          from: actualTx?.sourceAddress || actualTx?.from || actualTxData?.from || actualTx?.walletId || actualTxData?.walletId || "",
          to: actualTx?.destinationAddress || actualTx?.destination?.address || actualTxData?.destinationAddress || actualTxData?.destination?.address || actualTx?.to || actualTxData?.to || "",
          amount: amountValue,
          token: actualTx?.amount?.currency || actualTx?.token || actualTxData?.token || "USDC",
          status: mappedStatus,
          timestamp: actualTx?.createDate ? new Date(actualTx.createDate) : (actualTx?.createdAt ? new Date(actualTx.createdAt) : (actualTxData?.createdAt ? new Date(actualTxData.createdAt) : new Date())),
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

      const requestTestnetTokens = useCallback(
        async (address: string): Promise<boolean> => {
          setLoading(true);
          setError(null);
          try {
            const response = await fetch("/api/circle/faucet", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address,
                blockchain: "ARC-TESTNET",
                native: true,
                usdc: true,
              }),
            });

            const data = await response.json();

            if (!data.success) {
              // Handle rate limit specifically
              if (response.status === 429 || data.error?.includes("rate limit")) {
                const errorMsg = "⏳ Rate limit exceeded. Circle's faucet has a cooldown period. Please wait 5-10 minutes before requesting again, or use the manual faucet at https://faucet.circle.com";
                setError(errorMsg);
                throw new Error(errorMsg);
              }
              throw new Error(data.error || "Failed to request testnet tokens");
            }

            return true;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(errorMessage);
            return false;
          } finally {
            setLoading(false);
          }
        },
        []
      );

      const bridgeTransaction = useCallback(
        async (request: BridgeRequest): Promise<BridgeStatus | null> => {
          setLoading(true);
          setError(null);
          try {
            const response = await fetch("/api/circle/bridge", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(request),
            });

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error || "Failed to initiate bridge");
            }

            return {
              bridgeId: data.bridgeId,
              status: data.status,
              fromChain: data.fromChain,
              toChain: data.toChain,
              amount: data.amount,
              progress: data.progress || 0,
              transactionHash: data.transactionHash,
              error: data.error,
            };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(errorMessage);
            return null;
          } finally {
            setLoading(false);
          }
        },
        []
      );

      const getBridgeStatus = useCallback(
        async (bridgeId: string): Promise<BridgeStatus | null> => {
          setLoading(true);
          setError(null);
          try {
            const response = await fetch(`/api/circle/bridge?bridgeId=${bridgeId}`);

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error || "Failed to get bridge status");
            }

            return {
              bridgeId: data.bridgeId,
              status: data.status,
              fromChain: data.fromChain,
              toChain: data.toChain,
              amount: data.amount,
              progress: data.progress || 0,
              transactionHash: data.transactionHash,
              error: data.error,
            };
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            setError(errorMessage);
            return null;
          } finally {
            setLoading(false);
          }
        },
        []
      );

      const listWallets = useCallback(async (userId: string, userToken: string): Promise<Wallet[] | null> => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/circle/wallets?userId=${userId}&userToken=${encodeURIComponent(userToken)}`);
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Failed to list wallets");
          }

          const wallets = data.data.wallets || [];
          return wallets.map((w: any) => ({
            id: w.id,
            address: w.address,
            network: "arc" as const,
            createdAt: new Date(w.createDate),
          }));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          return null;
        } finally {
          setLoading(false);
        }
      }, []);

      const createUserWithEmail = useCallback(async (email: string, deviceId?: string): Promise<{
        deviceId: string;
        deviceToken: string;
        deviceEncryptionKey: string;
        otpToken: string;
        email: string;
      } | null> => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/circle/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              action: "email-login",
              email, 
              deviceId 
            }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Failed to send OTP email");
          }

          return data.data;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          return null;
        } finally {
          setLoading(false);
        }
      }, []);

      const resendEmailOTP = useCallback(async (email: string, deviceId: string, otpToken: string, userToken?: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/circle/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              action: "resend-otp",
              deviceToken: otpToken 
            }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || "Failed to resend OTP");
          }

          return true;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          return false;
        } finally {
          setLoading(false);
        }
      }, []);

      return {
        createUser,
      createWallet,
        listWallets,
        createUserWithEmail,
        resendEmailOTP,
        getBalance,
        sendTransaction,
        bridgeTransaction,
        getBridgeStatus,
        getTransactionStatus,
        requestTestnetTokens,
        loading,
        error,
      };
    }

