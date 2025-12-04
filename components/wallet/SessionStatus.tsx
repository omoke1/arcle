/**
 * Session Status Component
 * 
 * Displays active session info and allows manual revocation
 */

"use client";

import { useState, useEffect } from "react";
import type { CircleSessionKey } from "@/lib/wallet/sessionKeys/sessionPermissions";

interface SessionStatusProps {
  walletId: string;
  userId: string;
  userToken: string;
  onRevoke?: () => void;
}

export function SessionStatus({
  walletId,
  userId,
  userToken,
  onRevoke,
}: SessionStatusProps) {
  const [sessionKey, setSessionKey] = useState<CircleSessionKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    loadSessionStatus();
    
    // Poll for session updates every 30 seconds
    const interval = setInterval(() => {
      loadSessionStatus();
    }, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, userId, userToken]);

  const loadSessionStatus = async () => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    try {
      const { getActiveSession } = await import("@/lib/wallet/sessionKeys/sessionManager");
      const session = await getActiveSession(walletId, userId, userToken);
      setSessionKey(session);
    } catch (error) {
      console.error("[Session Status] Error loading session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!sessionKey || !confirm("Are you sure you want to revoke this session?")) {
      return;
    }

    setRevoking(true);
    try {
      const { revokeSession } = await import("@/lib/wallet/sessionKeys/sessionManager");
      const result = await revokeSession(
        sessionKey.sessionKeyId,
        userToken,
        walletId
      );

      if (result.success) {
        setSessionKey(null);
        onRevoke?.();
      } else {
        alert(`Failed to revoke session: ${result.error}`);
      }
    } catch (error: any) {
      console.error("[Session Status] Error revoking session:", error);
      alert(`Error revoking session: ${error.message}`);
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
        Loading session status...
      </div>
    );
  }

  if (!sessionKey) {
    return (
      <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
        No active session
      </div>
    );
  }

  const timeRemaining = Math.max(0, sessionKey.expiresAt * 1000 - Date.now());
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const spendingUsed = parseInt(sessionKey.permissions.spendingUsed || "0");
  const spendingLimit = parseInt(sessionKey.permissions.spendingLimit);
  const spendingPercent = spendingLimit > 0 ? (spendingUsed / spendingLimit) * 100 : 0;

  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h3 className="font-semibold text-blue-900">Active Session</h3>
        </div>
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="text-sm px-3 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-all font-medium"
        >
          {revoking ? "Revoking..." : "Revoke"}
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Time remaining:</span>
          <span className="font-semibold text-blue-900">
            {hoursRemaining > 0 ? `${hoursRemaining}h ` : ""}
            {minutesRemaining}m
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-600">Spending:</span>
            <span className="font-semibold text-blue-900">
              ${(spendingUsed / 1000000).toFixed(2)} / ${(spendingLimit / 1000000).toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                spendingPercent > 90 ? 'bg-red-500' : spendingPercent > 70 ? 'bg-yellow-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(spendingPercent, 100)}%` }}
            />
          </div>
        </div>

        <div>
          <span className="text-gray-600 block mb-1">Allowed actions:</span>
          <div className="flex flex-wrap gap-1.5">
            {sessionKey.permissions.allowedActions.map((action) => (
              <span
                key={action}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium"
              >
                {action}
              </span>
            ))}
          </div>
        </div>

        {sessionKey.permissions.autoRenew && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/50 rounded-lg p-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>
              Auto-renewal enabled ({sessionKey.permissions.renewalsUsed} / {sessionKey.permissions.maxRenewals} renewals used)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

