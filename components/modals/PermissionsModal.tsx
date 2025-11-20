"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoApprove: boolean;
  transactionLimit: number;
  onToggleAutoApprove: () => void;
}

export function PermissionsModal({
  isOpen,
  onClose,
  autoApprove,
  transactionLimit,
  onToggleAutoApprove,
}: PermissionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-onyx border border-white/20 rounded-2xl p-6 max-w-md w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-extralight tracking-wider text-white mb-2">Permissions</h2>
        <p className="text-white/60 text-sm mb-6">Manage transaction approval settings</p>

        {/* Auto-Approve Small Transactions */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-medium mb-1">Auto-approve small transactions</div>
              <div className="text-white/60 text-sm">Automatically approve transactions under ${transactionLimit}</div>
            </div>
            <button
              onClick={onToggleAutoApprove}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                autoApprove ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute w-5 h-5 bg-onyx rounded-full transition-transform top-0.5 ${
                  autoApprove ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Transaction Limit Info */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-6">
          <div className="text-white font-medium mb-1">Transaction limit</div>
          <div className="text-white/60 text-sm mb-2">Maximum amount for auto-approval</div>
          <div className="text-2xl text-white font-extralight tracking-wider">${transactionLimit} USDC</div>
        </div>

        {/* Info Box */}
        <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-6">
          <div className="text-white/60 text-sm">
            <strong className="text-white/80">Note:</strong> All transactions will still appear in your transaction history, regardless of auto-approval status.
          </div>
        </div>

        {/* Close Button */}
        <Button 
          onClick={onClose} 
          className="w-full bg-white text-onyx hover:bg-white/90 border border-white/20"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

