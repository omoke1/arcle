/**
 * React Hook for Circle API interactions
 */

import { useState, useCallback } from "react";
import type { Wallet, Transaction } from "@/types";

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

interface UseCircleReturn {
      createWallet: (forceNew?: boolean) => Promise<Wallet | null>;
      getBalance: (walletId: string, address?: string) => Promise<string | null>;
      sendTransaction: (
        walletId: string,
        to: string,
        amount: string,
        walletAddress?: string
      ) => Promise<Transaction | null>;
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

  const createWallet = useCallback(async (forceNew: boolean = false): Promise<Wallet | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/circle/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(), // Always unique to create new wallet
          forceNew: forceNew, // Force new wallet set for unique wallet
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create wallet");
      }

      const wallet: Wallet = {
        id: data.data.walletId,
        address: data.data.address || data.data.walletId, // Use actual address from API
        network: "arc" as const,
        createdAt: new Date(),
      };

      // Store wallet in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('arcle_wallet_id', wallet.id);
        localStorage.setItem('arcle_wallet_address', wallet.address);
      }

      return wallet;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getBalance = useCallback(
    async (walletId: string, address?: string): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        // Try Circle API first, fallback to blockchain query
        const url = address
          ? `/api/circle/balance?address=${address}&useBlockchain=true`
          : `/api/circle/balance?walletId=${walletId}`;

        const response = await fetch(url);

        const data = await response.json();

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
      walletAddress?: string // CRITICAL: Pass wallet address for SDK transaction creation
    ): Promise<Transaction | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/circle/transactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletId,
            walletAddress, // CRITICAL: Include wallet address to avoid SDK public key fetch
            destinationAddress: to,
            amount,
            idempotencyKey: crypto.randomUUID(),
          }),
        });

        const data = await response.json();

        if (!data.success) {
          // Include error details in the error message for better debugging
          const errorMsg = data.error || "Failed to send transaction";
          const detailsMsg = data.details ? ` Details: ${JSON.stringify(data.details)}` : "";
          throw new Error(`${errorMsg}${detailsMsg}`);
        }

        // Map Circle API response to Transaction type
        return {
          id: data.data.id || crypto.randomUUID(),
          hash: data.data.hash || data.data.id || "",
          from: data.data.from || walletId,
          to: data.data.to || to,
          amount: data.data.amount || amount,
          token: data.data.token || "USDC",
          status: (data.data.status || "pending") as "pending" | "confirmed" | "failed",
          timestamp: data.data.createdAt ? new Date(data.data.createdAt) : new Date(),
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
        const response = await fetch(
          `/api/circle/transactions?transactionId=${transactionId}`
        );

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

      return {
        createWallet,
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

