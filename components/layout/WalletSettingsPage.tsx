"use client";

import { useState } from "react";
import { ArrowLeft, Wallet, Key, Shield, Eye, EyeOff, Download, Trash2, Copy, Check, Plus } from "lucide-react";

interface WalletSettingsPageProps {
  onBack: () => void;
  walletAddress?: string | null;
  onCreateWallet?: () => void;
}

export function WalletSettingsPage({ onBack, walletAddress, onCreateWallet }: WalletSettingsPageProps) {
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
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Wallet Settings</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Wallet Info Card */}
        <div className="bg-onyx rounded-xl px-4 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">Arc Wallet</div>
              <div className="text-xs text-casper/70">Connected to Arc Testnet</div>
            </div>
          </div>

          {/* Wallet Address Section */}
          {walletAddress && (
            <div className="pt-3 border-t border-dark-grey/50">
              <div className="text-xs text-casper mb-2">Wallet Address</div>
              <div className="bg-dark-grey rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                <p className="text-sm text-white font-mono break-all flex-1">
                  {formatAddress(walletAddress)}
                </p>
                <button
                  onClick={handleCopyAddress}
                  className="flex-shrink-0 text-casper hover:text-white transition-colors p-1.5 hover:bg-dark-grey/50 rounded"
                  title="Copy address"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Full address on click */}
              <button
                onClick={handleCopyAddress}
                className="mt-2 text-xs text-casper/70 hover:text-casper transition-colors w-full text-left"
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
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors border border-white/20"
            >
              <Plus className="w-5 h-5 text-white" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Create New Wallet</div>
                <div className="text-xs text-casper/70">Add another wallet account</div>
              </div>
            </button>
          )}

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Key className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Recovery Phrase</div>
              <div className="text-xs text-casper/70">Back up your wallet</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Shield className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Security</div>
              <div className="text-xs text-casper/70">Biometric authentication</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Eye className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Show Private Key</div>
              <div className="text-xs text-casper/70">View your private key</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Download className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Export Wallet</div>
              <div className="text-xs text-casper/70">Download wallet backup</div>
            </div>
          </button>

          <div className="border-t border-dark-grey/50 my-2" />

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-500 hover:bg-onyx transition-colors">
            <Trash2 className="w-5 h-5" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Delete Wallet</div>
              <div className="text-xs text-red-500/70">Permanently remove wallet</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

