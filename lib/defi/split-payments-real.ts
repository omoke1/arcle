/**
 * REAL Split Payments Implementation using Batch Transactions
 * Built on top of Circle's native batch operation support
 */

import { executeBatchTransfers, validateBatchTransfers, type BatchTransfer } from "./batch-transactions-real";

export interface SplitPaymentRecipient {
  address: string;
  amount?: string; // If not provided, will be calculated from percentage
  percentage?: number; // If not provided, will split evenly
  name?: string; // Optional name for display
}

export interface SplitPaymentResult {
  success: boolean;
  transactionId?: string;
  transactionHash?: string;
  error?: string;
  recipients: SplitPaymentRecipient[];
  totalAmount: string;
  splits: Array<{ recipient: string; amount: string; percentage: string }>;
}

/**
 * Split a payment among multiple recipients
 * Can split evenly or by percentage
 */
export async function executeSplitPayment(
  walletId: string,
  totalAmount: string,
  recipients: SplitPaymentRecipient[],
  blockchain: string = "ARC-TESTNET"
): Promise<SplitPaymentResult> {
  try {
    console.log(`[Split Payment] Splitting ${totalAmount} USDC among ${recipients.length} recipients`);

    // Validate inputs
    const validation = validateSplitPayment(totalAmount, recipients);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        recipients,
        totalAmount,
        splits: [],
      };
    }

    // Calculate splits
    const splits = calculateSplits(totalAmount, recipients);

    // Convert to batch transfers
    const batchTransfers: BatchTransfer[] = splits.map((split) => ({
      to: split.recipient,
      amount: split.amount,
    }));

    // Execute batch transaction
    const result = await executeBatchTransfers(walletId, batchTransfers, blockchain);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        recipients,
        totalAmount,
        splits,
      };
    }

    console.log(`[Split Payment] ✅ Split payment successful: ${result.transactionId}`);

    return {
      success: true,
      transactionId: result.transactionId,
      transactionHash: result.transactionHash,
      recipients,
      totalAmount,
      splits,
    };
  } catch (error: any) {
    console.error(`[Split Payment] Error:`, error);
    return {
      success: false,
      error: error.message || "Failed to execute split payment",
      recipients,
      totalAmount,
      splits: [],
    };
  }
}

/**
 * Calculate how to split the total amount among recipients
 */
function calculateSplits(
  totalAmount: string,
  recipients: SplitPaymentRecipient[]
): Array<{ recipient: string; amount: string; percentage: string }> {
  const total = parseFloat(totalAmount);

  // Check if all recipients have explicit amounts
  const hasExplicitAmounts = recipients.every((r) => r.amount);
  if (hasExplicitAmounts) {
    return recipients.map((r) => ({
      recipient: r.address,
      amount: r.amount!,
      percentage: ((parseFloat(r.amount!) / total) * 100).toFixed(2),
    }));
  }

  // Check if all recipients have percentages
  const hasPercentages = recipients.every((r) => r.percentage !== undefined);
  if (hasPercentages) {
    return recipients.map((r) => {
      const amount = (total * (r.percentage! / 100)).toFixed(6);
      return {
        recipient: r.address,
        amount,
        percentage: r.percentage!.toFixed(2),
      };
    });
  }

  // Default: split evenly
  const perRecipient = total / recipients.length;
  const percentage = (100 / recipients.length).toFixed(2);

  return recipients.map((r) => ({
    recipient: r.address,
    amount: perRecipient.toFixed(6),
    percentage,
  }));
}

/**
 * Validate split payment inputs
 */
function validateSplitPayment(
  totalAmount: string,
  recipients: SplitPaymentRecipient[]
): { valid: boolean; error?: string } {
  // Validate total amount
  const total = parseFloat(totalAmount);
  if (isNaN(total) || total <= 0) {
    return { valid: false, error: "Invalid total amount" };
  }

  // Validate recipients
  if (!recipients || recipients.length === 0) {
    return { valid: false, error: "No recipients provided" };
  }

  if (recipients.length > 50) {
    return { valid: false, error: "Too many recipients (max 50)" };
  }

  // Validate addresses
  for (const recipient of recipients) {
    if (!recipient.address || !recipient.address.startsWith("0x") || recipient.address.length !== 42) {
      return { valid: false, error: `Invalid recipient address: ${recipient.address}` };
    }
  }

  // If using percentages, ensure they add up to 100%
  const hasPercentages = recipients.some((r) => r.percentage !== undefined);
  if (hasPercentages) {
    const allHavePercentages = recipients.every((r) => r.percentage !== undefined);
    if (!allHavePercentages) {
      return { valid: false, error: "All recipients must have percentages if any do" };
    }

    const totalPercentage = recipients.reduce((sum, r) => sum + (r.percentage || 0), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      return { valid: false, error: `Percentages must add up to 100% (got ${totalPercentage}%)` };
    }
  }

  // If using explicit amounts, ensure they add up to total
  const hasExplicitAmounts = recipients.some((r) => r.amount);
  if (hasExplicitAmounts) {
    const allHaveAmounts = recipients.every((r) => r.amount);
    if (!allHaveAmounts) {
      return { valid: false, error: "All recipients must have amounts if any do" };
    }

    const sumOfAmounts = recipients.reduce((sum, r) => sum + parseFloat(r.amount!), 0);
    if (Math.abs(sumOfAmounts - total) > 0.01) {
      return { valid: false, error: `Sum of amounts (${sumOfAmounts}) doesn't match total (${total})` };
    }
  }

  return { valid: true };
}

/**
 * Helper: Calculate even split
 */
export function calculateEvenSplit(totalAmount: string, numberOfRecipients: number): string[] {
  const total = parseFloat(totalAmount);
  const perRecipient = total / numberOfRecipients;
  return Array(numberOfRecipients).fill(perRecipient.toFixed(6));
}

/**
 * Helper: Calculate percentage split
 */
export function calculatePercentageSplit(
  totalAmount: string,
  percentages: number[]
): string[] {
  const total = parseFloat(totalAmount);
  return percentages.map((pct) => (total * (pct / 100)).toFixed(6));
}

/**
 * Format split payment summary for display
 */
export function formatSplitSummary(result: SplitPaymentResult): string {
  if (!result.success) {
    return `❌ Split payment failed: ${result.error}`;
  }

  let summary = `✅ Split Payment Successful\n\n`;
  summary += `Total: ${result.totalAmount} USDC\n`;
  summary += `Recipients: ${result.splits.length}\n\n`;

  result.splits.forEach((split, index) => {
    const recipient = result.recipients.find((r) => r.address === split.recipient);
    const name = recipient?.name || `Recipient ${index + 1}`;
    const shortAddr = `${split.recipient.substring(0, 6)}...${split.recipient.substring(38)}`;
    summary += `${index + 1}. ${name}\n`;
    summary += `   ${shortAddr}\n`;
    summary += `   ${split.amount} USDC (${split.percentage}%)\n\n`;
  });

  if (result.transactionHash) {
    summary += `\nTransaction: ${result.transactionHash}`;
  }

  return summary;
}



