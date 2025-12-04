/**
 * Mock utilities for Session Keys testing
 */

import type { CircleSessionKey } from '@/lib/wallet/sessionKeys/sessionPermissions';

export const mockSessionKey: CircleSessionKey = {
  sessionKeyId: '0x1234567890123456789012345678901234567890',
  walletId: 'test-wallet-id',
  userId: 'test-user-id',
  permissions: {
    allowedActions: ['transfer', 'approve'],
    spendingLimit: '1000000000', // $1000 USDC
    spendingUsed: '0',
    expiryTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    autoRenew: true,
    maxRenewals: 10,
    renewalsUsed: 0,
  },
  createdAt: Math.floor(Date.now() / 1000),
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  status: 'active',
  mscaAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  sessionKeyAddress: '0x1234567890123456789012345678901234567890',
};

export const mockExpiredSessionKey: CircleSessionKey = {
  ...mockSessionKey,
  expiresAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  status: 'expired',
};

export const mockRevokedSessionKey: CircleSessionKey = {
  ...mockSessionKey,
  status: 'revoked',
};

export function createMockSessionKey(overrides?: Partial<CircleSessionKey>): CircleSessionKey {
  return {
    ...mockSessionKey,
    ...overrides,
  };
}

export function mockUserOperation() {
  return {
    sender: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    nonce: 0n,
    initCode: '0x',
    callData: '0x',
    callGasLimit: 100000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 21000n,
    maxFeePerGas: 20000000000n,
    maxPriorityFeePerGas: 2000000000n,
    paymasterAndData: '0x',
    signature: '0x' + '0'.repeat(130),
  };
}

