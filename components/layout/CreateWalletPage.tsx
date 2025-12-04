"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, CheckCircle2, Wallet } from "lucide-react";
import { useCircle } from "@/hooks/useCircle";
import { saveWalletData } from "@/lib/supabase-data";

interface CreateWalletPageProps {
  onBack: () => void;
  onWalletCreated: (walletId: string, walletAddress: string) => void;
}

export function CreateWalletPage({ onBack, onWalletCreated }: CreateWalletPageProps) {
  const { createWallet, loading, error } = useCircle();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      const result = await createWallet();
      if (result && result.type === "wallet") {
        const wallet = result.wallet;
        setWalletId(wallet.id);
        setWalletAddress(wallet.address);
        
        // Get userId from useCircle hook or try to load it
        // Note: This assumes userId is available from the hook context
        // If not available, we'll need to pass it as a prop or get it from Supabase
        try {
          // Try to get userId from a preference or from the wallet creation result
          // For now, we'll save wallet data without userId (will be set when user is created)
          // The wallet creation in useCircle should handle saving to Supabase
          // But we'll also save here as a backup
          if (typeof window !== 'undefined') {
            // Migration: Also save to localStorage as fallback
            localStorage.setItem('arcle_wallet_id', wallet.id);
            localStorage.setItem('arcle_wallet_address', wallet.address);
          }
        } catch (error) {
          console.error("[CreateWalletPage] Failed to save wallet data:", error);
        }
        
        // Call callback to proceed to permissions
        onWalletCreated(wallet.id, wallet.address);
      } else if (result && result.type === "challenge") {
        // Handle challenge response - this shouldn't happen in CreateWalletPage
        // as it's typically used for legacy wallet creation
        console.warn("Challenge response received in CreateWalletPage - this may need PIN setup");
      }
    } catch (err) {
      console.error("Failed to create wallet:", err);
    } finally {
      setIsCreating(false);
    }
  };

  if (walletId && walletAddress) {
    return (
      <div className="flex flex-col h-full bg-dark-grey">
        <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-casper hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Wallet Created</h1>
          <div className="w-5 h-5" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
          <div className="bg-onyx rounded-xl px-4 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
              <div>
                <h3 className="text-lg font-semibold text-white">Wallet Created!</h3>
                <p className="text-sm text-casper/70">Your wallet is ready on Arc network</p>
              </div>
            </div>

            <div className="bg-dark-grey rounded-lg px-4 py-3 space-y-2">
              <div>
                <p className="text-xs text-casper mb-1">Wallet ID</p>
                <p className="text-sm text-white font-mono break-all">{walletId}</p>
              </div>
              <div>
                <p className="text-xs text-casper mb-1">Address</p>
                <p className="text-sm text-white font-mono break-all">{walletAddress}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Create Wallet</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-hide">
        {/* Info Card */}
        <div className="bg-onyx rounded-xl px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Create Your Wallet</h3>
              <p className="text-sm text-casper/70">Smart contract account on Arc network</p>
            </div>
          </div>

          <div className="bg-dark-grey rounded-lg px-4 py-3 space-y-2">
            <p className="text-sm text-white">
              • Smart Contract Account (SCA) for advanced features
            </p>
            <p className="text-sm text-white">
              • AI-powered transaction management
            </p>
            <p className="text-sm text-white">
              • No seed phrases - secure cloud backup
            </p>
            <p className="text-sm text-white">
              • Manage agent permissions for automatic execution
            </p>
          </div>

          {error && (
            <div className="bg-danger/20 border border-danger/50 rounded-lg px-4 py-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            onClick={handleCreateWallet}
            disabled={loading || isCreating}
            className="w-full bg-white hover:bg-white/80 text-onyx font-medium py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading || isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Wallet...
              </>
            ) : (
              "Create Wallet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

