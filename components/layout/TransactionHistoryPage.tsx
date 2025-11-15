"use client";

import { ArrowLeft } from "lucide-react";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";

interface TransactionHistoryPageProps {
  onBack: () => void;
  walletId?: string | null;
  walletAddress?: string | null;
}

export function TransactionHistoryPage({ onBack, walletId, walletAddress }: TransactionHistoryPageProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white">Transaction History</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
        {walletId ? (
          <TransactionHistory 
            walletId={walletId} 
            walletAddress={walletAddress || undefined} 
            limit={50}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-casper text-sm mb-2">No wallet connected</p>
            <p className="text-casper/70 text-xs">Please create a wallet to view transaction history</p>
          </div>
        )}
      </div>
    </div>
  );
}

