/**
 * Auto Execution Badge
 * 
 * Shows when a transaction was executed automatically via session key
 */

"use client";

interface AutoExecutionBadgeProps {
  executedViaSessionKey?: boolean;
  className?: string;
}

export function AutoExecutionBadge({ executedViaSessionKey, className = "" }: AutoExecutionBadgeProps) {
  if (!executedViaSessionKey) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium ${className}`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      Auto-executed
    </span>
  );
}

