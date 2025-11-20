/**
 * USYC Yield/Savings Implementation for User-Controlled Wallets
 * 
 * USYC is Circle's yield-bearing token that earns the overnight federal funds rate
 * through reverse repo agreements backed by U.S. government securities.
 * 
 * This implementation uses User-Controlled Wallets SDK with challenge-based flow.
 */

import { executeContract, executeContractSequence, ContractExecutionResult } from '@/lib/circle-user-sdk-advanced';

// USYC Contract Addresses
const USYC_ADDRESSES: Record<string, { usyc: string; teller: string }> = {
  "ETH": {
    usyc: "0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b",
    teller: "0x5C73E1cfdD85b7f1d608F7F7736fC8C653513B7A", // USDC Teller
  },
  "ETH-SEPOLIA": {
    usyc: "0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b", // Testnet
    teller: "0x5C73E1cfdD85b7f1d608F7F7736fC8C653513B7A", // Testnet
  },
  "ARB": {
    usyc: "0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b",
    teller: "0x5C73E1cfdD85b7f1d608F7F7736fC8C653513B7A",
  },
  "ARC-TESTNET": {
    usyc: "0x136471a34f6ef19fE571EFFC1CA711fdb8E49f2b", // Placeholder - update when Arc supports USYC
    teller: "0x5C73E1cfdD85b7f1d608F7F7736fC8C653513B7A", // Placeholder
  },
};

const USDC_ADDRESSES: Record<string, string> = {
  "ETH": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "ETH-SEPOLIA": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "ARB": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "ARC-TESTNET": "0x0000000000000000000000000000000000000000", // Native USDC on Arc
};

export interface YieldPosition {
  usycBalance: string;
  usdcValue: string;
  initialInvestment: string;
  currentYield: string;
  yieldPercentage: string;
  apy: string;
  blockchain: string;
}

export interface SubscribeResult {
  success: boolean;
  challengeId?: string;
  transactionId?: string;
  transactionHash?: string;
  error?: string;
  usdcAmount: string;
  estimatedUSYC: string;
}

export interface RedeemResult {
  success: boolean;
  challengeId?: string;
  transactionId?: string;
  transactionHash?: string;
  error?: string;
  usycAmount: string;
  estimatedUSDC: string;
}

/**
 * Subscribe to USYC (deposit USDC to start earning yield)
 * User-Controlled version - creates challenges that user must complete
 */
