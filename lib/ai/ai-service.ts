/**
 * AI Service for Natural Language Processing
 * 
 * Handles AI responses and command processing
 * Currently uses simple rule-based responses
 * TODO: Integrate with OpenAI API or local model (Ollama)
 */

import { IntentClassifier, ParsedIntent } from "./intent-classifier";
import { validateAddress } from "@/lib/security/address-validation";
import { calculateRiskScore } from "@/lib/security/risk-scoring";
import { addSubscription, scheduleNext, listSubscriptions, updateSubscription, Subscription } from "@/lib/subscriptions";

export interface AIResponse {
  message: string;
  intent: ParsedIntent;
  requiresConfirmation?: boolean;
  transactionPreview?: {
    amount: string;
    to: string;
    fee?: string;
    riskScore?: number;
    riskReasons?: string[];
    blocked?: boolean;
  };
}

export class AIService {
  /**
   * Process user message and generate AI response
   */
  static async processMessage(message: string, context?: {
    hasWallet?: boolean;
    balance?: string;
    walletAddress?: string;
  }): Promise<AIResponse> {
    const intent = IntentClassifier.classify(message);
    
    switch (intent.intent) {
      case "greeting":
        return this.handleGreetingIntent(intent, context);
      
      case "send":
        return await this.handleSendIntent(intent, context);
      
      case "receive":
        return this.handleReceiveIntent(intent, context);
      
      case "balance":
        return this.handleBalanceIntent(intent, context);
      
      case "address":
        return this.handleAddressIntent(intent, context);
      
      case "transaction_history":
        return this.handleHistoryIntent(intent, context);
      
      case "bridge":
        return await this.handleBridgeIntent(intent, context);
      
      case "pay":
        return await this.handlePayIntent(intent, context);
      
      case "yield":
        return await this.handleYieldIntent(intent, context);
      
      case "withdraw":
        return await this.handleWithdrawIntent(intent, context);

      case "scan":
        return await this.handleScanIntent(intent, context);

      case "schedule":
        return this.handleScheduleIntent(intent, context);

      case "subscription":
        return this.handleSubscriptionIntent(intent, context);

      case "renew":
        return this.handleRenewIntent(intent, context);
      
      case "help":
        return this.handleHelpIntent(intent, context);
      
      default:
        return this.handleUnknownIntent(intent, context);
    }
  }
  
  private static handleGreetingIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    const lowerMessage = intent.rawCommand.toLowerCase().trim();
    
    // Detect time-based greetings
    let timeGreeting = "";
    if (lowerMessage.includes("good morning") || lowerMessage.includes("morning")) {
      timeGreeting = "Good morning!";
    } else if (lowerMessage.includes("good afternoon") || lowerMessage.includes("afternoon")) {
      timeGreeting = "Good afternoon!";
    } else if (lowerMessage.includes("good evening") || lowerMessage.includes("evening")) {
      timeGreeting = "Good evening!";
    } else if (lowerMessage.includes("good night") || lowerMessage.includes("night")) {
      timeGreeting = "Good night!";
    }
    
    // Handle "how are you" variations
    if (lowerMessage.includes("how are you") || 
        lowerMessage.includes("how's it going") || 
        lowerMessage.includes("how you doing")) {
      return {
        message: "I'm doing great, thank you! 😊 I'm here and ready to help you with your wallet. What would you like to do?",
        intent,
      };
    }
    
    // Generate varied, friendly greeting responses
    const greetings = timeGreeting 
      ? [`${timeGreeting} 👋 I'm your AI wallet assistant on ARCLE. How can I help you today?`]
      : [
          "Hello! 👋 I'm your AI wallet assistant on ARCLE. How can I help you today?",
          "Hi there! I'm here to help you manage your wallet on Arc network. What would you like to do?",
          "Hey! Welcome to ARCLE. I can help you with your wallet operations. What can I do for you?",
          "Greetings! I'm your AI assistant. I can help you send, receive, check balances, and more. What would you like to do?",
          "Hi! 👋 Nice to meet you! I'm your wallet assistant. How can I help you today?",
        ];
    
