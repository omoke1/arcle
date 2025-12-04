/**
 * Session Management Component
 * 
 * Full session management UI with view, revoke, renew, and details
 */

"use client";

import { useState, useEffect } from "react";
import type { CircleSessionKey } from "@/lib/wallet/sessionKeys/sessionPermissions";

interface SessionManagementProps {
  walletId: string;
  userId: string;
  userToken: string;
  onSessionUpdate?: () => void;
}

export function SessionManagement({
  walletId,
  userId,
  userToken,
  onSessionUpdate,
}: SessionManagementProps) {
  const [sessionKey, setSessionKey] = useState<CircleSessionKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadSession();
    const interval = setInterval(loadSession, 30000); // Poll every 30s
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, userId, userToken]);

  const loadSession = async () => {
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
      console.error("[Session Management] Error loading session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!sessionKey || !confirm("Are you sure you want to revoke this session? All automatic actions will stop.")) {
      return;
    }

    setRevoking(true);
    try {
      const response = await fetch("/api/circle/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          sessionKeyId: sessionKey.sessionKeyId,
          walletId,
          userId,
          userToken,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSessionKey(null);
        onSessionUpdate?.();
      } else {
        alert(`Failed to revoke session: ${result.error}`);
      }
    } catch (error: any) {
      console.error("[Session Management] Error revoking session:", error);
      alert(`Error revoking session: ${error.message}`);
    } finally {
      setRevoking(false);
    }
  };

  const handleRenew = async () => {
    if (!sessionKey) return;

    const newDuration = 24 * 60 * 60; // 24 hours
    setRenewing(true);
    try {
      const response = await fetch("/api/circle/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew",
          sessionKeyId: sessionKey.sessionKeyId,
          walletId,
          userId,
          userToken,
          newDuration,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await loadSession();
        onSessionUpdate?.();
      } else {
        alert(`Failed to renew session: ${result.error}`);
      }
    } catch (error: any) {
      console.error("[Session Management] Error renewing session:", error);
      alert(`Error renewing session: ${error.message}`);
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!sessionKey) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
        <p className="text-gray-600 mb-2">No active session</p>
        <p className="text-sm text-gray-500">
          Create a session to enable automatic transaction execution
        </p>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h3 className="font-semibold text-gray-900">Session Management</h3>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Time Remaining */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Time Remaining</span>
            <span className="font-semibold text-gray-900">
              {hoursRemaining > 0 ? `${hoursRemaining}h ` : ""}
              {minutesRemaining}m
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min((timeRemaining / (sessionKey.expiresAt * 1000 - sessionKey.createdAt * 1000)) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Spending */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600">Spending</span>
            <span className="font-semibold text-gray-900">
              ${(spendingUsed / 1000000).toFixed(2)} / ${(spendingLimit / 1000000).toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                spendingPercent > 90 ? 'bg-red-500' : spendingPercent > 70 ? 'bg-yellow-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(spendingPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Details */}
        {showDetails && (
          <div className="pt-4 border-t border-gray-200 space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Session ID:</span>
              <span className="ml-2 font-mono text-xs text-gray-900 break-all">
                {sessionKey.sessionKeyId}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Created:</span>
              <span className="ml-2 text-gray-900">
                {new Date(sessionKey.createdAt * 1000).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Expires:</span>
              <span className="ml-2 text-gray-900">
                {new Date(sessionKey.expiresAt * 1000).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Allowed Actions:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {sessionKey.permissions.allowedActions.map((action) => (
                  <span
                    key={action}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>
            {sessionKey.mscaAddress && (
              <div>
                <span className="text-gray-600">MSCA Address:</span>
                <span className="ml-2 font-mono text-xs text-gray-900 break-all">
                  {sessionKey.mscaAddress}
                </span>
              </div>
            )}
            {sessionKey.sessionKeyAddress && (
              <div>
                <span className="text-gray-600">Session Key Address:</span>
                <span className="ml-2 font-mono text-xs text-gray-900 break-all">
                  {sessionKey.sessionKeyAddress}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          {sessionKey.permissions.autoRenew && (
            <button
              onClick={handleRenew}
              disabled={renewing || !sessionKey.permissions.autoRenew}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              {renewing ? "Renewing..." : "Renew Session"}
            </button>
          )}
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {revoking ? "Revoking..." : "Revoke Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

