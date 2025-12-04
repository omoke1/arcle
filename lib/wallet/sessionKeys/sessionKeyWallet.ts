/**
 * Session Key Wallet Management
 * 
 * Manages session key private keys and signing
 * In production, these would be stored securely (HSM, encrypted storage, etc.)
 */

import { ethers } from 'ethers';
import type { CircleSessionKey } from './sessionPermissions';

/**
 * Generate a new session key wallet
 * 
 * In production, this would:
 * 1. Generate a secure random private key
 * 2. Store it encrypted in secure storage
 * 3. Return the address for on-chain registration
 */
export function generateSessionKeyWallet(): {
  address: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

/**
 * Get session key wallet from stored private key
 * 
 * Retrieves the private key from secure storage and returns a wallet instance
 */
export async function getSessionKeyWallet(
  sessionKey: CircleSessionKey
): Promise<ethers.Wallet | null> {
  const { getSessionKeyPrivateKey } = await import('./sessionKeyStorage');
  const privateKey = await getSessionKeyPrivateKey(sessionKey.sessionKeyId);
  
  if (!privateKey) {
    return null;
  }

  try {
    return new ethers.Wallet(privateKey);
  } catch (error) {
    console.error('[Session Key Wallet] Failed to create wallet from private key:', error);
    return null;
  }
}

/**
 * Sign a message with session key
 */
export async function signWithSessionKey(
  message: string | Uint8Array,
  sessionKey: CircleSessionKey
): Promise<string> {
  const wallet = await getSessionKeyWallet(sessionKey);
  
  if (!wallet) {
    throw new Error('Session key wallet not found. Private key must be stored securely.');
  }

  return await wallet.signMessage(message);
}

/**
 * Sign a transaction hash with session key
 */
export async function signHashWithSessionKey(
  hash: string,
  sessionKey: CircleSessionKey
): Promise<string> {
  const wallet = await getSessionKeyWallet(sessionKey);
  
  if (!wallet) {
    throw new Error('Session key wallet not found. Private key must be stored securely.');
  }

  // Convert hash string to bytes
  const hashBytes = ethers.getBytes(hash);
  
  // Sign the hash (for UserOp signing)
  const signature = wallet.signingKey.sign(hashBytes);
  return signature.serialized;
}

/**
 * Sign EIP-712 typed data with session key
 * 
 * This enables Gateway transfers without PIN approval
 */
export async function signTypedDataWithSessionKey(
  domain: any,
  types: any,
  value: any,
  sessionKey: CircleSessionKey
): Promise<string> {
  const wallet = await getSessionKeyWallet(sessionKey);
  
  if (!wallet) {
    throw new Error('Session key wallet not found. Private key must be stored securely.');
  }

  // Use ethers.js signTypedData for EIP-712 signing
  const signature = await wallet.signTypedData(domain, types, value);
  return signature;
}

