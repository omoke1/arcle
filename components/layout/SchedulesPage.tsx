"use client";

import { ArrowLeft, Pause, Play, Edit, Trash2 } from "lucide-react";
import { listSubscriptions } from "@/lib/subscriptions";
import { useEffect, useState } from "react";

interface SchedulesPageProps {
  onBack: () => void;
}

export function SchedulesPage({ onBack }: SchedulesPageProps) {
  const [subs, setSubs] = useState(() => listSubscriptions());
  useEffect(() => {
    setSubs(listSubscriptions());
  }, []);

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button onClick={onBack} className="text-casper hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Schedules</h1>
        <div className="w-5 h-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        {subs.length === 0 ? (
          <p className="text-sm text-casper/70">No schedules yet. Create one from the bottom menu → Schedule.</p>
        ) : (
          subs.map((s) => (
            <div key={s.id} className="bg-onyx rounded-xl p-3 border border-dark-grey/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">{s.merchant}</div>
                  <div className="text-xs text-casper mt-0.5">{s.amount} {s.currency} · {s.frequency} · next {new Date(s.nextChargeAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2 text-casper">
                  <button title="Pause"><Pause className="w-4 h-4" /></button>
                  <button title="Resume"><Play className="w-4 h-4" /></button>
                  <button title="Edit"><Edit className="w-4 h-4" /></button>
                  <button title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
