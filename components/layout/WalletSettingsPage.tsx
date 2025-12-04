"use client";

import { useState } from "react";
import { ArrowLeft, Wallet, Shield, Copy, Check, Plus } from "lucide-react";

interface WalletSettingsPageProps {
  onBack: () => void;
  walletAddress?: string | null;
  walletId?: string | null;
  onCreateWallet?: () => void;
  onViewPermissions?: () => void;
}

export function WalletSettingsPage({ onBack, walletAddress, walletId, onCreateWallet, onViewPermissions }: WalletSettingsPageProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="flex flex-col h-full bg-graphite/30">
      {/* Header */}
      <div className="px-6 py-4 border-b border-graphite/50 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onBack}
          className="text-soft-mist/70 hover:text-signal-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-signal-white">Wallet Settings</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Wallet Info Card */}
        <div className="bg-graphite/50 rounded-xl px-4 py-4 space-y-3 border border-graphite/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-signal-white font-medium">Arc Wallet</div>
              <div className="text-xs text-soft-mist/60">Connected to Arc Testnet</div>
            </div>
          </div>

          {/* Wallet Address Section */}
          {walletAddress && (
            <div className="pt-3 border-t border-graphite/50">
              <div className="text-xs text-soft-mist/70 mb-2">Wallet Address</div>
              <div className="bg-graphite/70 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-sm text-signal-white font-mono break-all flex-1">
                  {formatAddress(walletAddress)}
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="flex-shrink-0 text-soft-mist/70 hover:text-signal-white transition-colors p-1.5 hover:bg-graphite/50 rounded"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-aurora" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Full address on click */}
              <button
                onClick={handleCopyAddress}
                className="mt-2 text-xs text-soft-mist/60 hover:text-soft-mist/80 transition-colors w-full text-left"
              >
                {copied ? "Copied!" : "Click to copy full address"}
              </button>
            </div>
          )}
        </div>

        {/* Settings Options */}
        <div className="space-y-1">
          {onCreateWallet && (
            <button 
              onClick={onCreateWallet}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors border border-aurora/30"
            >
              <Plus className="w-5 h-5 text-aurora" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Create Agent Sub-account</div>
                <div className="text-xs text-soft-mist/60">AI-managed wallet with budget limits</div>
              </div>
            </button>
          )}

          {onViewPermissions && walletId && (
            <button 
              onClick={onViewPermissions}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors"
            >
              <Shield className="w-5 h-5 text-soft-mist/70" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Security & Permissions</div>
                <div className="text-xs text-soft-mist/60">Manage agent permissions</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

