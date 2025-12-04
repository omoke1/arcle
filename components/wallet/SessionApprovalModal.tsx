/**
 * Session Approval Modal
 * 
 * Single approval modal for entire session
 * User approves spending limit, duration, and allowed actions once per session
 */

"use client";

import { useState, useEffect } from "react";
import { PERMISSION_SCOPES } from "@/lib/wallet/permissions/permissionScopes";
import type { ActionScope } from "@/lib/wallet/permissions/permissionScopes";

interface SessionApprovalModalProps {
  isOpen: boolean;
  onApprove: (config: {
    spendingLimit: string;
    duration: number;
    allowedActions: string[];
    autoRenew: boolean;
  }) => void;
  onCancel: () => void;
  currentSession?: {
    spendingLimit: string;
    spendingUsed: string;
    expiresAt: number;
    allowedActions: string[];
  };
}

const DURATION_OPTIONS = [
  { label: "30 minutes", value: 30 * 60 },
  { label: "1 hour", value: 60 * 60 },
  { label: "24 hours", value: 24 * 60 * 60 },
  { label: "Custom", value: 0 },
];

const SPENDING_LIMIT_OPTIONS = [
  { label: "$100", value: "100000000" },
  { label: "$500", value: "500000000" },
  { label: "$1,000", value: "1000000000" },
  { label: "$5,000", value: "5000000000" },
  { label: "Custom", value: "0" },
];