export async function subscribeToUSYC(
  userId: string,
  userToken: string,
  walletId: string,
  usdcAmount: string,
  blockchain: string = "ETH"
): Promise<SubscribeResult> {
  try {
    if (!USYC_ADDRESSES[blockchain]) {
      return {
        success: false,
        error: `USYC not available on ${blockchain}. Available on: ${getAvailableBlockchains().join(', ')}`,
        usdcAmount,
        estimatedUSYC: "0",
      };
    }

    const { teller } = USYC_ADDRESSES[blockchain];
    const usdcAddress = USDC_ADDRESSES[blockchain];
    const amountInSmallestUnit = Math.floor(parseFloat(usdcAmount) * 1_000_000).toString();

    console.log(`[USYC User] Subscribing ${usdcAmount} USDC to USYC on ${blockchain}`);

    // Step 1: Approve Teller to spend USDC
    console.log(`[USYC User] Step 1: Creating approval challenge...`);
    
    const approveResult = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: usdcAddress,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [teller, amountInSmallestUnit],
      feeLevel: "MEDIUM",
      refId: `usyc-approve-${Date.now()}`,
    });

    if (!approveResult.success) {
      throw new Error(`Failed to approve USDC: ${approveResult.error}`);
    }

    console.log(`[USYC User] ✅ Approval challenge created: ${approveResult.challengeId}`);

    // Wait for approval to be completed by user
    console.log(`[USYC User] Waiting for user to complete approval...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Subscribe to USYC by calling buy() on Teller
    console.log(`[USYC User] Step 2: Creating subscription challenge...`);
    
    const subscribeResult = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: teller,
      abiFunctionSignature: "buy(uint256)",
      abiParameters: [amountInSmallestUnit],
      feeLevel: "MEDIUM",
      refId: `usyc-subscribe-${Date.now()}`,
    });

    if (!subscribeResult.success) {
      throw new Error(`Failed to subscribe to USYC: ${subscribeResult.error}`);
    }

    console.log(`[USYC User] ✅ Subscription challenge created: ${subscribeResult.challengeId}`);

    // USYC maintains 1:1 peg with USDC initially, but grows with yield
    const estimatedUSYC = usdcAmount;

    return {
      success: true,
      challengeId: subscribeResult.challengeId,
      transactionId: subscribeResult.transactionId,
      transactionHash: subscribeResult.transactionHash,
      usdcAmount,
      estimatedUSYC,
    };
  } catch (error: any) {
    console.error(`[USYC User] Subscription error:`, error);
    return {
      success: false,
      error: error.message || "Failed to subscribe to USYC",
      usdcAmount,
      estimatedUSYC: "0",
    };
  }
}

/**
 * Redeem USYC (withdraw USDC plus earned yield)
 * User-Controlled version - creates challenges that user must complete
 */
export async function redeemUSYC(
  userId: string,
  userToken: string,
  walletId: string,
  usycAmount: string,
  blockchain: string = "ETH"
): Promise<RedeemResult> {
  try {
    if (!USYC_ADDRESSES[blockchain]) {
      return {
        success: false,
        error: `USYC not available on ${blockchain}`,
        usycAmount,
        estimatedUSDC: "0",
      };
    }

    const { usyc, teller } = USYC_ADDRESSES[blockchain];
    const amountInSmallestUnit = Math.floor(parseFloat(usycAmount) * 1_000_000).toString();

    console.log(`[USYC User] Redeeming ${usycAmount} USYC on ${blockchain}`);

    // Step 1: Approve Teller to spend USYC
    console.log(`[USYC User] Step 1: Creating USYC approval challenge...`);
    
    const approveResult = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: usyc,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [teller, amountInSmallestUnit],
      feeLevel: "MEDIUM",
      refId: `usyc-redeem-approve-${Date.now()}`,
    });

    if (!approveResult.success) {
      throw new Error(`Failed to approve USYC: ${approveResult.error}`);
    }

    console.log(`[USYC User] ✅ Approval challenge created: ${approveResult.challengeId}`);

    // Wait for approval
    console.log(`[USYC User] Waiting for user to complete approval...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Redeem USYC by calling sell() on Teller
    console.log(`[USYC User] Step 2: Creating redemption challenge...`);
    
    const redeemResult = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: teller,
      abiFunctionSignature: "sell(uint256)",
      abiParameters: [amountInSmallestUnit],
      feeLevel: "MEDIUM",
      refId: `usyc-redeem-${Date.now()}`,
    });

    if (!redeemResult.success) {
      throw new Error(`Failed to redeem USYC: ${redeemResult.error}`);
    }

    console.log(`[USYC User] ✅ Redemption challenge created: ${redeemResult.challengeId}`);

    // USYC value grows with yield, so you get back more USDC than you put in
    const estimatedUSDC = usycAmount;

    return {
      success: true,
      challengeId: redeemResult.challengeId,
      transactionId: redeemResult.transactionId,
      transactionHash: redeemResult.transactionHash,
      usycAmount,
      estimatedUSDC,
    };
  } catch (error: any) {
    console.error(`[USYC User] Redemption error:`, error);
    return {
      success: false,
      error: error.message || "Failed to redeem USYC",
      usycAmount,
      estimatedUSDC: "0",
    };
  }
}

/**
 * Get current USYC position and yield information
 * This would need to query on-chain data
 */
export async function getUSYCPosition(
  walletAddress: string,
  initialInvestment: string,
  blockchain: string = "ETH"
): Promise<YieldPosition | null> {
  try {
    if (!USYC_ADDRESSES[blockchain]) {
      return null;
    }

    // In a real implementation, we would:
    // 1. Query USYC balance from the token contract
    // 2. Query current USYC price from the Oracle
    // 3. Calculate yield based on time held and current value

    const currentAPY = "5.25"; // Overnight federal funds rate (example)

    return {
      usycBalance: "0", // Would query from contract
      usdcValue: "0", // Would calculate from oracle price
      initialInvestment,
      currentYield: "0",
      yieldPercentage: "0",
      apy: currentAPY,
      blockchain,
    };
  } catch (error: any) {
    console.error(`[USYC User] Error fetching position:`, error);
    return null;
  }
}

/**
 * Check if USYC is available on a blockchain
 */
export function isUSYCAvailable(blockchain: string): boolean {
  return !!USYC_ADDRESSES[blockchain];
}

/**
 * Get list of blockchains where USYC is available
 */
export function getAvailableBlockchains(): string[] {
  return Object.keys(USYC_ADDRESSES);
}

/**
 * Format USYC position for display
 */
export function formatUSYCPosition(position: YieldPosition): string {
  return `💰 USYC Yield Position\n\n` +
         `Balance: ${position.usycBalance} USYC\n` +
         `Value: ${position.usdcValue} USDC\n` +
         `Initial Investment: ${position.initialInvestment} USDC\n` +
         `Current Yield: ${position.currentYield} USDC (+${position.yieldPercentage}%)\n` +
         `APY: ${position.apy}%\n` +
         `Blockchain: ${position.blockchain}`;
}












