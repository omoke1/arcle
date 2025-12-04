"use client";

import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface BalanceDisplayProps {
  balance: string;
  token?: string;
  network?: string;
  isLoading?: boolean;
  className?: string;
}

export function BalanceDisplay({
  balance,
  token = "USDC",
  network = "Arc",
  isLoading = false,
  className,
}: BalanceDisplayProps) {
  const formattedBalance = parseFloat(balance).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      className={cn(
        "bg-graphite rounded-[20px] px-6 py-4 border border-graphite/60",
        className
      )}
    >
      {isLoading ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-soft-mist/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 bg-soft-mist/10 rounded animate-pulse mb-2" />
            <div className="h-3 bg-soft-mist/10 rounded w-24 animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-soft-mist/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-signal-white" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-signal-white">
              ${formattedBalance}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-soft-mist/70">
                {token} on {network}
              </span>
              {network === "Arc" && (
                <span className="text-xs text-carbon px-2 py-0.5 bg-aurora rounded-full font-medium">
                  Native USDC
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

