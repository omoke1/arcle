/**
 * ArcScan API Integration
 * 
 * ArcScan Testnet API: https://testnet.arcscan.app/api-docs
 * 
 * This utility provides functions to interact with ArcScan API
 * for transaction verification and status checking.
 */

const ARCSCAN_API_URL = process.env.NEXT_PUBLIC_ARCSCAN_API_URL || 
  (process.env.NEXT_PUBLIC_ENV === "production" 
    ? "https://arcscan.app/api" 
    : "https://testnet.arcscan.app/api");

/**
 * ArcScan API Response Types
 */
interface ArcScanTransactionResponse {
  status: string;
  message: string;
  result?: {
    hash: string;
    blockNumber: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    timeStamp: string;
    status: string;
    isError: string;
    contractAddress?: string;
  };
}

interface ArcScanTransactionReceiptResponse {
  status: string;
  message: string;
  result?: {
    transactionHash: string;
    transactionIndex: string;
    blockHash: string;
    blockNumber: string;
    from: string;
    to: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    contractAddress?: string;
    logs: any[];
    status: string;
  };
}

/**
 * Get transaction details from ArcScan API
 * 
 * @param txHash - Transaction hash (0x...)
 * @returns Transaction details or null if not found
 */
export async function getTransactionFromArcScan(
  txHash: string
): Promise<ArcScanTransactionResponse['result'] | null> {
  try {
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      console.error("[ArcScan] Invalid transaction hash:", txHash);
      return null;
    }

    // ArcScan API endpoint: GET /api?module=proxy&action=eth_getTransactionByHash&txhash={hash}
    const response = await fetch(
      `${ARCSCAN_API_URL}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[ArcScan] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: ArcScanTransactionResponse = await response.json();

    if (data.status === "1" && data.result) {
      return data.result;
    }

    // Transaction might not be indexed yet
    if (data.message === "No transactions found" || data.message === "NOTOK") {
      return null;
    }

    console.warn("[ArcScan] Unexpected response:", data);
    return null;
  } catch (error) {
    console.error("[ArcScan] Error fetching transaction:", error);
    return null;
  }
}

/**
 * Get transaction receipt from ArcScan API
 * 
 * @param txHash - Transaction hash (0x...)
 * @returns Transaction receipt or null if not found
 */
export async function getTransactionReceiptFromArcScan(
  txHash: string
): Promise<ArcScanTransactionReceiptResponse['result'] | null> {
  try {
    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      console.error("[ArcScan] Invalid transaction hash:", txHash);
      return null;
    }

    // ArcScan API endpoint: GET /api?module=proxy&action=eth_getTransactionReceipt&txhash={hash}
    const response = await fetch(
      `${ARCSCAN_API_URL}?module=proxy&action=eth_getTransactionReceipt&txhash=${txHash}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[ArcScan] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: ArcScanTransactionReceiptResponse = await response.json();

    if (data.status === "1" && data.result) {
      return data.result;
    }

    // Transaction might not be indexed yet
    if (data.message === "No transactions found" || data.message === "NOTOK") {
      return null;
    }

    console.warn("[ArcScan] Unexpected response:", data);
    return null;
  } catch (error) {
    console.error("[ArcScan] Error fetching transaction receipt:", error);
    return null;
  }
}

/**
 * Check if transaction exists and is confirmed on ArcScan
 * 
 * @param txHash - Transaction hash (0x...)
 * @returns true if transaction exists and is confirmed, false otherwise
 */
export async function isTransactionConfirmed(txHash: string): Promise<boolean> {
  const receipt = await getTransactionReceiptFromArcScan(txHash);
  return receipt !== null && receipt !== undefined && receipt.status === "1";
}

/**
 * Get transaction status from ArcScan
 * 
 * @param txHash - Transaction hash (0x...)
 * @returns Transaction status: "pending" | "confirmed" | "failed" | "not_found"
 */
export async function getTransactionStatusFromArcScan(
  txHash: string
): Promise<"pending" | "confirmed" | "failed" | "not_found"> {
  const receipt = await getTransactionReceiptFromArcScan(txHash);
  
  if (!receipt) {
    // Check if transaction exists but receipt not available (pending)
    const tx = await getTransactionFromArcScan(txHash);
    if (tx) {
      return "pending";
    }
    return "not_found";
  }

  // Status "1" means success, "0" means failed
  if (receipt.status === "1") {
    return "confirmed";
  } else if (receipt.status === "0") {
    return "failed";
  }

  return "pending";
}

/**
 * Poll ArcScan for transaction hash by wallet address and transaction details
 * 
 * This can be used as a fallback when Circle doesn't provide the hash immediately.
 * We can search for recent transactions from a wallet address.
 * 
 * @param walletAddress - Wallet address that sent the transaction
 * @param toAddress - Destination address
 * @param amount - Amount in smallest unit (6 decimals for USDC)
 * @param maxAgeSeconds - Maximum age of transaction to search for (default: 60 seconds)
 * @returns Transaction hash if found, null otherwise
 */
export async function findTransactionByDetails(
  walletAddress: string,
  toAddress: string,
  amount: string,
  maxAgeSeconds: number = 60
): Promise<string | null> {
  try {
    // ArcScan API: GET /api?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&sort=desc
    const response = await fetch(
      `${ARCSCAN_API_URL}?module=account&action=txlist&address=${walletAddress}&startblock=0&endblock=99999999&sort=desc&page=1&offset=10`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.status !== "1" || !data.result || !Array.isArray(data.result)) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const maxAge = now - maxAgeSeconds;

    // Find matching transaction
    for (const tx of data.result) {
      // Check if transaction is recent enough
      const txTimestamp = parseInt(tx.timeStamp);
      if (txTimestamp < maxAge) {
        continue; // Too old
      }

      // Check if destination matches
      if (tx.to?.toLowerCase() !== toAddress.toLowerCase()) {
        continue;
      }

      // Check if amount matches (with some tolerance for gas fees)
      const txValue = BigInt(tx.value || "0");
      const expectedAmount = BigInt(amount);
      const tolerance = BigInt("1000"); // Allow 0.001 USDC tolerance

      if (txValue >= expectedAmount - tolerance && txValue <= expectedAmount + tolerance) {
        return tx.hash;
      }
    }

    return null;
  } catch (error) {
    console.error("[ArcScan] Error finding transaction:", error);
    return null;
  }
}

