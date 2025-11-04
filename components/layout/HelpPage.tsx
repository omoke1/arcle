"use client";

import { ArrowLeft, HelpCircle, Book, MessageCircle, FileText, ExternalLink } from "lucide-react";

interface HelpPageProps {
  onBack: () => void;
}

export function HelpPage({ onBack }: HelpPageProps) {
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
        <h1 className="text-lg font-semibold text-white">Help & Support</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Help Options */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <Book className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Documentation</div>
              <div className="text-xs text-casper/70">Learn how to use ARCLE</div>
            </div>
            <ExternalLink className="w-4 h-4 text-casper" />
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <MessageCircle className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Contact Support</div>
              <div className="text-xs text-casper/70">Get help from our team</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <FileText className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">FAQ</div>
              <div className="text-xs text-casper/70">Frequently asked questions</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors">
            <HelpCircle className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Report a Bug</div>
              <div className="text-xs text-casper/70">Found an issue? Let us know</div>
            </div>
          </button>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-white px-3">Quick Tips</h3>
          <div className="bg-onyx rounded-xl px-4 py-3 space-y-2">
            <p className="text-sm text-casper/70">
              • Use natural language to send transactions
            </p>
            <p className="text-sm text-casper/70">
              • Check transaction history in the sidebar
            </p>
            <p className="text-sm text-casper/70">
              • Your wallet address is available on request
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

