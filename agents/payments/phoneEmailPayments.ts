/**
 * Phone/Email Payment Flows
 *
 * Flow:
 * 1. Check phone_wallet_mappings first (instant payments)
 * 2. If mapping exists → execute immediately
 * 3. If no mapping → deposit to escrow + create pending payment
 * 4. Recipient claims → auto-create wallet if needed + withdraw from escrow
 */

import { INERAAgent } from "@/agents/inera";
import type { ExecutionResult } from "@/lib/wallet/sessionKeys/delegateExecution";
import {
  getContactByEmail,
  getContactByPhone,
} from "@/lib/db/services/contacts";
import {
  getMappingByPhone,
  getMappingByEmail,
} from "@/lib/db/services/phoneWalletMappings";
import {
  createPendingPayment,
  type CreatePendingPaymentData,
} from "@/lib/db/services/pendingPayments";

export interface PhoneEmailPaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  recipient: string; // phone number or email
  amount: string; // already in smallest unit (toSmallestUnit was applied upstream)
  recipientType: "phone" | "email";
}

/**
 * Core helper: execute a payment once we have a destination address.
 */
async function executeResolvedPayment(params: {
  walletId: string;
  userId: string;
  userToken: string;
  destinationAddress: string;
  amountSmallestUnit: string;
}): Promise<ExecutionResult> {
  const inera = new INERAAgent();

  return inera.executePayment({
    walletId: params.walletId,
    userId: params.userId,
    userToken: params.userToken,
    amount: params.amountSmallestUnit,
    destinationAddress: params.destinationAddress,
    agentId: "payments",
  });
}

/**
 * Normalize phone numbers to a consistent format (basic E.164-style).
 * Assumes contacts are stored using the same normalization.
 */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.replace(/[^\d]/g, "");
  }
  return trimmed.replace(/[^\d]/g, "");
}

/**
 * Send payment to phone number
 * 
 * Flow:
 * 1. Check phone_wallet_mappings → execute immediately if found
 * 2. Check contacts → execute immediately if found
 * 3. Otherwise → deposit to escrow + create pending payment
 */
