"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";

interface ScanReportsPageProps {
  onBack: () => void;
}

export function ScanReportsPage({ onBack }: ScanReportsPageProps) {
  return (
    <div className="flex flex-col h-full bg-dark-grey">
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button onClick={onBack} className="text-casper hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Scan Reports</h1>
        <div className="w-5 h-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        <p className="text-sm text-casper/70">No scan reports yet. Use Scan from the bottom menu to analyze an address.</p>
        {/* Future: render previous scans with risk scores */}
        {[].map((r: any) => (
          <div key={r.id} className="bg-onyx rounded-xl p-3 border border-dark-grey/50">
            <div className="flex items-center justify-between">
              <div className="text-white text-sm font-medium">{r.address}</div>
              <a href={r.explorer} target="_blank" rel="noopener noreferrer" className="text-casper hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="text-xs text-casper mt-1">Risk: {r.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

