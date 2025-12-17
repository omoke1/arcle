/**
 * Escrow Service
 * 
 * Handles interactions with the PaymentEscrow smart contract
 * for claimable phone/email payments
 */

import { ethers } from 'ethers';
import crypto from 'crypto';
import { getEscrowConfig, type EscrowConfig } from './escrowConfig';

// Escrow contract ABI (simplified - full ABI would be generated from contract)
const ESCROW_ABI = [
  'function depositPayment(bytes32 paymentId, address sender, uint256 amount, bytes32 claimCodeHash, uint256 expiresAt)',
  'function claimPayment(bytes32 paymentId, string calldata claimCode, address recipient)',
  'function refundExpiredPayment(bytes32 paymentId)',
  'function getPayment(bytes32 paymentId) view returns (tuple(address sender, address recipient, uint256 amount, bytes32 claimCodeHash, uint256 expiresAt, bool claimed, bool refunded))',
  'function canClaim(bytes32 paymentId) view returns (bool)',
];

/**
 * Get escrow contract instance
 */
function getEscrowContract(config: EscrowConfig): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = config.privateKey
    ? new ethers.Wallet(config.privateKey, provider)
    : provider;
  
  return new ethers.Contract(config.contractAddress, ESCROW_ABI, signer);
}

/**
 * Generate payment ID from pending payment ID (bytes32)
 */
export function generatePaymentId(pendingPaymentId: string): string {
  // Convert UUID to bytes32 by hashing it
  const hash = crypto.createHash('sha256').update(pendingPaymentId).digest('hex');
  // bytes32 is 32 bytes = 64 hex characters
  return '0x' + hash.slice(0, 64);
}

/**
 * Hash claim code for escrow
 */
export function hashClaimCode(claimCode: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(claimCode));
}

/**
 * Deposit payment to escrow
 * 
 * @param paymentId Payment identifier (bytes32)
 * @param senderAddress Sender's wallet address
 * @param amount Amount in smallest unit
 * @param claimCode Claim code (will be hashed)
 * @param expiresAt Expiration timestamp (Unix)
 * @returns Transaction hash
 */
export async function depositToEscrow(
  paymentId: string,
  senderAddress: string,
  amount: string,
  claimCode: string,
  expiresAt: number
): Promise<string> {
  const config = getEscrowConfig();
  
  if (!config.privateKey) {
    throw new Error('ESCROW_PRIVATE_KEY not set. Required for escrow deposits.');
  }

  const contract = getEscrowContract(config);
  const claimCodeHash = hashClaimCode(claimCode);

  // Approve USDC transfer first
  const usdcContract = new ethers.Contract(
    config.usdcTokenAddress,
    ['function approve(address spender, uint256 amount)'],
    contract.runner as any
  );

  const approveTx = await usdcContract.approve(config.contractAddress, amount);
  await approveTx.wait();

  // Deposit to escrow
  const tx = await contract.depositPayment(
    paymentId,
    senderAddress,
    amount,
    claimCodeHash,
    expiresAt
  );

  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Claim payment from escrow
 * 
 * @param paymentId Payment identifier
 * @param claimCode Claim code
 * @param recipientAddress Recipient's wallet address
 * @returns Transaction hash
 */
export async function claimFromEscrow(
  paymentId: string,
  claimCode: string,
  recipientAddress: string
): Promise<string> {
  const config = getEscrowConfig();
  const contract = getEscrowContract(config);

  const tx = await contract.claimPayment(paymentId, claimCode, recipientAddress);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Check if payment can be claimed
 */
export async function canClaimPayment(paymentId: string): Promise<boolean> {
  const config = getEscrowConfig();
  const contract = getEscrowContract(config);
  return await contract.canClaim(paymentId);
}

/**
 * Get payment details from escrow
 */
export async function getEscrowPayment(paymentId: string): Promise<{
  sender: string;
  recipient: string;
  amount: bigint;
  expiresAt: bigint;
  claimed: boolean;
  refunded: boolean;
}> {
  const config = getEscrowConfig();
  const contract = getEscrowContract(config);
  const payment = await contract.getPayment(paymentId);
  
  return {
    sender: payment.sender,
    recipient: payment.recipient,
    amount: payment.amount,
    expiresAt: payment.expiresAt,
    claimed: payment.claimed,
    refunded: payment.refunded,
  };
}

/**
 * Refund expired payment
 */
export async function refundExpiredPayment(paymentId: string): Promise<string> {
  const config = getEscrowConfig();
  
  if (!config.privateKey) {
    throw new Error('ESCROW_PRIVATE_KEY not set. Required for refunds.');
  }

  const contract = getEscrowContract(config);
  const tx = await contract.refundExpiredPayment(paymentId);
  const receipt = await tx.wait();
  return receipt.hash;
}

