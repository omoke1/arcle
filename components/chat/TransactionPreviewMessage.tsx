"use client";

import { TransactionPreview } from "@/components/transactions/TransactionPreview";

interface TransactionPreviewMessageProps {
  amount: string;
  to: string;
  from?: string;
  fee?: string;
  riskScore?: number;
  riskReasons?: string[];
  blocked?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function TransactionPreviewMessage({
  amount,
  to,
  from,
  fee,
  riskScore,
  riskReasons = [],
  blocked = false,
  onConfirm,
  onCancel,
}: TransactionPreviewMessageProps) {
  return (
    <div className="mt-2 max-w-md">
      <TransactionPreview
        type="send"
        amount={amount}
        to={to}
        from={from}
        network="Arc"
        fee={fee}
        riskScore={riskScore}
        riskReasons={riskReasons}
        onConfirm={onConfirm}
        onCancel={onCancel}
        status={blocked || (riskScore !== undefined && riskScore >= 80) ? "blocked" : "preview"}
      />
    </div>
  );
}

