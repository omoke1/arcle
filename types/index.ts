// Wallet types
export interface Wallet {
  id: string;
  address: string;
  network: "arc" | "ethereum" | "base" | "polygon";
  createdAt: Date;
}

// Transaction types
export interface Transaction {
  id: string;
  hash: string;
  from: string;
  to: string;
  amount: string;
  token: "USDC" | "EURC";
  status: "pending" | "confirmed" | "failed";
  timestamp: Date;
}

// AI Chat types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  replyTo?: string; // ID of the message this is replying to
  image?: string; // Base64 image data URL
  transactionPreview?: {
    amount: string;
    to: string;
    fee?: string;
    riskScore?: number;
    riskReasons?: string[];
    blocked?: boolean;
    isNewWallet?: boolean;
  };
  agentData?: {
    agent: string;
    action?: string;
    data?: any;
  };
}

// Risk scoring
export interface RiskScore {
  score: number; // 0-100
  reasons: string[];
  blocked: boolean;
}

