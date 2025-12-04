"use client";

import { Send, Download, ArrowLeftRight, CreditCard, TrendingUp, ArrowDownToLine, Search, CalendarDays } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BalanceDisplay } from "@/components/wallet/BalanceDisplay";
import { Button } from "@/components/ui/button";

interface QuickActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  balance: string;
  isLoading?: boolean;
  onSend?: () => void;
  onReceive?: () => void;
  onBridge?: () => void;
  onPay?: () => void;
  onYield?: () => void;
  onWithdraw?: () => void;
  onScan?: () => void;
  onSchedule?: () => void;
}

export function QuickActionsSheet({
  isOpen,
  onClose,
  balance,
  isLoading = false,
  onSend,
  onReceive,
  onBridge,
  onPay,
  onYield,
  onWithdraw,
  onScan,
  onSchedule,
}: QuickActionsSheetProps) {
  const handleAction = (action?: () => void) => {
    if (action) {
      action();
    }
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-signal-white">ARCLE</h1>
        </div>

        {/* Balance Section */}
        <div className="pt-4">
          <p className="text-xs text-soft-mist/50 mb-3 uppercase tracking-wide font-medium">
            Total Balance
          </p>
          <BalanceDisplay balance={balance} isLoading={isLoading} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          {onSend && (
            <button
              onClick={() => handleAction(onSend)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <Send className="w-4 h-4" />
              <span className="font-medium">Send</span>
            </button>
          )}
          {onReceive && (
            <button
              onClick={() => handleAction(onReceive)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Receive</span>
            </button>
          )}
          {onBridge && (
            <button
              onClick={() => handleAction(onBridge)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="font-medium">Bridge</span>
            </button>
          )}
          {onPay && (
            <button
              onClick={() => handleAction(onPay)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              <span className="font-medium">Pay</span>
            </button>
          )}
          {onYield && (
            <button
              onClick={() => handleAction(onYield)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Yield</span>
            </button>
          )}
          {onWithdraw && (
            <button
              onClick={() => handleAction(onWithdraw)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span className="font-medium">Withdraw</span>
            </button>
          )}
          {onScan && (
            <button
              onClick={() => handleAction(onScan)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <Search className="w-4 h-4" />
              <span className="font-medium">Scan</span>
            </button>
          )}
          {onSchedule && (
            <button
              onClick={() => handleAction(onSchedule)}
              className="flex items-center justify-center gap-2 h-12 bg-graphite border border-graphite/60 rounded-xl text-signal-white hover:bg-graphite/80 hover:border-aurora/40 transition-all"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="font-medium">Schedule</span>
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

