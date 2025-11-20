"use client";

import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  analyticsEnabled: boolean;
  errorReportingEnabled: boolean;
  onToggleAnalytics: () => void;
  onToggleErrorReporting: () => void;
}

export function PrivacyModal({
  isOpen,
  onClose,
  analyticsEnabled,
  errorReportingEnabled,
  onToggleAnalytics,
  onToggleErrorReporting,
}: PrivacyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-onyx border border-white/20 rounded-2xl p-6 max-w-md w-full relative max-h-[80vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-extralight tracking-wider text-white mb-2">Privacy Settings</h2>
        <p className="text-white/60 text-sm mb-6">Control your data and privacy preferences</p>

        {/* Analytics */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-medium mb-1">Usage Analytics</div>
              <div className="text-white/60 text-sm">Help us improve Arcle by sharing anonymous usage data</div>
            </div>
            <button
              onClick={onToggleAnalytics}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                analyticsEnabled ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute w-5 h-5 bg-onyx rounded-full transition-transform top-0.5 ${
                  analyticsEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Error Reporting */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-white font-medium mb-1">Error Reporting</div>
              <div className="text-white/60 text-sm">Automatically send error reports to help fix bugs</div>
            </div>
            <button
              onClick={onToggleErrorReporting}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                errorReportingEnabled ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute w-5 h-5 bg-onyx rounded-full transition-transform top-0.5 ${
                  errorReportingEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Data Privacy Info */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-6">
          <div className="text-white font-medium mb-2">Your Data Rights</div>
          <ul className="text-white/60 text-sm space-y-1">
            <li>• We never store your wallet private keys</li>
            <li>• Your transaction data is stored locally</li>
            <li>• You can request data export anytime</li>
            <li>• You can delete your account anytime</li>
          </ul>
        </div>

        {/* Delete Account Warning */}
        <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-white/60 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-medium mb-1">Delete Account</div>
              <div className="text-white/60 text-sm mb-3">
                This will permanently delete your profile, settings, and transaction history. Your wallet will remain intact.
              </div>
              <Button size="sm" className="bg-transparent border border-white/20 text-white hover:bg-white/10">
                Delete Account
              </Button>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <Button onClick={onClose} className="w-full bg-white text-onyx hover:bg-white/90 border border-white/20">
          Done
        </Button>
      </div>
    </div>
  );
}

