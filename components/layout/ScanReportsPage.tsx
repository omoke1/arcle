"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";

interface ScanReportsPageProps {
  onBack: () => void;
}

export function ScanReportsPage({ onBack }: ScanReportsPageProps) {
  return (
    <div className="flex flex-col h-full bg-graphite/30">
      <div className="px-6 py-4 border-b border-graphite/50 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack} className="text-soft-mist/70 hover:text-signal-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-signal-white">Scan Reports</h1>
        <div className="w-5 h-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        <p className="text-sm text-soft-mist/70">No scan reports yet. Use Scan from the chat to analyze an address.</p>
        {/* Future: render previous scans with risk scores */}
        {[].map((r: any) => (
          <div key={r.id} className="bg-graphite/50 rounded-xl p-3 border border-graphite/60">
            <div className="flex items-center justify-between">
              <div className="text-signal-white text-sm font-medium">{r.address}</div>
              <a href={r.explorer} target="_blank" rel="noopener noreferrer" className="text-soft-mist/70 hover:text-signal-white">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="text-xs text-soft-mist/70 mt-1">Risk: {r.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

