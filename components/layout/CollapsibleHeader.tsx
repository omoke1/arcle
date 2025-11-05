"use client";

import { useState } from "react";
import { ChevronDown, Send, Download, ArrowLeftRight, CreditCard, LogOut, TrendingUp, ArrowDownToLine, Menu, User, Search, CalendarDays } from "lucide-react";
import { BalanceDisplay } from "@/components/wallet/BalanceDisplay";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Sidebar } from "./Sidebar";
import { AnonymousMaskIcon } from "@/components/ui/AnonymousMaskIcon";

interface CollapsibleHeaderProps {
  balance: string;
  isLoading?: boolean;
  walletId?: string | null;
  walletAddress?: string | null;
  onSend?: () => void;
  onReceive?: () => void;
  onBridge?: () => void;
  onPay?: () => void;
  onYield?: () => void;
  onWithdraw?: () => void;
  onScan?: () => void;
  onSchedule?: () => void;
  onLogout?: () => void;
  onWalletCreated?: (walletId: string, walletAddress: string) => void;
}

export function CollapsibleHeader({
  balance,
  isLoading = false,
  walletId,
  walletAddress,
  onSend,
  onReceive,
  onBridge,
  onPay,
  onYield,
  onWithdraw,
  onScan,
  onSchedule,
  onLogout,
  onWalletCreated,
}: CollapsibleHeaderProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<"schedules" | "scan-reports" | "main">("main");

  const handleAction = (action?: () => void, openView?: "schedules" | "scan-reports") => {
    if (action) {
      action();
    }
    if (openView) {
      setSidebarView(openView);
      setIsSidebarOpen(true);
    }
    setIsSheetOpen(false);
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-onyx border-b border-dark-grey">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Menu Icon (Sidebar Trigger) */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-casper hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Right: Anonymous Mask Icon & Chevron (Bottom Sheet Trigger) */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className="flex items-center gap-3 hover:bg-dark-grey/30 transition-colors px-2 py-1 rounded"
          >
            <AnonymousMaskIcon size={24} className="text-white" />
            <ChevronDown className="w-5 h-5 text-casper" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        walletId={walletId}
        walletAddress={walletAddress}
        onLogout={onLogout}
        onWalletCreated={onWalletCreated}
        openView={sidebarView === "main" ? undefined : sidebarView}
      />

      {/* Bottom Sheet */}
      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">ARCLE</h1>
          </div>

          {/* Balance Section */}
          <div className="border-t border-dark-grey/50 pt-4">
            <p className="text-xs text-casper mb-3 uppercase tracking-wide">
              Total Balance
            </p>
            <BalanceDisplay balance={balance} isLoading={isLoading} />
          </div>

          {/* Multi-chain breakdown - placeholder for future */}
          {/* <div className="border-t border-dark-grey/50 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-casper">Arc:</span>
              <span className="text-white">$1,200.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-casper">Base:</span>
              <span className="text-white">$250.32</span>
            </div>
          </div> */}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dark-grey/50">
            <button
              onClick={() => handleAction(onSend)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span className="font-medium">Send</span>
            </button>
            <button
              onClick={() => handleAction(onReceive)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="font-medium">Receive</span>
            </button>
            <button
              onClick={() => handleAction(onBridge)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="font-medium">Bridge</span>
            </button>
            <button
              onClick={() => handleAction(onPay)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <CreditCard className="w-4 h-4" />
              <span className="font-medium">Pay</span>
            </button>
            <button
              onClick={() => handleAction(onYield)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Yield</span>
            </button>
            <button
              onClick={() => handleAction(onWithdraw)}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span className="font-medium">Withdraw</span>
            </button>
            <button
              onClick={() => handleAction(onScan, "scan-reports")}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="font-medium">Scan</span>
            </button>
            <button
              onClick={() => handleAction(onSchedule, "schedules")}
              className="flex items-center justify-center gap-2 h-12 bg-dark-grey/50 border border-white/30 rounded-xl text-white hover:bg-dark-grey hover:border-white/50 transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="font-medium">Schedule</span>
            </button>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <div className="border-t border-dark-grey/50 pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(onLogout)}
                className="w-full flex items-center gap-2 text-casper hover:text-white hover:bg-dark-grey h-12"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </Button>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

