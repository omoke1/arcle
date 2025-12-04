"use client";

import { ArrowLeft, HelpCircle, Book, MessageCircle, FileText, ExternalLink } from "lucide-react";

interface HelpPageProps {
  onBack: () => void;
}

export function HelpPage({ onBack }: HelpPageProps) {
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
        <h1 className="text-lg font-semibold text-signal-white">Help & Support</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Help Options */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors">
            <Book className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Documentation</div>
              <div className="text-xs text-soft-mist/60">Learn how to use ARCLE</div>
            </div>
            <ExternalLink className="w-4 h-4 text-soft-mist/70" />
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors">
            <MessageCircle className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Contact Support</div>
              <div className="text-xs text-soft-mist/60">Get help from our team</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors">
            <FileText className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">FAQ</div>
              <div className="text-xs text-soft-mist/60">Frequently asked questions</div>
            </div>
          </button>

          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors">
            <HelpCircle className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Report a Bug</div>
              <div className="text-xs text-soft-mist/60">Found an issue? Let us know</div>
            </div>
          </button>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-signal-white px-3">Quick Tips</h3>
          <div className="bg-graphite/50 rounded-xl px-4 py-3 space-y-2 border border-graphite/60">
            <p className="text-sm text-soft-mist/70">
              • Use natural language to send transactions
            </p>
            <p className="text-sm text-soft-mist/70">
              • Check transaction history in the sidebar
            </p>
            <p className="text-sm text-soft-mist/70">
              • Your wallet address is available on request
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

