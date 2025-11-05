"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Wallet, Shield, DollarSign } from "lucide-react";
import { useCircle } from "@/hooks/useCircle";
import { addSubAccount } from "@/lib/sub-accounts";

interface CreateSubAccountPageProps {
  onBack: () => void;
  masterWalletId: string;
  masterAddress: string;
  onSubAccountCreated: (subAccountId: string, walletId: string, address: string) => void;
}

export function CreateSubAccountPage({ 
  onBack, 
  masterWalletId, 
  masterAddress,
  onSubAccountCreated 
}: CreateSubAccountPageProps) {
  const { createWallet, loading, error } = useCircle();
  const [isCreating, setIsCreating] = useState(false);
  const [dailyLimit, setDailyLimit] = useState("100.00");
  const [perTxLimit, setPerTxLimit] = useState("20.00");
  const [gasSponsored, setGasSponsored] = useState(true);

  const handleCreateSubAccount = async () => {
    setIsCreating(true);
    try {
      // Create a new wallet for the sub-account
      const wallet = await createWallet();
      if (!wallet) {
        throw new Error("Failed to create wallet");
      }

      // Store sub-account info
      const subAccount = addSubAccount({
        walletId: wallet.id,
        address: wallet.address,
        masterWalletId,
        masterAddress,
        dailySpendLimit: dailyLimit,
        perTransactionLimit: perTxLimit,
        isActive: true,
        gasSponsored,
      });

      // Call callback
      onSubAccountCreated(subAccount.id, wallet.id, wallet.address);
    } catch (err) {
      console.error("Failed to create sub-account:", err);
    } finally {
      setIsCreating(false);
    }
  };

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
        <h1 className="text-lg font-semibold text-white">Create Agent Sub-account</h1>
        <div className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-hide">
        {/* Info Card */}
        <div className="bg-onyx rounded-xl px-4 py-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI-Managed Sub-account</h3>
              <p className="text-sm text-casper/70">Smart contract wallet with budget controls</p>
            </div>
          </div>

          <div className="bg-dark-grey rounded-lg px-4 py-3 space-y-2">
            <p className="text-sm text-white">
              • Isolated from your main wallet
            </p>
            <p className="text-sm text-white">
              • AI handles routine payments & transactions
            </p>
            <p className="text-sm text-white">
              • Daily & per-transaction spending limits
            </p>
            <p className="text-sm text-white">
              • Gas sponsorship for seamless UX
            </p>
          </div>
        </div>

        {/* Budget Limits */}
        <div className="bg-onyx rounded-xl px-4 py-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Budget Limits</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-casper/70 mb-2">
                Daily Spending Limit (USDC)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-casper" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full bg-dark-grey border border-dark-grey/50 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-casper/50 focus:outline-none focus:ring-1 focus:ring-white/50"
                  placeholder="100.00"
                />
              </div>
              <p className="text-xs text-casper/70 mt-1">
                Maximum amount the AI can spend per day
              </p>
            </div>

            <div>
              <label className="block text-sm text-casper/70 mb-2">
                Per-Transaction Limit (USDC)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-casper" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perTxLimit}
                  onChange={(e) => setPerTxLimit(e.target.value)}
                  className="w-full bg-dark-grey border border-dark-grey/50 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-casper/50 focus:outline-none focus:ring-1 focus:ring-white/50"
                  placeholder="20.00"
                />
              </div>
              <p className="text-xs text-casper/70 mt-1">
                Maximum amount per single transaction
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gasSponsored}
                  onChange={(e) => setGasSponsored(e.target.checked)}
                  className="w-5 h-5 rounded border-dark-grey/50 bg-dark-grey text-white focus:ring-white/50"
                />
                <div>
                  <div className="text-sm text-white font-medium">Gas Sponsorship</div>
                  <div className="text-xs text-casper/70">
                    AI pays for gas fees (sponsored by Paymaster)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-danger/20 border border-danger/50 rounded-lg px-4 py-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreateSubAccount}
          disabled={loading || isCreating || !dailyLimit || !perTxLimit}
          className="w-full bg-white hover:bg-white/80 text-onyx font-medium py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading || isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Sub-account...
            </>
          ) : (
            "Create Sub-account"
          )}
        </button>
      </div>
    </div>
  );
}


