/**
 * React Hook for Circle API interactions
 */

import { useState, useCallback } from "react";
import type { Wallet, Transaction } from "@/types";

interface UseCircleReturn {
      createWallet: () => Promise<Wallet | null>;
      getBalance: (walletId: string, address?: string) => Promise<string | null>;
      sendTransaction: (
        walletId: string,
        to: string,
        amount: string
      ) => Promise<Transaction | null>;
      getTransactionStatus: (transactionId: string) => Promise<Transaction | null>;
      requestTestnetTokens: (address: string) => Promise<boolean>;
      loading: boolean;
      error: string | null;
    }

export function useCircle(): UseCircleReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createWallet = useCallback(async (): Promise<Wallet | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/circle/wallets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create wallet");
      }

      const wallet = {
        id: data.data.walletId,
        address: data.data.address || data.data.walletId, // Use actual address from API
        network: "arc",
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
      amount: string
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
            destinationAddress: to,
            amount,
            idempotencyKey: crypto.randomUUID(),
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to send transaction");
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
        return {
          id: txData.id || transactionId,
          hash: txData.hash || txData.id || transactionId,
          from: txData.from || txData.walletId || "",
          to: txData.to || txData.destination?.address || "",
          amount: txData.amount || "0",
          token: txData.token || "USDC",
          status: (txData.status || "pending") as "pending" | "confirmed" | "failed",
          timestamp: txData.createdAt ? new Date(txData.createdAt) : new Date(),
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

      return {
        createWallet,
        getBalance,
        sendTransaction,
        getTransactionStatus,
        requestTestnetTokens,
        loading,
        error,
      };
    }

