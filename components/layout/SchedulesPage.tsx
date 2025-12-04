"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Repeat, Play, Pause, Trash2 } from "lucide-react";
import { listSubscriptions, Subscription, SUBSCRIPTIONS_UPDATED_EVENT } from "@/lib/subscriptions";
import { listScheduledPayments, ScheduledPayment, SCHEDULE_UPDATED_EVENT } from "@/lib/scheduled-payments";

interface SchedulesPageProps {
  onBack: () => void;
  userId?: string | null;
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

function formatAddress(address?: string) {
  if (!address) return "Unknown";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function statusStyles(status: ScheduledPayment["status"]) {
  switch (status) {
    case "executed":
      return "bg-green-500/20 text-green-200";
    case "failed":
      return "bg-red-500/20 text-red-200";
    case "cancelled":
      return "bg-yellow-500/20 text-yellow-100";
    default:
      return "bg-blue-500/20 text-blue-200";
  }
}

export function SchedulesPage({ onBack, userId }: SchedulesPageProps) {
  const [scheduledPayments, setScheduledPayments] = useState<ScheduledPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setScheduledPayments([]);
      setSubscriptions([]);
      return;
    }

    let active = true;

    const sync = async () => {
      try {
        setIsLoading(true);
        const [payments, subs] = await Promise.all([
          listScheduledPayments(userId),
          listSubscriptions(userId),
        ]);
        if (!active) return;
        setScheduledPayments(payments);
        setSubscriptions(subs);
      } catch (error) {
        console.error("[SchedulesPage] Failed to load schedules:", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    sync();

    const handleUpdate = () => {
      sync().catch(console.error);
    };

    window.addEventListener(SCHEDULE_UPDATED_EVENT, handleUpdate);
    window.addEventListener(SUBSCRIPTIONS_UPDATED_EVENT, handleUpdate);

    return () => {
      active = false;
      window.removeEventListener(SCHEDULE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(SUBSCRIPTIONS_UPDATED_EVENT, handleUpdate);
    };
  }, [userId]);

  const sortedScheduled = useMemo(
    () => [...scheduledPayments].sort((a, b) => a.scheduledFor - b.scheduledFor),
    [scheduledPayments]
  );

  const sortedSubscriptions = useMemo(
    () => [...subscriptions].sort((a, b) => a.nextChargeAt - b.nextChargeAt),
    [subscriptions]
  );

  const hasScheduled = sortedScheduled.length > 0;
  const hasSubscriptions = sortedSubscriptions.length > 0;

  return (
    <div className="flex flex-col h-full bg-graphite/30">
      <div className="px-6 py-4 border-b border-graphite/50 flex items-center justify-between flex-shrink-0">
        <button onClick={onBack} className="text-soft-mist/70 hover:text-signal-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-signal-white">Schedules</h1>
        <div className="w-5 h-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-hide">
        <section>
          <div className="flex items-center gap-2 text-signal-white mb-2">
            <CalendarClock className="w-4 h-4 text-soft-mist/70" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-soft-mist/70">One-Time Payments</h2>
          </div>

          {!userId ? (
            <p className="text-sm text-soft-mist/70 bg-graphite/50 border border-graphite/60 rounded-xl p-4">
              Log in or create a wallet to manage scheduled payments.
            </p>
          ) : !hasScheduled ? (
            <p className="text-sm text-soft-mist/70 bg-graphite/50 border border-graphite/60 rounded-xl p-4">
              {isLoading ? "Loading scheduled payments..." : (
                <>
                  No one-time payments scheduled yet. Ask the AI to{" "}
                  <span className="text-signal-white font-medium">&quot;Schedule $50 to 0x... tomorrow at 3pm.&quot;</span>
                </>
              )}
            </p>
        ) : (
            <div className="space-y-3">
              {sortedScheduled.map((payment) => (
                <div key={payment.id} className="bg-graphite/50 rounded-xl p-3 border border-graphite/60">
                  <div className="flex items-center justify-between gap-3">
                <div>
                      <p className="text-signal-white text-sm font-semibold">
                        {payment.amount} {payment.currency}
                      </p>
                      <p className="text-xs text-soft-mist/70 mt-0.5">
                        To {formatAddress(payment.toAddress)}
                      </p>
                      <p className="text-xs text-soft-mist/60 mt-1">
                        Runs {formatDateTime(payment.scheduledFor)}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${statusStyles(payment.status)}`}>
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 text-signal-white mb-2">
            <Repeat className="w-4 h-4 text-soft-mist/70" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-soft-mist/70">Recurring Schedules</h2>
          </div>

          {!userId ? (
            <p className="text-sm text-soft-mist/70 bg-graphite/50 border border-graphite/60 rounded-xl p-4">
              Log in or create a wallet to manage recurring schedules.
            </p>
          ) : !hasSubscriptions ? (
            <p className="text-sm text-soft-mist/70 bg-graphite/50 border border-graphite/60 rounded-xl p-4">
              {isLoading ? "Loading subscriptions..." : (
                <>
                  No recurring subscriptions yet. Ask the AI for something like{" "}
                  <span className="text-signal-white font-medium">&quot;Subscribe $25 monthly to Netflix.&quot;</span>
                </>
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSubscriptions.map((sub) => (
                <div key={sub.id} className="bg-graphite/50 rounded-xl p-3 border border-graphite/60">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-signal-white text-sm font-semibold">{sub.merchant}</p>
                      <p className="text-xs text-soft-mist/70 mt-0.5">
                        {sub.amount} {sub.currency} · {sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1)}
                      </p>
                      <p className="text-xs text-soft-mist/60 mt-1">
                        Next charge {formatDateTime(sub.nextChargeAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-soft-mist/60">
                      <button title="Pause" className="hover:text-white">
                        {sub.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </button>
                      <button title="Cancel" className="hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        )}
        </section>
      </div>
    </div>
  );
}
