"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircle } from "@/hooks/useCircle";

interface WalletCreationProps {
  onWalletCreated?: (walletId: string) => void;
}

export function WalletCreation({ onWalletCreated }: WalletCreationProps) {
  const { createWallet, loading, error } = useCircle();
  const [walletId, setWalletId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWallet = async () => {
    setIsCreating(true);
    try {
      const result = await createWallet();
      if (result && result.type === "wallet") {
        const wallet = result.wallet;
        setWalletId(wallet.id);
        if (onWalletCreated) {
          onWalletCreated(wallet.id);
        }
      } else if (result && result.type === "challenge") {
        // Handle challenge response - this shouldn't happen in WalletCreation
        // as it's typically used for legacy wallet creation
        console.warn("Challenge response received in WalletCreation - this may need PIN setup");
      }
    } catch (err) {
      console.error("Failed to create wallet:", err);
    } finally {
      setIsCreating(false);
    }
  };

  if (walletId) {
    return (
      <div className="bg-dark-grey rounded-2xl p-6 border border-casper/20">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-success" />
          <h3 className="text-lg font-semibold text-white">
            Wallet Created!
          </h3>
        </div>
        <p className="text-sm text-casper mb-4">
          Your wallet is ready to use on Arc network.
        </p>
        <div className="bg-onyx rounded-xl p-4">
          <p className="text-xs text-casper mb-1">Wallet ID</p>
          <p className="text-sm text-white font-mono break-all">{walletId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-grey rounded-2xl p-6 border border-casper/20">
      <h3 className="text-lg font-semibold text-white mb-2">
        Create Your Wallet
      </h3>
      <p className="text-sm text-casper mb-6">
        We&apos;ll create a secure wallet on Arc network. No seed phrases needed!
      </p>

      {error && (
        <div className="mb-4 p-3 bg-danger/20 border border-danger rounded-xl">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <Button
        onClick={handleCreateWallet}
        disabled={loading || isCreating}
        className="w-full bg-white hover:bg-white/80 text-onyx"
      >
        {loading || isCreating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Wallet...
          </>
        ) : (
          "Create Wallet"
        )}
      </Button>
    </div>
  );
}

