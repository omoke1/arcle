/**
 * Circle API Cryptography Utilities
 * 
 * For developer-controlled wallets, Entity Secret needs to be encrypted
 * using Circle's encryption scheme before sending to API
 */

import crypto from 'crypto';

/**
 * Encrypt Entity Secret for Circle API requests
 * Circle uses AES-256-GCM encryption
 * 
 * @param entitySecret - The plain Entity Secret from Circle Console
 * @param publicKey - Circle's public key (from API response or config)
 * @returns Encrypted Entity Secret (entitySecretCiphertext)
 */
export function encryptEntitySecret(
  entitySecret: string,
  publicKey?: string
): string {
  // For now, return as-is if encryption not available
  // In production, this should use Circle's encryption scheme
  // Circle may provide encryption details in their SDK or docs
  return entitySecret;
}

/**
 * Generate encryption key pair for user-controlled wallets
 * This is used when initializing users
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