    // Select a random greeting for variety
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    // Add helpful suggestions if wallet exists
    if (context?.hasWallet) {
      return {
        message: `${randomGreeting}\n\nTry asking me:\n• "What's my balance?"\n• "Show my address"\n• "Send $50 to 0x..."\n• "Transaction history"`,
        intent,
      };
    } else {
      return {
        message: `${randomGreeting}\n\nTo get started, you'll need to create a wallet first. Would you like to create one?`,
        intent,
      };
    }
  }
  
  private static async handleSendIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to send transactions.",
        intent,
      };
    }
    
    const { amount, address, recipient } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you send USDC! Please tell me:\n• How much to send\n• The recipient address\n\nExample: \"Send $50 to 0x1234...\"",
        intent,
      };
    }
    
    if (!address) {
      return {
        message: `I'll send $${amount} USDC. Please provide the recipient address:\n\nExample: "Send $${amount} to 0x..."`,
        intent,
      };
    }
    
    // Validate address format and checksum
    const addressValidation = validateAddress(address);
    if (!addressValidation.isValid) {
      return {
        message: `Invalid address format: ${addressValidation.error}. Please provide a valid Ethereum address.`,
        intent,
      };
    }
    
    // Use normalized checksummed address
    const normalizedAddress = addressValidation.normalizedAddress || address;
    
    // Calculate estimated fee (simplified)
    const estimatedFee = "0.01";
    
    // Calculate real risk score
    const riskResult = await calculateRiskScore(normalizedAddress, amount);
    
    // If high risk, block the transaction
    if (riskResult.blocked) {
      return {
        message: `⚠️ **HIGH RISK TRANSACTION BLOCKED**\n\nRisk Score: ${riskResult.score}/100\n\n**Reasons:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis transaction has been blocked for your safety. Please verify the recipient address and try again.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    // Build risk message
    let riskMessage = "";
    if (riskResult.level === "high") {
      riskMessage = `⚠️ **HIGH RISK** (${riskResult.score}/100)`;
    } else if (riskResult.level === "medium") {
      riskMessage = `⚠️ **MEDIUM RISK** (${riskResult.score}/100)`;
    } else {
      riskMessage = `✅ **LOW RISK** (${riskResult.score}/100)`;
    }
    
    return {
      message: `I'll send $${amount} USDC on **Arc network** to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n${riskMessage}\n\n**Risk Factors:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\n**Arc Benefits:**\n• Gas paid in USDC (no ETH needed)\n• Sub-second transaction finality\n• Native USDC support\n\nPlease review and confirm:`,
      intent,
      requiresConfirmation: true,
      transactionPreview: {
        amount,
        to: normalizedAddress,
        fee: estimatedFee,
        riskScore: riskResult.score,
        riskReasons: riskResult.reasons,
        blocked: false,
      },
    };
  }
  
  private static handleReceiveIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    if (!context?.hasWallet || !context?.walletAddress) {
      return {
        message: "Please create a wallet first to get your address.",
        intent,
      };
    }
    
    // Use explicit message that triggers QR code display
    return {
      message: "Here's your wallet address:",
      intent,
    };
  }
  
  private static handleBalanceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to check your balance.",
        intent,
      };
    }
    
    const balance = context.balance || "0.00";
    
    return {
      message: `Your balance is **$${balance} USDC** on Arc network.`,
      intent,
    };
  }
  
  private static handleAddressIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    // Use explicit message that triggers QR code display
    if (!context?.hasWallet || !context?.walletAddress) {
      return {
        message: "Please create a wallet first to get your address.",
        intent,
      };
    }
    
    return {
      message: "Here's your wallet address:",
      intent,
    };
  }
  
  private static handleHistoryIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to view transaction history.",
        intent,
      };
    }
    
    return {
      message: "Fetching your transaction history...",
      intent,
    };
  }
  
  private static async handleBridgeIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to bridge assets.",
        intent,
      };
    }
    
    const { amount, recipient: destinationChain, currency } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you bridge USDC across chains! Please tell me:\n• How much to bridge\n• The destination chain\n\nExample: \"Bridge $50 to Ethereum\" or \"Bridge 100 USDC to Base\"",
        intent,
      };
    }
    
    if (!destinationChain) {
      return {
        message: `I'll bridge $${amount} USDC. Please specify the destination chain:\n\nExample: "Bridge $${amount} to Ethereum" or "Bridge $${amount} to Base"\n\nSupported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, Avalanche`,
        intent,
      };
    }
    
    return {
      message: `🌉 **Cross-Chain Bridge**\n\nI'll bridge **$${amount} ${currency || "USDC"}** from Arc to **${destinationChain}**.\n\n⚠️ **Note**: Cross-chain bridge functionality is coming soon! This will allow you to transfer USDC securely across different blockchains.\n\nFor now, you can use the send functionality to transfer USDC on Arc network.`,
      intent,
      requiresConfirmation: false,
    };
  }
  
  private static async handlePayIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    // Pay is similar to send but with different messaging
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to make payments.",
        intent,
      };
    }
    
    const { amount, address, recipient } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you make a payment! Please tell me:\n• How much to pay\n• The recipient address\n\nExample: \"Pay $50 to 0x1234...\"",
        intent,
      };
    }
    
    if (!address) {
      return {
        message: `I'll pay $${amount} USDC. Please provide the recipient address:\n\nExample: "Pay $${amount} to 0x..."`,
        intent,
      };
    }
    
    // Validate address format and checksum
    const addressValidation = validateAddress(address);
    if (!addressValidation.isValid) {
      return {
        message: `Invalid address format: ${addressValidation.error}. Please provide a valid Ethereum address.`,
        intent,
      };
    }
    
    // Use normalized checksummed address
    const normalizedAddress = addressValidation.normalizedAddress || address;
    
    // Calculate estimated fee
    const estimatedFee = "0.01";
    
    // Calculate real risk score
    const riskResult = await calculateRiskScore(normalizedAddress, amount);
    
    // If high risk, block the transaction
    if (riskResult.blocked) {
      return {
        message: `⚠️ **HIGH RISK PAYMENT BLOCKED**\n\nRisk Score: ${riskResult.score}/100\n\n**Reasons:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis payment has been blocked for your safety. Please verify the recipient address and try again.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    // Build risk message
    let riskMessage = "";
    if (riskResult.level === "high") {
      riskMessage = `⚠️ **HIGH RISK** (${riskResult.score}/100)`;
    } else if (riskResult.level === "medium") {
      riskMessage = `⚠️ **MEDIUM RISK** (${riskResult.score}/100)`;
    } else {
      riskMessage = `✅ **LOW RISK** (${riskResult.score}/100)`;
    }
    
    return {
      message: `💳 I'll pay $${amount} USDC to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n${riskMessage}\n\n**Risk Factors:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nPlease review and confirm:`,
      intent,
      requiresConfirmation: true,
      transactionPreview: {
        amount,
        to: normalizedAddress,
        fee: estimatedFee,
        riskScore: riskResult.score,
        riskReasons: riskResult.reasons,
        blocked: false,
      },
    };
  }
  
  private static async handleYieldIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to earn yield.",
        intent,
      };
    }
    
    const { amount, currency } = intent.entities;
    
    return {
      message: `💰 **Yield Farming**\n\n${amount ? `I can help you stake **$${amount} ${currency || "USDC"}** to earn yield.` : "I can help you earn yield on your USDC!"}\n\n⚠️ **Note**: Yield farming functionality is coming soon! This will allow you to:\n• Stake USDC to earn APY\n• View your staking positions\n• Unstake and withdraw rewards\n\nFor now, you can hold USDC in your wallet.`,
      intent,
      requiresConfirmation: false,
    };
  }
  
  private static async handleWithdrawIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to withdraw funds.",
        intent,
      };
    }
    
    const { amount, recipient: destination, currency } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you withdraw USDC to fiat! Please tell me:\n• How much to withdraw\n• Destination (bank account, card, etc.)\n\nExample: \"Withdraw $50 to bank account\" or \"Cash out $100 USDC\"",
        intent,
      };
    }
    
    const destinationType = destination || "bank account";
    
    return {
      message: `💸 **Withdraw to Fiat**\n\nI'll withdraw **$${amount} ${currency || "USDC"}** to your **${destinationType}**.\n\n⚠️ **Note**: Withdraw functionality is coming soon! This will allow you to:\n• Convert USDC to fiat (USD, EUR, etc.)\n• Withdraw to bank accounts\n• Withdraw to cards\n• Fast, secure transfers\n\nFor now, you can send USDC to other addresses on Arc network.`,
      intent,
      requiresConfirmation: false,
    };
  }

  private static async handleScanIntent(
    intent: ParsedIntent,
    context?: { walletAddress?: string }
  ): Promise<AIResponse> {
    const address = intent.entities.address;
    if (!address) {
      return {
        message: "Paste an address to scan, e.g. 'Scan 0xabc...'.",
        intent,
      };
    }
    if (!validateAddress(address)) {
      return {
        message: `That doesn't look like a valid address: ${address}`,
        intent,
      };
    }
    const { score, reasons, blocked } = await calculateRiskScore(address, "0.00");
    if (blocked) {
      return {
        message: `High risk address detected (risk ${score}). Action blocked.\nReasons: ${reasons.join(", ")}`,
        intent,
      };
    }
    const riskLabel = score >= 80 ? "High" : score >= 40 ? "Medium" : "Low";
    return {
      message: `Scan complete. Risk: ${riskLabel} (${score}).${reasons.length ? "\nReasons: " + reasons.join(", ") : ""}`,
      intent,
    };
  }

  private static handleScheduleIntent(
    intent: ParsedIntent,
    context?: { walletAddress?: string }
  ): AIResponse {
    const amount = intent.entities.amount || "amount";
    const date = intent.entities.date || "a date";
    const time = intent.entities.time || "a time";
    return {
      message: `Got it. I'll schedule a payment of ${amount} at ${time} on ${date}. (Scheduling engine coming soon)`,
      intent,
    };
  }

  private static handleSubscriptionIntent(
    intent: ParsedIntent,
    context?: { walletAddress?: string }
  ): AIResponse {
    const amount = intent.entities.amount || "";
    const merchant = (intent.entities as any).merchant || "subscription";
    const frequency = (intent.entities as any).frequency || "monthly";
    const time = intent.entities.time || "8:00 am";

    // Construct nextChargeAt as 24h from now for MVP
    const now = Date.now();
    const nextChargeAt = now + 24 * 60 * 60 * 1000;

    if (typeof window !== 'undefined') {
      addSubscription({
        merchant,
        amount: amount || "0",
        currency: "USDC",
        frequency,
        nextChargeAt,
        autoRenew: true,
        remindBeforeMs: 2 * 24 * 60 * 60 * 1000, // 2 days (48 hours)
        paused: false,
      });
    }

    return {
      message: `Subscription created for ${merchant}: ${amount || "0"} USDC, ${frequency}, next charge scheduled. You'll be reminded 2 days before renewal.`,
      intent,
    };
  }

  private static handleRenewIntent(
    intent: ParsedIntent,
    context?: { walletAddress?: string }
  ): AIResponse {
    // MVP: acknowledge and let UI handle sending when due
    return {
      message: `Okay, I will renew your subscription when it's due. (Auto-renew is enabled)`,
      intent,
    };
  }
  
  private static handleHelpIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    return {
      message: "I'm your AI wallet assistant on ARCLE! I can help you:\n\n• Check your balance\n• Send and receive USDC\n• Make payments\n• Bridge assets across chains (coming soon)\n• Withdraw to fiat (coming soon)\n• Earn yield (coming soon)\n• View your wallet address\n• View transaction history\n• And much more!\n\nJust ask me what you'd like to do!",
      intent,
    };
  }
  
  private static handleUnknownIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): AIResponse {
    // Check if user is asking for testnet tokens
    const lowerMessage = intent.rawCommand.toLowerCase();
    if (lowerMessage.includes("faucet") || 
        lowerMessage.includes("testnet token") || 
        lowerMessage.includes("request token") ||
        lowerMessage.includes("get token") ||
        (lowerMessage.includes("token") && lowerMessage.includes("test"))) {
      return {
        message: "I can help you request testnet tokens! Just say \"Request testnet tokens\" or \"Get testnet USDC\" and I'll request tokens for your wallet.\n\nNote: Testnet tokens are for testing only and have no real value.",
        intent: { ...intent, intent: "faucet" },
      };
    }
    
    return {
      message: "I'm not sure I understand. Try asking me to:\n• Check your balance\n• Send USDC\n• Pay someone\n• Bridge assets\n• Withdraw to fiat\n• Earn yield\n• Show your address\n• View transaction history\n• Request testnet tokens\n\nOr type 'help' for more commands!",
      intent,
    };
  }
  
}

