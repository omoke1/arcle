/**
 * Circle API Type Definitions
 * 
 * Aligned with Circle Developer Services API documentation
 */

export interface CircleWallet {
  walletId: string;
  entityId: string;
  type: "EndUserWallet" | "DeveloperWallet";
  state: "LIVE" | "ARCHIVED";
  custodialWalletSetId?: string;
  userId?: string; // For user-controlled wallets
  createdAt: string;
}

export interface CircleWalletAddress {
  walletId: string;
  address: string;
  chain: string; // "ARC" for Arc network
}

export interface CircleBalance {
  tokenId: string;
  amount: string; // Amount in smallest unit (6 decimals for USDC)
  updateDate: string;
}

export interface CircleTransaction {
  id: string;
  walletId: string;
  idempotencyKey: string;
  destination: {
    type: string;
    address: string;
  };
  amount: {
    amount: string; // In smallest unit
    currency: string; // "USDC"
  };
  fee: {
    amount: string;
    currency: string;
  };
  status: "pending" | "confirmed" | "failed";
  createDate: string;
  updateDate: string;
}

export interface CircleApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    errors?: Array<{ message: string }>;
  };
}

/**
 * User-Controlled Wallet Types (ERC-4337)
 */
export interface UserWalletConfig {
  appId: string;
  userToken: string;
  encryptionKey: string;
}

/**
 * Developer-Controlled Wallet Types
 */
export interface DeveloperWalletConfig {
  appId: string;
  entitySecret: string;
}