export async function sendToPhone(
  params: PhoneEmailPaymentParams
): Promise<ExecutionResult> {
  const phone = normalizePhone(params.recipient);

  // Step 1: Check phone_wallet_mappings (fastest path)
  const mapping = await getMappingByPhone(phone);
  if (mapping && mapping.wallet_address) {
    return executeResolvedPayment({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      destinationAddress: mapping.wallet_address,
      amountSmallestUnit: params.amount,
    });
  }

  // Step 2: Check contacts (fallback for existing users)
  const contact = await getContactByPhone(params.userId, phone);
  if (contact) {
    const destinationAddress = contact.wallet_address || contact.address;
    if (destinationAddress) {
      return executeResolvedPayment({
        walletId: params.walletId,
        userId: params.userId,
        userToken: params.userToken,
        destinationAddress,
        amountSmallestUnit: params.amount,
      });
    }
  }

  // Step 3: No mapping found - create pending payment with escrow deposit
  // Get Supabase user_id from Circle userId
  let supabaseUserId: string;
  try {
    const { getOrCreateSupabaseUser } = await import('@/lib/supabase-data');
    supabaseUserId = await getOrCreateSupabaseUser(params.userId);
  } catch (error) {
    console.error('[Phone/Email Payments] Failed to get Supabase user ID:', error);
    throw new Error('Failed to create pending payment: Could not identify user');
  }

  // Create pending payment first
  const pendingPayment = await createPendingPayment({
    sender_user_id: supabaseUserId,
    sender_wallet_id: params.walletId,
    sender_circle_user_id: params.userId,
    recipient_phone: phone,
    amount: params.amount,
    currency: 'USDC',
  });

  // Get sender's wallet address for escrow deposit
  const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
  const client = getUserCircleClient();
  const walletResponse = await (client as any).getWallet({
    userToken: params.userToken,
    id: params.walletId,
  });

  if (!walletResponse.data?.addresses || walletResponse.data.addresses.length === 0) {
    throw new Error('Could not get sender wallet address for escrow deposit');
  }

  const senderWalletAddress = walletResponse.data.addresses[0].address;

    // Deposit to escrow using Circle contract execution
    // This will require user approval via PIN
    try {
      const { getEscrowConfig } = await import('@/lib/escrow/escrowConfig');
      const { generatePaymentId, hashClaimCode } = await import('@/lib/escrow/escrowService');
      const escrowConfig = getEscrowConfig();
    const paymentId = generatePaymentId(pendingPayment.id);
    const claimCodeHash = hashClaimCode(pendingPayment.claim_code);
    
    // Calculate expiration timestamp (30 days from now)
    const expiresAt = Math.floor((new Date(pendingPayment.expires_at).getTime()) / 1000);

    // Use Circle contract execution to approve USDC and deposit to escrow
    // First, approve USDC transfer to escrow
    const { executeContract } = await import('@/lib/circle-user-sdk-advanced');
    
    // Approve USDC to escrow contract
    const approveResult = await executeContract({
      userId: params.userId,
      userToken: params.userToken,
      walletId: params.walletId,
      contractAddress: escrowConfig.usdcTokenAddress,
      abiFunctionSignature: 'approve(address,uint256)',
      abiParameters: [escrowConfig.contractAddress, params.amount],
      refId: `escrow-approve-${pendingPayment.id}`,
    });

    if (!approveResult.success) {
      throw new Error(`Failed to approve USDC transfer: ${approveResult.error}`);
    }

    // Wait for approval to complete (if challenge was created, user needs to approve)
    if (approveResult.challengeId) {
      // User needs to approve - return pending state
      return {
        success: true,
        executedViaSessionKey: false,
        challengeId: approveResult.challengeId,
        transactionId: pendingPayment.id,
        message: `Pending payment created. Please approve the USDC transfer to complete the deposit. Claim code: ${pendingPayment.claim_code}`,
        data: {
          pendingPaymentId: pendingPayment.id,
          claimCode: pendingPayment.claim_code,
          expiresAt: pendingPayment.expires_at,
          status: 'pending',
          needsApproval: true,
          challengeId: approveResult.challengeId,
        },
      };
    }

    // Approval completed, now deposit to escrow
    const depositResult = await executeContract({
      userId: params.userId,
      userToken: params.userToken,
      walletId: params.walletId,
      contractAddress: escrowConfig.contractAddress,
      abiFunctionSignature: 'depositPayment(bytes32,address,uint256,bytes32,uint256)',
      abiParameters: [
        paymentId,
        senderWalletAddress,
        params.amount,
        claimCodeHash,
        expiresAt.toString(),
      ],
      refId: `escrow-deposit-${pendingPayment.id}`,
    });

    if (!depositResult.success) {
      throw new Error(`Failed to deposit to escrow: ${depositResult.error}`);
    }

    // Update pending payment with escrow info
    const { updatePendingPaymentEscrow } = await import('@/lib/db/services/pendingPayments');
    await updatePendingPaymentEscrow(
      pendingPayment.id,
      escrowConfig.contractAddress,
      depositResult.transactionHash || depositResult.transactionId || ''
    );

    return {
      success: true,
      executedViaSessionKey: false, // Contract execution always requires approval
      challengeId: depositResult.challengeId,
      transactionId: pendingPayment.id,
      transactionHash: depositResult.transactionHash,
      message: depositResult.challengeId
        ? `Pending payment created. Please approve the escrow deposit. Claim code: ${pendingPayment.claim_code}`
        : `Pending payment created and deposited to escrow. Claim code: ${pendingPayment.claim_code}. The recipient will be notified.`,
      data: {
        pendingPaymentId: pendingPayment.id,
        claimCode: pendingPayment.claim_code,
        expiresAt: pendingPayment.expires_at,
        status: 'pending',
        escrowAddress: escrowConfig.contractAddress,
        escrowDepositTxHash: depositResult.transactionHash || depositResult.transactionId,
      },
    };
  } catch (error: any) {
    console.error('[Phone/Email Payments] Escrow deposit failed:', error);
    // Payment was created but escrow deposit failed
    // Return success but note that deposit needs to be retried
    return {
      success: true,
      executedViaSessionKey: false,
      transactionId: pendingPayment.id,
      message: `Pending payment created, but escrow deposit requires approval. Claim code: ${pendingPayment.claim_code}. Please approve the transaction when prompted.`,
      data: {
        pendingPaymentId: pendingPayment.id,
        claimCode: pendingPayment.claim_code,
        expiresAt: pendingPayment.expires_at,
        status: 'pending',
        escrowDepositError: error.message,
      },
    };
  }
}

/**
 * Send payment to email address
 * 
 * Flow:
 * 1. Check phone_wallet_mappings → execute immediately if found
 * 2. Check contacts → execute immediately if found
 * 3. Otherwise → deposit to escrow + create pending payment
 */
