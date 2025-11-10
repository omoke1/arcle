/**
 * Split Payments Service
 * 
 * Split payments across multiple recipients
 */

export interface SplitPaymentRequest {
  totalAmount: string;
  recipients: Array<{
    address: string;
    amount: string;
    name?: string;
  }>;
  walletId: string;
  walletAddress: string;
}

export interface SplitPaymentResult {
  success: boolean;
  transactionIds: string[];
  message: string;
  failedRecipients?: Array<{ address: string; error: string }>;
}

/**
 * Execute split payment
 */
export async function executeSplitPayment(
  request: SplitPaymentRequest
): Promise<SplitPaymentResult> {
  try {
    // Validate total matches sum of recipients
    const totalRecipientAmount = request.recipients.reduce(
      (sum, r) => sum + parseFloat(r.amount),
      0
    );
    
    const totalRequestAmount = parseFloat(request.totalAmount);
    const difference = Math.abs(totalRecipientAmount - totalRequestAmount);
    
    if (difference > 0.01) { // Allow 0.01 USDC tolerance for rounding
      return {
        success: false,
        transactionIds: [],
        message: `Total amount (${request.totalAmount}) does not match sum of recipients (${totalRecipientAmount.toFixed(6)})`,
      };
    }
    
    // Execute transactions for each recipient
    const transactionIds: string[] = [];
    const failedRecipients: Array<{ address: string; error: string }> = [];
    
    for (const recipient of request.recipients) {
      try {
        // In production, would use actual sendTransaction
        // For now, simulate
        const txId = crypto.randomUUID();
        transactionIds.push(txId);
        
        // Note: In production, you'd need to batch these or use a multi-send contract
        // For now, we'll execute sequentially
      } catch (error: any) {
        failedRecipients.push({
          address: recipient.address,
          error: error.message || "Transaction failed",
        });
      }
    }
    
    if (failedRecipients.length > 0) {
      return {
        success: false,
        transactionIds,
        message: `Split payment partially failed. ${transactionIds.length} succeeded, ${failedRecipients.length} failed.`,
        failedRecipients,
      };
    }
    
    return {
      success: true,
      transactionIds,
      message: `Split payment successful: ${request.recipients.length} recipients paid`,
    };
  } catch (error: any) {
    return {
      success: false,
      transactionIds: [],
      message: error.message || "Split payment failed",
    };
  }
}

/**
 * Calculate split amounts evenly
 */
export function calculateEvenSplit(
  totalAmount: string,
  numberOfRecipients: number
): string[] {
  const total = parseFloat(totalAmount);
  const perRecipient = total / numberOfRecipients;
  
  // Distribute remainder to first recipients
  const amounts: string[] = [];
  const baseAmount = Math.floor(perRecipient * 1e6) / 1e6; // Round to 6 decimals
  const remainder = total - (baseAmount * numberOfRecipients);
  
  for (let i = 0; i < numberOfRecipients; i++) {
    if (i === 0) {
      amounts.push((baseAmount + remainder).toFixed(6));
    } else {
      amounts.push(baseAmount.toFixed(6));
    }
  }
  
  return amounts;
}

/**
 * Calculate split amounts by percentage
 */
export function calculatePercentageSplit(
  totalAmount: string,
  percentages: number[]
): string[] {
  const total = parseFloat(totalAmount);
  const sumPercentages = percentages.reduce((sum, p) => sum + p, 0);
  
  if (Math.abs(sumPercentages - 100) > 0.01) {
    throw new Error("Percentages must sum to 100");
  }
  
  return percentages.map(p => {
    const amount = (total * p) / 100;
    return amount.toFixed(6);
  });
}