export function SessionApprovalModal({
  isOpen,
  onApprove,
  onCancel,
  currentSession,
}: SessionApprovalModalProps) {
  const [selectedScope, setSelectedScope] = useState<string>("trading");
  const [spendingLimit, setSpendingLimit] = useState<string>("1000000000");
  const [customSpendingLimit, setCustomSpendingLimit] = useState<string>("");
  const [duration, setDuration] = useState<number>(60 * 60);
  const [customDuration, setCustomDuration] = useState<string>("");
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [showCustomSpending, setShowCustomSpending] = useState<boolean>(false);
  const [showCustomDuration, setShowCustomDuration] = useState<boolean>(false);

  useEffect(() => {
    if (currentSession) {
      setSpendingLimit(currentSession.spendingLimit);
      const scope = Object.entries(PERMISSION_SCOPES).find(
        ([_, scope]) => scope.actions.join(",") === currentSession.allowedActions.join(",")
      )?.[0] || "trading";
      setSelectedScope(scope);
    }
  }, [currentSession]);

  if (!isOpen) return null;

  const scope = PERMISSION_SCOPES[selectedScope];
  const finalSpendingLimit = showCustomSpending && customSpendingLimit
    ? (parseFloat(customSpendingLimit) * 1000000).toString()
    : spendingLimit;

  const finalDuration = showCustomDuration && customDuration
    ? parseInt(customDuration) * 60
    : duration;

  const handleApprove = () => {
    if (!scope) return;

    if (showCustomSpending && (!customSpendingLimit || parseFloat(customSpendingLimit) <= 0)) {
      alert("Please enter a valid spending limit");
      return;
    }

    if (showCustomDuration && (!customDuration || parseInt(customDuration) <= 0)) {
      alert("Please enter a valid duration in minutes");
      return;
    }

    onApprove({
      spendingLimit: finalSpendingLimit,
      duration: finalDuration,
      allowedActions: scope.actions,
      autoRenew,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0D0D0C] border border-[#262626] rounded-2xl p-6 max-w-lg w-full mx-4 shadow-[0_24px_80px_rgba(0,0,0,0.85)] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(233,242,142,0.16)" }}>
            <svg className="w-6 h-6" style={{ color: "#E9F28E" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Approve Session</h2>
            <p className="text-sm text-white/60">One-time approval for automatic actions</p>
          </div>
        </div>
        
        <div className="rounded-lg p-4 mb-6 border border-[#E9F28E33]" style={{ backgroundColor: "rgba(233,242,142,0.06)" }}>
          <p className="text-sm text-white/80">
            <strong>Arcle</strong> wants to manage your wallet this session. You&apos;ll only need to approve once. 
            After approval, transactions will execute automatically within your set limits.
          </p>
        </div>

        {/* Permission Scope */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-white mb-2">
            Allowed Actions
          </label>
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="w-full p-3 bg-[#111111] border border-[#262626] rounded-lg focus:ring-2 focus:ring-[#E9F28E80] focus:border-[#E9F28E80] text-white text-sm transition-all"
          >
            {Object.entries(PERMISSION_SCOPES).map(([key, scope]) => (
              <option key={key} value={key}>
                {scope.name} - {scope.description}
              </option>
            ))}
          </select>
          {scope && (
            <div className="mt-2 flex flex-wrap gap-2">
              {scope.actions.map((action) => (
                <span
                  key={action}
                  className="px-2 py-1 text-xs rounded-full font-medium bg-[#1F1F1F] text-[#E9F28E] border border-[#E9F28E40]"
                >
                  {action}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Spending Limit */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-white mb-2">
            Spending Limit (USDC)
          </label>
          <select
            value={spendingLimit}
            onChange={(e) => {
              setSpendingLimit(e.target.value);
              setShowCustomSpending(e.target.value === "0");
            }}
            className="w-full p-3 bg-[#111111] border border-[#262626] rounded-lg focus:ring-2 focus:ring-[#E9F28E80] focus:border-[#E9F28E80] text-white text-sm transition-all mb-2"
          >
            {SPENDING_LIMIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {showCustomSpending && (
            <input
              type="number"
              placeholder="Enter amount in USDC"
              value={customSpendingLimit}
              onChange={(e) => setCustomSpendingLimit(e.target.value)}
              className="w-full p-3 bg-[#111111] border border-[#262626] rounded-lg focus:ring-2 focus:ring-[#E9F28E80] focus:border-[#E9F28E80] text-white text-sm transition-all"
              min="0"
              step="0.01"
            />
          )}
          {!showCustomSpending && (
            <p className="text-xs text-white/50 mt-1">
              Maximum amount that can be spent during this session
            </p>
          )}
        </div>

        {/* Duration */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-white mb-2">
            Session Duration
          </label>
          <select
            value={duration}
            onChange={(e) => {
              setDuration(parseInt(e.target.value));
              setShowCustomDuration(e.target.value === "0");
            }}
            className="w-full p-3 bg-[#111111] border border-[#262626] rounded-lg focus:ring-2 focus:ring-[#E9F28E80] focus:border-[#E9F28E80] text-white text-sm transition-all mb-2"
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {showCustomDuration && (
            <input
              type="number"
              placeholder="Enter duration in minutes"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className="w-full p-3 bg-[#111111] border border-[#262626] rounded-lg focus:ring-2 focus:ring-[#E9F28E80] focus:border-[#E9F28E80] text-white text-sm transition-all"
              min="1"
            />
          )}
        </div>

        {/* Auto-renew */}
        <div className="mb-6">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              className="w-5 h-5 text-[#E9F28E] border-[#444444] rounded focus:ring-[#E9F28E80] cursor-pointer bg-transparent"
            />
            <span className="ml-3 text-sm text-white/80 group-hover:text-white">
              Auto-renew session when it expires
            </span>
          </label>
          <p className="text-xs text-white/50 ml-8 mt-1">
            Automatically extend the session if it expires while you&apos;re using Arcle
          </p>
        </div>

        {/* Current session info */}
        {currentSession && (
          <div className="mb-4 p-3 rounded text-sm border border-[#262626]" style={{ backgroundColor: "#111111" }}>
            <p className="font-medium text-white">Current Session:</p>
            <p className="text-white/80">
              Used: ${(parseInt(currentSession.spendingUsed) / 1000000).toFixed(2)} / $
              {(parseInt(currentSession.spendingLimit) / 1000000).toFixed(2)}
            </p>
            <p className="text-white/70">Expires: {new Date(currentSession.expiresAt * 1000).toLocaleString()}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-[#262626]">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-[#262626] rounded-lg hover:bg-[#202020] hover:border-[#3A3A3A] font-medium text-white/80 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 px-4 py-3 rounded-lg font-semibold shadow-[0_0_24px_rgba(233,242,142,0.5)] transition-all transform hover:scale-[1.02] text-[#0D0D0C]"
            style={{ backgroundColor: "#E9F28E" }}
          >
            Approve Session
          </button>
        </div>
      </div>
    </div>
  );
}