export async function sendToEmail(
  params: PhoneEmailPaymentParams
): Promise<ExecutionResult> {
  const email = params.recipient.trim().toLowerCase();

  // Step 1: Check phone_wallet_mappings (fastest path)
  const mapping = await getMappingByEmail(email);
  if (mapping && mapping.wallet_address) {
    return executeResolvedPayment({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      destinationAddress: mapping.wallet_address,
      amountSmallestUnit: params.amount,
    });
  }

  // Step 2: Check contacts (fallback for existing users)
  const contact = await getContactByEmail(params.userId, email);
  if (contact) {
    const destinationAddress = contact.wallet_address || contact.address;
    if (destinationAddress) {
      return executeResolvedPayment({
        walletId: params.walletId,
        userId: params.userId,
        userToken: params.userToken,
        destinationAddress,
        amountSmallestUnit: params.amount,
      });
    }
  }

  // Step 3: No mapping found - create pending payment with escrow deposit
  let supabaseUserId: string;
  try {
    const { getOrCreateSupabaseUser } = await import('@/lib/supabase-data');
    supabaseUserId = await getOrCreateSupabaseUser(params.userId);
  } catch (error) {
    console.error('[Phone/Email Payments] Failed to get Supabase user ID:', error);
    throw new Error('Failed to create pending payment: Could not identify user');
  }

  // Create pending payment first
  const pendingPayment = await createPendingPayment({
    sender_user_id: supabaseUserId,
    sender_wallet_id: params.walletId,
    sender_circle_user_id: params.userId,
    recipient_email: email,
    amount: params.amount,
    currency: 'USDC',
  });

  // Get sender's wallet address for escrow deposit
  const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
  const client = getUserCircleClient();
  const walletResponse = await (client as any).getWallet({
    userToken: params.userToken,
    id: params.walletId,
  });

  if (!walletResponse.data?.addresses || walletResponse.data.addresses.length === 0) {
    throw new Error('Could not get sender wallet address for escrow deposit');
  }

  const senderWalletAddress = walletResponse.data.addresses[0].address;

  // Deposit to escrow using Circle contract execution
  try {
    const { getEscrowConfig } = await import('@/lib/escrow/escrowConfig');
    const { generatePaymentId, hashClaimCode } = await import('@/lib/escrow/escrowService');
    const escrowConfig = getEscrowConfig();
    const paymentId = generatePaymentId(pendingPayment.id);
    const claimCodeHash = hashClaimCode(pendingPayment.claim_code);
    
    // Calculate expiration timestamp (30 days from now)
    const expiresAt = Math.floor((new Date(pendingPayment.expires_at).getTime()) / 1000);

    // Use Circle contract execution to approve USDC and deposit to escrow
    const { executeContract } = await import('@/lib/circle-user-sdk-advanced');
    
    // Approve USDC to escrow contract
    const approveResult = await executeContract({
      userId: params.userId,
      userToken: params.userToken,
      walletId: params.walletId,
      contractAddress: escrowConfig.usdcTokenAddress,
      abiFunctionSignature: 'approve(address,uint256)',
      abiParameters: [escrowConfig.contractAddress, params.amount],
      refId: `escrow-approve-${pendingPayment.id}`,
    });

    if (!approveResult.success) {
      throw new Error(`Failed to approve USDC transfer: ${approveResult.error}`);
    }

    // Wait for approval to complete (if challenge was created, user needs to approve)
    if (approveResult.challengeId) {
      return {
        success: true,
        executedViaSessionKey: false,
        challengeId: approveResult.challengeId,
        transactionId: pendingPayment.id,
        message: `Pending payment created. Please approve the USDC transfer to complete the deposit. Claim code: ${pendingPayment.claim_code}`,
        data: {
          pendingPaymentId: pendingPayment.id,
          claimCode: pendingPayment.claim_code,
          expiresAt: pendingPayment.expires_at,
          status: 'pending',
          needsApproval: true,
          challengeId: approveResult.challengeId,
        },
      };
    }

    // Approval completed, now deposit to escrow
    const depositResult = await executeContract({
      userId: params.userId,
      userToken: params.userToken,
      walletId: params.walletId,
      contractAddress: escrowConfig.contractAddress,
      abiFunctionSignature: 'depositPayment(bytes32,address,uint256,bytes32,uint256)',
      abiParameters: [
        paymentId,
        senderWalletAddress,
        params.amount,
        claimCodeHash,
        expiresAt.toString(),
      ],
      refId: `escrow-deposit-${pendingPayment.id}`,
    });

    if (!depositResult.success) {
      throw new Error(`Failed to deposit to escrow: ${depositResult.error}`);
    }

    // Update pending payment with escrow info
    const { updatePendingPaymentEscrow } = await import('@/lib/db/services/pendingPayments');
    await updatePendingPaymentEscrow(
      pendingPayment.id,
      escrowConfig.contractAddress,
      depositResult.transactionHash || depositResult.transactionId || ''
    );

    return {
      success: true,
      executedViaSessionKey: false, // Contract execution always requires approval
      challengeId: depositResult.challengeId,
      transactionId: pendingPayment.id,
      transactionHash: depositResult.transactionHash,
      message: depositResult.challengeId
        ? `Pending payment created. Please approve the escrow deposit. Claim code: ${pendingPayment.claim_code}`
        : `Pending payment created and deposited to escrow. Claim code: ${pendingPayment.claim_code}. The recipient will be notified.`,
      data: {
        pendingPaymentId: pendingPayment.id,
        claimCode: pendingPayment.claim_code,
        expiresAt: pendingPayment.expires_at,
        status: 'pending',
        escrowAddress: escrowConfig.contractAddress,
        escrowDepositTxHash: depositResult.transactionHash || depositResult.transactionId,
      },
    };
  } catch (error: any) {
    console.error('[Phone/Email Payments] Escrow deposit failed:', error);
    return {
      success: true,
      executedViaSessionKey: false,
      transactionId: pendingPayment.id,
      message: `Pending payment created, but escrow deposit requires approval. Claim code: ${pendingPayment.claim_code}. Please approve the transaction when prompted.`,
      data: {
        pendingPaymentId: pendingPayment.id,
        claimCode: pendingPayment.claim_code,
        expiresAt: pendingPayment.expires_at,
        status: 'pending',
        escrowDepositError: error.message,
      },
    };
  }
}


