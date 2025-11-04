"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Send, Download, ArrowLeftRight, CreditCard, LogOut, TrendingUp, ArrowDownToLine } from "lucide-react";
import { BalanceDisplay } from "@/components/wallet/BalanceDisplay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsibleHeaderProps {
  balance: string;
  isLoading?: boolean;
  onSend?: () => void;
  onReceive?: () => void;
  onBridge?: () => void;
  onPay?: () => void;
  onYield?: () => void;
  onWithdraw?: () => void;
  onLogout?: () => void;
}

export function CollapsibleHeader({
  balance,
  isLoading = false,
  onSend,
  onReceive,
  onBridge,
  onPay,
  onYield,
  onWithdraw,
  onLogout,
}: CollapsibleHeaderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="sticky top-0 z-10 bg-onyx border-b border-dark-grey">
      {/* Collapsed State */}
      {!isExpanded && (
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">ARCLE</h1>
          <div className="flex items-center gap-4">
            {balance !== "0.00" && (
              <span className="text-sm text-white font-medium">
                ${parseFloat(balance).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} USDC
              </span>
            )}
            <button
              onClick={() => setIsExpanded(true)}
              className="text-casper hover:text-white transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">ARCLE</h1>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-casper hover:text-white transition-colors"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          <div className="border-t border-dark-grey pt-4">
            <p className="text-xs text-casper mb-2 uppercase tracking-wide">
              Total Balance
            </p>
            <BalanceDisplay balance={balance} isLoading={isLoading} />
          </div>

          {/* Multi-chain breakdown - placeholder for future */}
          {/* <div className="border-t border-dark-grey pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-casper">Arc:</span>
              <span className="text-white">$1,200.00</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-casper">Base:</span>
              <span className="text-white">$250.32</span>
            </div>
          </div> */}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-dark-grey">
            <Button
              variant="secondary"
              size="sm"
              onClick={onSend}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onReceive}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Receive
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onBridge}
              className="flex items-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Bridge
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onPay}
              className="flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Pay
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onYield}
              className="flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Yield
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onWithdraw}
              className="flex items-center gap-2"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Withdraw
            </Button>
          </div>

          {/* Logout Button */}
          {onLogout && (
            <div className="border-t border-dark-grey pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-full flex items-center gap-2 text-casper hover:text-white hover:bg-dark-grey"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

