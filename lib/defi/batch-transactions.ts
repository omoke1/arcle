/**
 * Batch Transactions Service
 * 
 * Execute multiple transactions in a single batch for gas efficiency
 */

export interface BatchTransaction {
  id: string;
  to: string;
  amount: string;
  data?: string; // Optional contract call data
}

export interface BatchExecution {
  id: string;
  transactions: BatchTransaction[];
  status: "pending" | "executing" | "completed" | "failed";
  transactionHash?: string;
  executedAt?: Date;
  gasUsed?: string;
  error?: string;
}

/**
 * Create batch transaction
 */
export function createBatch(transactions: BatchTransaction[]): BatchExecution {
  const batch: BatchExecution = {
    id: crypto.randomUUID(),
    transactions,
    status: "pending",
  };
  
  // Store batch
  if (typeof window !== "undefined") {
    const batches = getStoredBatches();
    batches.push(batch);
    localStorage.setItem("arcle_batch_transactions", JSON.stringify(batches));
  }
  
  return batch;
}

/**
 * Execute batch transactions
 */
export async function executeBatch(
  walletId: string,
  walletAddress: string,
  batch: BatchExecution
): Promise<BatchExecution> {
  try {
    batch.status = "executing";
    
    // In production, this would:
    // 1. Use a batch contract (like Multicall) to execute all transactions at once
    // 2. Or use Circle's batch transaction API if available
    // 3. Calculate total gas needed
    
    // For now, simulate batch execution
    // In a real implementation, you'd use a multicall contract:
    // const multicallContract = "0x..."; // Multicall contract address
    // const calls = batch.transactions.map(tx => ({
    //   target: tx.to,
    //   callData: tx.data || "0x",
    //   value: parseUnits(tx.amount, 6).toString(), // USDC has 6 decimals
    // }));
    // const result = await client.writeContract({
    //   address: multicallContract,
    //   abi: multicallAbi,
    //   functionName: "aggregate",
    //   args: [calls],
    // });
    
    batch.status = "completed";
    batch.transactionHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;
    batch.executedAt = new Date();
    batch.gasUsed = "0.005"; // Estimated gas for batch
    
    // Update stored batch
    if (typeof window !== "undefined") {
      const batches = getStoredBatches();
      const index = batches.findIndex(b => b.id === batch.id);
      if (index >= 0) {
        batches[index] = batch;
        localStorage.setItem("arcle_batch_transactions", JSON.stringify(batches));
      }
    }
    
    return batch;
  } catch (error: any) {
    batch.status = "failed";
    batch.error = error.message || "Batch execution failed";
    
    // Update stored batch
    if (typeof window !== "undefined") {
      const batches = getStoredBatches();
      const index = batches.findIndex(b => b.id === batch.id);
      if (index >= 0) {
        batches[index] = batch;
        localStorage.setItem("arcle_batch_transactions", JSON.stringify(batches));
      }
    }
    
    return batch;
  }
}

/**
 * Get batch transaction history
 */
export function getBatchHistory(): BatchExecution[] {
  return getStoredBatches();
}

/**
 * Get stored batches from localStorage
 */
function getStoredBatches(): BatchExecution[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_batch_transactions");
    if (stored) {
      const batches = JSON.parse(stored) as any[];
      return batches.map(b => ({
        ...b,
        executedAt: b.executedAt ? new Date(b.executedAt) : undefined,
      }));
    }
  } catch (error) {
    console.error("Error loading batch transactions:", error);
  }
  
  return [];
}

