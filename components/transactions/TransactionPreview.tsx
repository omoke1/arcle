"use client";

import { AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { arcUtils } from "@/lib/arc";

interface TransactionPreviewProps {
  type: "send" | "receive";
  amount: string;
  to?: string;
  from?: string;
  network?: string;
  fee?: string;
  riskScore?: number;
  riskReasons?: string[];
  onConfirm?: () => void;
  onCancel?: () => void;
  status?: "pending" | "preview" | "confirmed" | "failed" | "blocked";
}

export function TransactionPreview({
  type,
  amount,
  to,
  from,
  network = "Arc",
  fee,
  riskScore,
  riskReasons = [],
  onConfirm,
  onCancel,
  status = "preview",
}: TransactionPreviewProps) {
  const isSend = type === "send";
  const isPreview = status === "preview";
  const isConfirmed = status === "confirmed";
  const isPending = status === "pending";
  const isFailed = status === "failed";
  const isBlocked = status === "blocked" || (riskScore !== undefined && riskScore >= 80);

  const getRiskColor = () => {
    if (!riskScore) return "text-casper";
    if (riskScore >= 80) return "text-danger";
    if (riskScore >= 30) return "text-warning";
    return "text-success";
  };

  const getRiskLabel = () => {
    if (!riskScore) return null;
    if (riskScore >= 80) return "High Risk";
    if (riskScore >= 30) return "Medium Risk";
    return "Low Risk";
  };

  return (
    <div className="bg-dark-grey rounded-2xl p-6 border border-casper/20 mb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {isConfirmed && (
          <CheckCircle2 className="w-6 h-6 text-success" />
        )}
        {isPending && (
          <Clock className="w-6 h-6 text-warning animate-spin" />
        )}
        {isFailed && (
          <AlertCircle className="w-6 h-6 text-danger" />
        )}
        {isPreview && (
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {isSend ? "Send" : "Receive"} {amount} USDC
          </h3>
          {status !== "preview" && (
            <p className="text-sm text-casper capitalize">{status}</p>
          )}
        </div>
      </div>

      {/* Transaction Details */}
      <div className="space-y-3 mb-4">
        {from && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-casper">From</span>
            <span className="text-sm text-white font-mono">
              {arcUtils.formatAddress(from)}
            </span>
          </div>
        )}
        {to && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-casper">
              {isSend ? "To" : "From"}
            </span>
            <span className="text-sm text-white font-mono">
              {arcUtils.formatAddress(to)}
            </span>
          </div>
        )}
        {network && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-casper">Network</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">{network}</span>
              {network === "Arc" && (
                <span className="text-xs text-success px-2 py-0.5 bg-success/20 rounded">
                  ~1s finality
                </span>
              )}
            </div>
          </div>
        )}
        {fee && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-casper">Gas Fee</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white">~${fee} USDC</span>
              {network === "Arc" && (
                <span className="text-xs text-success">(USDC for gas)</span>
              )}
            </div>
          </div>
        )}
        {riskScore !== undefined && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-casper">Risk Score</span>
              <span className={cn("text-sm font-semibold", getRiskColor())}>
                {riskScore}/100 {getRiskLabel() && `(${getRiskLabel()})`}
              </span>
            </div>
            {riskReasons.length > 0 && (
              <div className="pt-2 border-t border-casper/10">
                <p className="text-xs text-casper mb-2">Risk Factors:</p>
                <ul className="space-y-1">
                  {riskReasons.map((reason, index) => (
                    <li key={index} className="text-xs text-casper flex items-start gap-2">
                      <span className="text-danger mt-1">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Risk Warning Banner */}
      {isBlocked && (
        <div className="bg-danger/20 border border-danger rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger mb-1">
                Transaction Blocked
              </p>
              <p className="text-xs text-casper">
                This transaction has been blocked for your safety. Please verify the recipient address before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      {riskScore !== undefined && riskScore >= 40 && riskScore < 80 && (
        <div className="bg-warning/20 border border-warning rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning mb-1">
                Medium Risk Warning
              </p>
              <p className="text-xs text-casper">
                Please review the risk factors carefully before confirming this transaction.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {isPreview && (
        <div className="flex gap-3 pt-4 border-t border-casper/20">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          {isBlocked ? (
            <Button
              disabled
              className="flex-1 bg-danger/50 cursor-not-allowed"
            >
              Blocked
            </Button>
          ) : (
            <Button
              onClick={onConfirm}
              className={cn(
                "flex-1",
                riskScore !== undefined && riskScore >= 40
                  ? "bg-warning hover:bg-warning/80"
                  : "bg-white hover:bg-white/80 text-onyx"
              )}
            >
              {riskScore !== undefined && riskScore >= 40
                ? "Proceed with Caution"
                : "Confirm"}
            </Button>
          )}
        </div>
      )}

      {isPending && (
        <div className="pt-4 border-t border-casper/20">
          <p className="text-sm text-casper text-center">
            Transaction is being processed...
          </p>
        </div>
      )}

      {isConfirmed && (
        <div className="pt-4 border-t border-casper/20">
          <p className="text-sm text-success text-center">
            ✅ Transaction confirmed!
          </p>
        </div>
      )}

      {isFailed && (
        <div className="pt-4 border-t border-casper/20">
          <p className="text-sm text-danger text-center">
            Transaction failed. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}

