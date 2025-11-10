/**
 * AI Service for Natural Language Processing
 * 
 * Handles AI responses and command processing with natural language generation
 * Uses Google Gemini for conversational responses with reasoning
 */

import { IntentClassifier, ParsedIntent } from "./intent-classifier";
import { validateAddress } from "@/lib/security/address-validation";
import { calculateRiskScore } from "@/lib/security/risk-scoring";
import { detectPhishingUrls } from "@/lib/security/phishing-detection";
import { addSubscription, scheduleNext, listSubscriptions, updateSubscription, Subscription } from "@/lib/subscriptions";
import { generateNaturalResponse, enhanceMessageWithReasoning } from "./natural-language-generator";
import { createScheduledPayment, listScheduledPayments, parseScheduleTime } from "@/lib/scheduled-payments";
import { 
  getConversationContext, 
  updateConversationContext, 
  addMessageToHistory, 
  setPendingAction, 
  clearPendingAction,
  getConversationSummary,
  type PendingAction 
} from "./conversation-context";

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
    isNewWallet?: boolean;
  };
}

export class AIService {
  /**
   * Process user message and generate AI response with natural language
   */
  static async processMessage(
    message: string, 
    context?: {
      hasWallet?: boolean;
      balance?: string;
      walletAddress?: string;
      walletId?: string;
    },
    sessionId?: string
  ): Promise<AIResponse> {
    // Get or create session ID
    const currentSessionId = sessionId || (typeof window !== "undefined" ? localStorage.getItem("arcle_session_id") || crypto.randomUUID() : crypto.randomUUID());
    if (typeof window !== "undefined" && !sessionId) {
      localStorage.setItem("arcle_session_id", currentSessionId);
    }
    
    // Get conversation context
    const conversationContext = getConversationContext(currentSessionId);
    
    // Add user message to history
    addMessageToHistory(currentSessionId, "user", message);
    
    // Check for confirm/cancel intents first - these need context
    const intent = IntentClassifier.classify(message);
    
    // Handle confirm intent - check if there's a pending action
    if (intent.intent === "confirm" && conversationContext.pendingAction) {
      return await this.handleConfirmIntent(intent, context, conversationContext.pendingAction, currentSessionId);
    }
    
    // Handle cancel intent
    if (intent.intent === "cancel" && conversationContext.pendingAction) {
      clearPendingAction(currentSessionId);
      addMessageToHistory(currentSessionId, "assistant", "Action canceled.");
      return {
        message: "Action canceled. No changes were made.",
        intent,
      };
    }
    
    switch (intent.intent) {
      case "greeting":
        return this.handleGreetingIntent(intent, context, currentSessionId);
      
      case "send":
        return await this.handleSendIntent(intent, context, currentSessionId);
      
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
        return await this.handlePayIntent(intent, context, currentSessionId);
      
      case "yield":
        return await this.handleYieldIntent(intent, context);
      
      case "arbitrage":
        return await this.handleArbitrageIntent(intent, context);
      
      case "rebalance":
        return await this.handleRebalanceIntent(intent, context);
      
      case "split_payment":
        return await this.handleSplitPaymentIntent(intent, context);
      
      case "batch":
        return await this.handleBatchIntent(intent, context);
      
      case "savings":
        return await this.handleSavingsIntent(intent, context);
      
      case "trade":
        return await this.handleTradeIntent(intent, context, currentSessionId);
      
      case "limit_order":
        return await this.handleLimitOrderIntent(intent, context);
      
      case "liquidity":
        return await this.handleLiquidityIntent(intent, context);
      
      case "compound":
        return await this.handleCompoundIntent(intent, context);
      
      case "convert":
        return await this.handleConvertIntent(intent, context, currentSessionId);
      
      case "fx_rate":
        return await this.handleFXRateIntent(intent, context);
      
      case "multi_currency":
        return await this.handleMultiCurrencyIntent(intent, context);
      
      case "invoice":
        return await this.handleInvoiceIntent(intent, context);
      
      case "payment_roll":
        return await this.handlePaymentRollIntent(intent, context);
      
      case "remittance":
        return await this.handleRemittanceIntent(intent, context);
      
      case "fx_alert":
        return await this.handleFXAlertIntent(intent, context);
      
      case "perpetual":
        return await this.handlePerpetualIntent(intent, context);
      
      case "options":
        return await this.handleOptionsIntent(intent, context);
      
      case "agent":
        return await this.handleAgentIntent(intent, context);
      
      case "withdraw":
        return await this.handleWithdrawIntent(intent, context);

      case "scan":
        return await this.handleScanIntent(intent, context);

      case "schedule":
        return this.handleScheduleIntent(intent, context, currentSessionId);

      case "subscription":
        return this.handleSubscriptionIntent(intent, context);

      case "renew":
        return this.handleRenewIntent(intent, context);
      
      case "confirm":
        // If no pending action, treat as unknown
        if (!conversationContext.pendingAction) {
          return this.handleUnknownIntent(intent, context);
        }
        return await this.handleConfirmIntent(intent, context, conversationContext.pendingAction, currentSessionId);
      
      case "cancel":
        // If no pending action, treat as unknown
        if (!conversationContext.pendingAction) {
          return this.handleUnknownIntent(intent, context);
        }
        clearPendingAction(currentSessionId);
        addMessageToHistory(currentSessionId, "assistant", "Action canceled.");
        return {
          message: "Action canceled. No changes were made.",
          intent,
        };
      
      case "help":
        return this.handleHelpIntent(intent, context);
      
      default:
        return this.handleUnknownIntent(intent, context);
    }
  }
  
  /**
   * Handle confirm intent - execute pending action
   */
  private static async handleConfirmIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    pendingAction?: PendingAction,
    sessionId?: string
  ): Promise<AIResponse> {
    if (!pendingAction) {
      return {
        message: "I'm not sure what you're confirming. Could you please clarify what you'd like to do?",
        intent,
      };
    }
    
    // Clear pending action
    if (sessionId) {
      clearPendingAction(sessionId);
    }
    
    // Execute the pending action based on type
    switch (pendingAction.type) {
      case "convert":
        // Re-execute convert with stored data
        return await this.handleConvertIntent(
          {
            ...intent,
            entities: pendingAction.data,
          },
          context
        );
      
      case "send":
      case "pay":
        // Execute the transaction
        if (!context?.walletId || !context?.walletAddress) {
          return {
            message: "Wallet not found. Please create a wallet first.",
            intent,
          };
        }
        
        // The actual transaction execution should happen in the chat page
        // This just confirms we're ready
        return {
          message: `✅ Confirmed! Executing ${pendingAction.type === "send" ? "send" : "payment"} transaction...`,
          intent,
          requiresConfirmation: false,
          transactionPreview: pendingAction.data.transactionPreview,
        };
      
      case "trade":
        // Execute trade
        return {
          message: `✅ Confirmed! Executing trade...`,
          intent,
        };
      
      default:
        return {
          message: `✅ Confirmed! Processing your request...`,
          intent,
        };
    }
  }
  
  /**
   * Helper method to enhance response with natural language
   */
  private static async enhanceResponse(
    baseMessage: string,
    intent: ParsedIntent,
    action: string,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    data?: any,
    sessionId?: string,
    isMissingInfo?: boolean,
    missingFields?: string[]
  ): Promise<string> {
    try {
      const agentContext = {
        hasWallet: context?.hasWallet,
        balance: context?.balance,
        walletAddress: context?.walletAddress,
        walletId: context?.walletId,
      };

      const enhanced = await generateNaturalResponse({
        intent: intent.intent,
        action,
        data: { message: baseMessage, ...data },
        context: agentContext,
        userMessage: intent.rawCommand,
        sessionId,
        isMissingInfo,
        missingFields,
      });

      return enhanced.message;
    } catch (error) {
      console.warn("Error enhancing response, using base message:", error);
      return baseMessage;
    }
  }

  private static async handleGreetingIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string },
    sessionId?: string
  ): Promise<AIResponse> {
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
      const message = await this.enhanceResponse(
        "I'm doing great, thank you! 😊 I'm here and ready to help you with your wallet. What would you like to do?",
        intent,
        "greeting_response",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }
    
    // Generate natural greeting
    const baseGreeting = timeGreeting 
      ? `${timeGreeting} 👋 I'm ARCLE, your AI wallet assistant!`
      : "Hello! 👋 I'm ARCLE, your AI wallet assistant!";
    
    const suggestions = context?.hasWallet
      ? "Try asking me:\n• \"What's my balance?\"\n• \"Show my address\"\n• \"Send $50 to 0x...\"\n• \"Transaction history\"\n• \"Earn yield\"\n• \"Bridge to Ethereum\""
      : "To get started, you'll need to create a wallet first. Would you like to create one?";
    
    const message = await this.enhanceResponse(
      `${baseGreeting}\n\n${suggestions}`,
      intent,
      "greeting",
      context,
      undefined,
      sessionId
    );
    
    return { message, intent };
  }
  
  private static async handleSendIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    sessionId?: string
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
    
    // Check for phishing URLs in the original message
    const phishingResult = detectPhishingUrls(intent.rawCommand);
    if (phishingResult.blocked) {
      return {
        message: `🚨 **PHISHING DETECTED - TRANSACTION BLOCKED**\n\nI detected suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\n**Reasons:**\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis transaction has been blocked for your safety. Please verify the recipient address and never share your private keys or seed phrases.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    // Check if this is a new wallet address (not in transaction history)
    const isNewWallet = await this.checkIfNewWallet(normalizedAddress, context.walletId);
    
    // Calculate estimated fee (simplified)
    const estimatedFee = "0.01";
    
    // Calculate real risk score (include message for phishing detection)
    const riskResult = await calculateRiskScore(normalizedAddress, amount, undefined, intent.rawCommand);
    
    // Add phishing warning if detected but not blocked
    let phishingWarning = "";
    if (phishingResult.isPhishing && !phishingResult.blocked) {
      phishingWarning = `⚠️ **PHISHING WARNING**\n\nI detected potentially suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\n**Reasons:**\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nPlease verify these URLs are legitimate before proceeding.\n\n`;
    }
    
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
    
    // Build base message with natural language
    let baseMessage = phishingWarning; // Add phishing warning first if present
    
    if (isNewWallet) {
      baseMessage += `Got it! I'm preparing to send $${amount} USDC to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n⚠️ **NEW WALLET ADDRESS DETECTED**\n\nI noticed this address hasn't been used in your transaction history before. I'm being extra careful here because new addresses can sometimes be risky - it could be a typo or a new recipient. Please double-check this is the correct address before we proceed.\n\n`;
    } else {
      baseMessage += `Got it! I'm preparing to send $${amount} USDC to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}. I've sent to this address before, so it looks familiar.\n\n`;
    }
    
    baseMessage += `${riskMessage}\n\n**Risk Factors:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\n**Arc Benefits:**\n• Gas paid in USDC (no ETH needed)\n• Sub-second transaction finality\n• Native USDC support\n\n`;
    
    // Add confirmation prompt based on whether it's a new wallet
    if (isNewWallet) {
      baseMessage += `**⚠️ This is a new wallet address. Do you want to proceed with this transaction?**\n\nPlease confirm by saying "yes", "confirm", or "proceed" to continue, or "no", "cancel", or "stop" to abort.`;
    } else {
      baseMessage += `Please review and confirm:`;
    }
    
    // Enhance with natural language
    const message = await this.enhanceResponse(
      baseMessage,
      intent,
      "send_transaction",
      context,
      {
        amount,
        address: normalizedAddress,
        isNewWallet,
        riskScore: riskResult.score,
        riskLevel: riskResult.level,
      }
    );
    
    return {
      message,
      intent,
      requiresConfirmation: true,
      transactionPreview: {
        amount,
        to: normalizedAddress,
        fee: estimatedFee,
        riskScore: riskResult.score,
        riskReasons: riskResult.reasons,
        blocked: false,
        isNewWallet, // Add flag to indicate if this is a new wallet
      },
    };
  }
  
  /**
   * Check if an address is a new wallet (not in transaction history)
   */
  private static async checkIfNewWallet(
    address: string,
    walletId?: string
  ): Promise<boolean> {
    // Check address history from risk scoring
    const { getAddressHistory } = await import("@/lib/security/risk-scoring");
    const addressHistory = getAddressHistory(address);
    
    // If address has no history, it's new
    if (!addressHistory || addressHistory.transactionCount === 0) {
      // Also check transaction history from Circle API if walletId is available
      if (walletId) {
        try {
          // Fetch recent transactions to check if this address has been used
          const response = await fetch(
            `/api/circle/transactions?walletId=${walletId}&limit=50`
          );
          const data = await response.json();
          
          if (data.success && data.data?.data) {
            const innerData = data.data.data;
            const txList = Array.isArray(innerData) ? innerData : [innerData];
            
            // Check if any transaction has this address as destination
            const hasUsedAddress = txList.some((tx: any) => {
              const actualTx = tx.transaction || tx;
              const txToAddress = actualTx.destinationAddress || 
                                actualTx.destination?.address || 
                                actualTx.to || "";
              return txToAddress.toLowerCase() === address.toLowerCase();
            });
            
            // If address has been used in transaction history, it's not new
            if (hasUsedAddress) {
              return false;
            }
          }
        } catch (error) {
          // If we can't fetch transaction history, rely on address history cache
          console.warn("Could not fetch transaction history to check for new wallet:", error);
        }
      }
      
      return true; // New wallet if no history found
    }
    
    return false; // Not a new wallet if it has transaction history
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
  
  private static async handleBalanceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "Please create a wallet first to check your balance.",
        intent,
        "balance_check_no_wallet",
        context
      );
      return { message, intent };
    }
    
    const balance = context.balance || "0.00";
    
    const message = await this.enhanceResponse(
      `Your balance is **$${balance} USDC** on Arc network.`,
      intent,
      "balance_check",
      context,
      { balance }
    );
    
    return { message, intent };
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
  
  private static async handleHistoryIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "Please create a wallet first to view transaction history.",
        intent,
        "history_check_no_wallet",
        context
      );
      return { message, intent };
    }
    
    const message = await this.enhanceResponse(
      "I'm fetching your transaction history now. This will show all your recent transactions on Arc network.",
      intent,
      "fetch_history",
      context
    );
    
    return { message, intent };
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
      message: `🌉 **Cross-Chain Bridge (CCTP)**\n\nI can bridge **$${amount} ${currency || "USDC"}** from Arc to **${destinationChain}** using Circle's CCTP.\n\n**CCTP Benefits:**\n• Zero Slippage: 1:1 USDC transfers\n• Instant Settlements: Near-instant finality\n• Enterprise-Grade Security\n\nPlease provide the destination address on ${destinationChain} to continue.`,
      intent,
      requiresConfirmation: false,
    };
  }
  
  private static async handlePayIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    sessionId?: string
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
    
    // Check for phishing URLs in the original message
    const phishingResult = detectPhishingUrls(intent.rawCommand);
    if (phishingResult.blocked) {
      return {
        message: `🚨 **PHISHING DETECTED - PAYMENT BLOCKED**\n\nI detected suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\n**Reasons:**\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis payment has been blocked for your safety. Please verify the recipient address and never share your private keys or seed phrases.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    // Check if this is a new wallet address (not in transaction history)
    const isNewWallet = await this.checkIfNewWallet(normalizedAddress, context.walletId);
    
    // Calculate estimated fee
    const estimatedFee = "0.01";
    
    // Calculate real risk score (include message for phishing detection)
    const riskResult = await calculateRiskScore(normalizedAddress, amount, undefined, intent.rawCommand);
    
    // Add phishing warning if detected but not blocked
    let phishingWarning = "";
    if (phishingResult.isPhishing && !phishingResult.blocked) {
      phishingWarning = `⚠️ **PHISHING WARNING**\n\nI detected potentially suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\n**Reasons:**\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nPlease verify these URLs are legitimate before proceeding.\n\n`;
    }
    
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
    
    // Build message with new wallet warning if applicable
    let message = phishingWarning; // Add phishing warning first if present
    message += `💳 I'll pay $${amount} USDC to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n`;
    
    // Add new wallet warning if this is a new address
    if (isNewWallet) {
      message += `⚠️ **NEW WALLET ADDRESS DETECTED**\n\nThis address hasn't been used in your transaction history before. Please verify this is the correct recipient address before proceeding.\n\n`;
    }
    
    message += `${riskMessage}\n\n**Risk Factors:**\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\n`;
    
    // Add confirmation prompt based on whether it's a new wallet
    if (isNewWallet) {
      message += `**⚠️ This is a new wallet address. Do you want to proceed with this payment?**\n\nPlease confirm by saying "yes", "confirm", or "proceed" to continue, or "no", "cancel", or "stop" to abort.`;
    } else {
      message += `Please review and confirm:`;
    }
    
    return {
      message,
      intent,
      requiresConfirmation: true,
      transactionPreview: {
        amount,
        to: normalizedAddress,
        fee: estimatedFee,
        riskScore: riskResult.score,
        riskReasons: riskResult.reasons,
        blocked: false,
        isNewWallet, // Add flag to indicate if this is a new wallet
      },
    };
  }
  
  private static async handleYieldIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to earn yield.",
        intent,
      };
    }
    
    const { amount, currency } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you earn yield on your USDC! Please tell me:\n• How much to invest\n• Your risk tolerance (low/medium/high)\n\nExample: \"Earn yield on $1000 with low risk\"",
        intent,
      };
    }
    
    // Import yield farming service
    const { getBestYieldStrategy, startYieldFarming } = await import("@/lib/defi/yield-farming");
    
    // Determine risk tolerance from message
    const riskTolerance = intent.rawCommand.toLowerCase().includes("high") ? "high" :
                         intent.rawCommand.toLowerCase().includes("medium") ? "medium" : "low";
    
    // Find best yield strategy
    const strategy = await getBestYieldStrategy(amount, riskTolerance);
    
    if (!strategy) {
      return {
        message: `I couldn't find a suitable yield strategy for ${amount} USDC with ${riskTolerance} risk. Minimum amounts may be required.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    // Start yield farming
    if (context.walletId && context.walletAddress) {
      const result = await startYieldFarming(
        context.walletId,
        context.walletAddress,
        strategy.id,
        amount
      );
      
      if (result.success) {
        return {
          message: `✅ **Yield Farming Started**\n\n**Strategy:** ${strategy.name}\n**Protocol:** ${strategy.protocol}\n**Chain:** ${strategy.chain}\n**Amount:** ${amount} USDC\n**APY:** ${strategy.apy}%\n**Risk Level:** ${strategy.riskLevel}\n\nYour funds are now earning yield. I'll automatically compound rewards for you.`,
          intent,
          requiresConfirmation: false,
        };
      } else {
        return {
          message: `❌ Failed to start yield farming: ${result.message}`,
          intent,
          requiresConfirmation: false,
        };
      }
    }
    
    return {
      message: `💰 **Yield Strategy Found**\n\n**Best Option:** ${strategy.name}\n**Protocol:** ${strategy.protocol}\n**Chain:** ${strategy.chain}\n**APY:** ${strategy.apy}%\n**Risk Level:** ${strategy.riskLevel}\n**Minimum:** ${strategy.minAmount} USDC\n\nWould you like to start earning yield with this strategy?`,
      intent,
      requiresConfirmation: true,
    };
  }
  
  private static async handleArbitrageIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress) {
      return {
        message: "Please create a wallet first to find arbitrage opportunities.",
        intent,
      };
    }
    
    const { scanArbitrageOpportunities } = await import("@/lib/defi/arbitrage");
    
    try {
      const opportunities = await scanArbitrageOpportunities(context.walletAddress, 0.5);
      
      if (opportunities.length === 0) {
        return {
          message: "🔍 **Arbitrage Scan Complete**\n\nNo profitable arbitrage opportunities found at this time. I'll keep monitoring and notify you when opportunities arise.",
          intent,
          requiresConfirmation: false,
        };
      }
      
      const bestOpp = opportunities[0];
      return {
        message: `💰 **Arbitrage Opportunity Found!**\n\n**Best Opportunity:**\n• From: ${bestOpp.fromChain}\n• To: ${bestOpp.toChain}\n• Profit Margin: ${bestOpp.profitMargin.toFixed(2)}%\n• Estimated Profit: ${bestOpp.estimatedProfit} USDC\n• Amount: ${bestOpp.amount} USDC\n• Risk Level: ${bestOpp.riskLevel}\n\nWould you like to execute this arbitrage opportunity?`,
        intent,
        requiresConfirmation: true,
      };
    } catch (error: any) {
      return {
        message: `❌ Failed to scan for arbitrage: ${error.message}`,
        intent,
        requiresConfirmation: false,
      };
    }
  }
  
  private static async handleRebalanceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to rebalance your portfolio.",
        intent,
      };
    }
    
    const { analyzePortfolio, executeRebalancing, createDefaultStrategy } = await import("@/lib/defi/portfolio-rebalancing");
    
    try {
      const strategy = createDefaultStrategy();
      const actions = await analyzePortfolio(context.walletAddress, strategy);
      
      if (actions.length === 0) {
        return {
          message: "✅ **Portfolio Analysis**\n\nYour portfolio is already balanced! No rebalancing needed at this time.",
          intent,
          requiresConfirmation: false,
        };
      }
      
      return {
        message: `📊 **Portfolio Rebalancing Needed**\n\nI found ${actions.length} rebalancing action(s) needed:\n\n${actions.map((a, i) => `${i + 1}. ${a.reason}\n   Transfer: ${a.amount} USDC from ${a.fromChain} to ${a.toChain}`).join('\n\n')}\n\nWould you like me to execute these rebalancing actions?`,
        intent,
        requiresConfirmation: true,
      };
    } catch (error: any) {
      return {
        message: `❌ Failed to analyze portfolio: ${error.message}`,
        intent,
        requiresConfirmation: false,
      };
    }
  }
  
  private static async handleSplitPaymentIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to split payments.",
        intent,
      };
    }
    
    const { amount, recipient } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you split payments! Please tell me:\n• The total amount to split\n• How many recipients or the split percentages\n\nExample: \"Split $100 between 3 people\" or \"Split $100: 50% to Alice, 30% to Bob, 20% to Charlie\"",
        intent,
      };
    }
    
    const { calculateEvenSplit, calculatePercentageSplit } = await import("@/lib/defi/split-payments");
    
    if (recipient) {
      // Even split
      const numberOfRecipients = parseInt(recipient);
      if (isNaN(numberOfRecipients) || numberOfRecipients < 2) {
        return {
          message: "Please specify a valid number of recipients (at least 2).",
          intent,
        };
      }
      
      const amounts = calculateEvenSplit(amount, numberOfRecipients);
      return {
        message: `💰 **Split Payment Calculation**\n\n**Total:** $${amount} USDC\n**Recipients:** ${numberOfRecipients}\n**Per Recipient:**\n${amounts.map((a, i) => `  ${i + 1}. $${a} USDC`).join('\n')}\n\nPlease provide the recipient addresses to proceed.`,
        intent,
        requiresConfirmation: false,
      };
    }
    
    return {
      message: `I'll split $${amount} USDC. Please specify:\n• How many recipients, or\n• The percentage split for each recipient`,
      intent,
      requiresConfirmation: false,
    };
  }
  
  private static async handleBatchIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to batch transactions.",
        intent,
      };
    }
    
    return {
      message: "📦 **Batch Transactions**\n\nI can help you batch multiple transactions together to save on gas fees. Please provide:\n• The list of transactions (addresses and amounts)\n\nExample: \"Batch these: Send $10 to 0x..., Send $20 to 0x...\"\n\nOr use the UI to select multiple transactions and batch them.",
      intent,
      requiresConfirmation: false,
    };
  }
  
  private static async handleSavingsIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Please create a wallet first to open a savings account.",
        intent,
      };
    }
    
    const { amount, recipient: riskTolerance } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you create a savings account! Please tell me:\n• The initial deposit amount\n• Your risk tolerance (low/medium/high)\n\nExample: \"Create a savings account with $1000, low risk\"",
        intent,
      };
    }
    
    const risk = (riskTolerance as "low" | "medium" | "high") || "low";
    const apyMap = { low: 4.5, medium: 6.2, high: 8.5 };
    const apy = apyMap[risk];
    
    return {
      message: `💰 **Savings Account**\n\n**Initial Deposit:** $${amount} USDC\n**Risk Level:** ${risk}\n**APY:** ${apy}%\n**Auto-Compound:** Enabled\n\nWould you like to create this savings account?`,
      intent,
      requiresConfirmation: true,
    };
  }
  
  private static async handleTradeIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to execute trades.",
        intent,
      };
    }
    
    const { amount, currency, recipient: toToken } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you trade tokens! Please tell me:\n• The amount to trade\n• The token pair (e.g., \"Trade $100 USDC for ETH\")\n\nExample: \"Trade $100 USDC for ETH\"",
        intent,
      };
    }
    
    if (!toToken) {
      return {
        message: `I'll trade $${amount} USDC. Please specify the destination token:\n\nExample: "Trade $${amount} USDC for ETH" or "Swap $${amount} USDC to BTC"`,
        intent,
      };
    }
    
    // Store pending action for confirmation
    if (sessionId) {
      setPendingAction(sessionId, {
        type: "trade",
        data: {
          amount,
          fromToken: "USDC",
          toToken,
        },
        timestamp: Date.now(),
      });
    }
    
    return {
      message: `🔄 **Trade Execution**\n\n**From:** ${amount} USDC\n**To:** ${toToken}\n**Chain:** Arc\n\nI'll find the best route across multiple DEXs for optimal execution. Would you like to proceed? Please confirm by saying "yes" or "confirm".`,
      intent,
      requiresConfirmation: true,
    };
  }
  
  private static async handleLimitOrderIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to create limit orders.",
        intent,
      };
    }
    
    const { amount, currency: orderType, recipient: targetPrice } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you create a limit order! Please tell me:\n• The amount\n• Buy or sell\n• The target price\n\nExample: \"Create a limit buy order for $100 USDC at $1.00\"",
        intent,
      };
    }
    
    if (!orderType || !targetPrice) {
      return {
        message: `I'll create a limit order for $${amount} USDC. Please specify:\n• Order type: Buy or Sell\n• Target price\n\nExample: "Limit buy $${amount} USDC at $1.00"`,
        intent,
      };
    }
    
    return {
      message: `📋 **Limit Order**\n\n**Type:** ${orderType.toUpperCase()}\n**Amount:** $${amount} USDC\n**Target Price:** $${targetPrice}\n**Status:** Pending\n\nI'll execute this order automatically when the price reaches $${targetPrice}. Would you like to create this limit order?`,
      intent,
      requiresConfirmation: true,
    };
  }
  
  private static async handleLiquidityIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to aggregate liquidity.",
        intent,
      };
    }
    
    const { amount } = intent.entities;
    
    if (!amount) {
      return {
        message: "I can help you find the best liquidity across multiple chains! Please tell me:\n• The amount to trade\n• The token pair\n\nExample: \"Find best liquidity for $1000 USDC to ETH\"",
        intent,
      };
    }
    
    return {
      message: `💧 **Liquidity Aggregation**\n\nI'll search across multiple DEXs and chains to find the best liquidity for your trade of $${amount} USDC.\n\nThis will:\n• Compare prices across chains\n• Find optimal execution paths\n• Minimize slippage\n\nWould you like me to find the best liquidity?`,
      intent,
      requiresConfirmation: true,
    };
  }
  
  private static async handleCompoundIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "Please create a wallet first to set up auto-compounding.",
        intent,
      };
    }
    
    const { getActivePositions } = await import("@/lib/defi/yield-farming");
    const positions = getActivePositions(context.walletAddress);
    
    if (positions.length === 0) {
      return {
        message: "You don't have any active yield positions to compound. Create a yield farming position first!",
        intent,
        requiresConfirmation: false,
      };
    }
    
    return {
      message: `🔄 **Auto-Compound Setup**\n\nYou have ${positions.length} active yield position(s). I can set up automatic compounding to reinvest your rewards.\n\n**Options:**\n• Daily compounding\n• Weekly compounding\n• Monthly compounding\n\nWould you like to enable auto-compounding for your yield positions?`,
      intent,
      requiresConfirmation: true,
    };
  }

  private static async handleConvertIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to convert currencies.",
        intent,
      };
    }

    const { amount, currency, recipient } = intent.entities;
    
    if (!amount) {
      return {
        message: "How much would you like to convert? For example: 'Convert 100 USDC to EURC'",
        intent,
      };
    }

    // Determine from and to currencies
    let fromCurrency = currency || "USDC";
    let toCurrency = recipient || "EURC";
    
    // If user said "convert 100 USDC", assume they want to convert to EURC
    if (currency && !recipient) {
      toCurrency = currency === "USDC" ? "EURC" : "USDC";
    }
    
    // If user said "convert 100", try to infer from context
    if (!currency && !recipient) {
      fromCurrency = "USDC"; // Default
      toCurrency = "EURC";
    }

    try {
      // Import and call FX conversion directly (server-side)
      const { convertCurrency } = await import("@/lib/fx/fx-rates");
      const result = await convertCurrency(amount, fromCurrency, toCurrency);

      if (!result.success || !result.convertedAmount || !result.rate) {
        return {
          message: `❌ Conversion failed: ${result.error || "Unknown error"}`,
          intent,
        };
      }

      const { convertedAmount, rate } = result;
      
      const message = await this.enhanceResponse(
        `💱 **Currency Conversion Preview**\n\n**From:** ${amount} ${fromCurrency}\n**To:** ~${convertedAmount} ${toCurrency}\n**Rate:** 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}\n\nReady to convert? This will execute a swap transaction.`,
        intent,
        "currency_conversion",
        context,
        {
          fromCurrency,
          toCurrency,
          amount,
          convertedAmount,
          rate,
        }
      );
      
      return {
        message,
        intent,
        requiresConfirmation: true,
      };
    } catch (error) {
      return {
        message: `❌ Error fetching conversion rate: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleFXRateIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    const { currency, recipient } = intent.entities;
    
    let fromCurrency = currency || "USDC";
    let toCurrency = recipient || "EURC";
    
    // If only one currency specified, assume USDC to that currency
    if (currency && !recipient) {
      toCurrency = currency;
      fromCurrency = "USDC";
    } else if (!currency && recipient) {
      fromCurrency = "USDC";
      toCurrency = recipient;
    }

    try {
      // Import and call FX rate directly (server-side)
      const { getFXRate } = await import("@/lib/fx/fx-rates");
      const result = await getFXRate(fromCurrency, toCurrency);

      if (!result.success || !result.rate) {
        return {
          message: `❌ Could not fetch exchange rate: ${result.error || "Unknown error"}`,
          intent,
        };
      }

      const { rate, source, timestamp } = result.rate;
      const rateDate = new Date(timestamp).toLocaleString();
      
      const message = await this.enhanceResponse(
        `💱 **Exchange Rate**\n\n**${fromCurrency} → ${toCurrency}**\n**Rate:** 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}\n**Source:** ${source}\n**Updated:** ${rateDate}`,
        intent,
        "fx_rate",
        context,
        {
          fromCurrency,
          toCurrency,
          rate,
          source,
        }
      );
      
      return {
        message,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error fetching exchange rate: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleMultiCurrencyIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to view your currencies.",
        intent,
      };
    }

    try {
      // Import and call multi-currency balance directly (server-side)
      const { getMultiCurrencyBalance } = await import("@/lib/fx/multi-currency-balance");
      const multiBalance = await getMultiCurrencyBalance(context.walletId!);
      
      const { balances, totalValueUSD } = multiBalance;

      if (balances.length === 0) {
        return {
          message: "You don't have any currency balances yet. Create a wallet and receive some tokens!",
          intent,
        };
      }

      let message = `💱 **Your Currency Balances**\n\n`;
      
      for (const balance of balances) {
        message += `**${balance.currency}:** ${balance.amount} ${balance.currency}\n`;
      }
      
      message += `\n**Total Value:** ~$${totalValueUSD} USD\n\n`;
      message += `Want to convert between currencies? Just ask!`;

      const enhancedMessage = await this.enhanceResponse(
        message,
        intent,
        "multi_currency",
        context,
        {
          balances,
          totalValueUSD,
        }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error fetching currency balances: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleInvoiceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    const { amount, recipient, currency, date } = intent.entities;
    
    // Check if user wants to list invoices
    const lowerCommand = intent.rawCommand.toLowerCase();
    if (lowerCommand.includes("list") || lowerCommand.includes("show") || lowerCommand.includes("outstanding") || lowerCommand.includes("overdue")) {
      try {
        const { getAllInvoices, getOutstandingInvoices, getOverdueInvoices } = await import("@/lib/invoices/invoice-service");
        
        let invoices;
        if (lowerCommand.includes("overdue")) {
          invoices = getOverdueInvoices();
        } else if (lowerCommand.includes("outstanding")) {
          invoices = getOutstandingInvoices();
        } else {
          invoices = getAllInvoices();
        }
        
        if (invoices.length === 0) {
          return {
            message: "You don't have any invoices yet. Create one by saying 'Create invoice for $500 to Acme Corp'",
            intent,
          };
        }
        
        let message = `📄 **Your Invoices**\n\n`;
        for (const invoice of invoices.slice(0, 10)) {
          const dueDate = new Date(invoice.dueDate).toLocaleDateString();
          message += `**${invoice.invoiceNumber}** - ${invoice.recipient}\n`;
          message += `Amount: ${invoice.amount} ${invoice.currency}\n`;
          message += `Status: ${invoice.status}\n`;
          message += `Due: ${dueDate}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(
          message,
          intent,
          "list_invoices",
          context,
          { invoices }
        );
        
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching invoices: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Create invoice
    if (!amount || !recipient) {
      return {
        message: "To create an invoice, please provide:\n• Amount (e.g., $500)\n• Recipient (e.g., Acme Corp)\n• Optional: Due date (e.g., 'due in 30 days')\n\nExample: 'Create invoice for $5,000 to Acme Corp, due in 30 days'",
        intent,
      };
    }
    
    try {
      const { createInvoice } = await import("@/lib/invoices/invoice-service");
      
      // Parse due date
      let dueDate = new Date();
      if (date) {
        // Simple date parsing
        if (date.includes("tomorrow")) {
          dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else if (date.includes("next week")) {
          dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else if (date.match(/\d+\s+days?/)) {
          const days = parseInt(date.match(/(\d+)/)?.[1] || "30");
          dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        } else {
          dueDate = new Date(date);
        }
      } else {
        // Default to 30 days
        dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
      
      const invoice = createInvoice({
        recipient,
        amount,
        currency: currency || "USDC",
        dueDate: dueDate.toISOString(),
        description: `Invoice for ${recipient}`,
      });
      
      const enhancedMessage = await this.enhanceResponse(
        `✅ **Invoice Created!**\n\n**Invoice #:** ${invoice.invoiceNumber}\n**Recipient:** ${invoice.recipient}\n**Amount:** ${invoice.amount} ${invoice.currency}\n**Due Date:** ${new Date(invoice.dueDate).toLocaleDateString()}\n**Status:** ${invoice.status}\n\nI'll remind you before it's due!`,
        intent,
        "create_invoice",
        context,
        { invoice }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error creating invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handlePaymentRollIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to set up payment rolls.",
        intent,
      };
    }
    
    const { amount, recipient, frequency } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    
    // Check if user wants to list payment rolls
    if (lowerCommand.includes("list") || lowerCommand.includes("show")) {
      try {
        const { getAllPaymentRolls } = await import("@/lib/invoices/payment-roll");
        const rolls = getAllPaymentRolls();
        
        if (rolls.length === 0) {
          return {
            message: "You don't have any payment rolls set up. Create one by saying 'Set up payroll: Pay Jake $3,000, Sarah $4,000 monthly'",
            intent,
          };
        }
        
        let message = `💰 **Your Payment Rolls**\n\n`;
        for (const roll of rolls) {
          const nextDate = new Date(roll.nextPaymentDate).toLocaleDateString();
          message += `**${roll.name}**\n`;
          message += `Frequency: ${roll.frequency}\n`;
          message += `Total: ${roll.totalAmount} ${roll.currency}\n`;
          message += `Recipients: ${roll.recipients.length}\n`;
          message += `Next Payment: ${nextDate}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(
          message,
          intent,
          "list_payment_rolls",
          context,
          { rolls }
        );
        
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching payment rolls: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Create payment roll
    if (!recipient || !amount) {
      return {
        message: "To set up a payment roll, please provide:\n• Recipients and amounts (e.g., 'Pay Jake $3,000, Sarah $4,000')\n• Frequency (e.g., 'monthly', 'weekly', 'biweekly')\n\nExample: 'Set up payroll: Pay Jake $3,000, Sarah $4,000, Mike $3,500 every 15th'",
        intent,
      };
    }
    
    try {
      const { createPaymentRoll } = await import("@/lib/invoices/payment-roll");
      
      // Parse recipients from command (simple extraction)
      const recipients: Array<{ id: string; name: string; address: string; amount: string; currency: string }> = [];
      const recipientPattern = /(?:pay|send)\s+\$?(\d+(?:\.\d+)?)\s*(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})/gi;
      let match;
      while ((match = recipientPattern.exec(intent.rawCommand)) !== null) {
        recipients.push({
          id: crypto.randomUUID(),
          name: match[2].trim(),
          address: "", // Will need to be filled from contacts
          amount: match[1],
          currency: "USDC",
        });
      }
      
      if (recipients.length === 0) {
        // Fallback to single recipient
        recipients.push({
          id: crypto.randomUUID(),
          name: recipient,
          address: "",
          amount: amount,
          currency: "USDC",
        });
      }
      
      const roll = createPaymentRoll({
        name: `Payment Roll ${new Date().toLocaleDateString()}`,
        recipients,
        frequency: (frequency as any) || "monthly",
        nextPaymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: "USDC",
      });
      
      const enhancedMessage = await this.enhanceResponse(
        `✅ **Payment Roll Created!**\n\n**Name:** ${roll.name}\n**Frequency:** ${roll.frequency}\n**Total Amount:** ${roll.totalAmount} ${roll.currency}\n**Recipients:** ${roll.recipients.length}\n**Next Payment:** ${new Date(roll.nextPaymentDate).toLocaleDateString()}\n\nI'll process payments automatically on the scheduled dates!`,
        intent,
        "create_payment_roll",
        context,
        { roll }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error creating payment roll: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleRemittanceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to send remittances.",
        intent,
      };
    }
    
    const { amount, recipient, address: country } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    
    // Check if user wants to list remittances
    if (lowerCommand.includes("list") || lowerCommand.includes("show")) {
      try {
        const { getAllRemittances } = await import("@/lib/remittances/remittance-service");
        const remittances = getAllRemittances();
        
        if (remittances.length === 0) {
          return {
            message: "You haven't sent any remittances yet. Send one by saying 'Send $500 to my mom in Mexico'",
            intent,
          };
        }
        
        let message = `🌍 **Your Remittances**\n\n`;
        for (const rem of remittances.slice(0, 10)) {
          const date = new Date(rem.createdAt).toLocaleDateString();
          message += `**${rem.remittanceNumber}** - ${rem.recipientName}\n`;
          message += `${rem.amount} USDC → ${rem.convertedAmount} ${rem.recipientCurrency}\n`;
          message += `Country: ${rem.recipientCountry}\n`;
          message += `Status: ${rem.status}\n`;
          message += `Date: ${date}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(
          message,
          intent,
          "list_remittances",
          context,
          { remittances }
        );
        
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching remittances: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Create remittance
    if (!amount || !recipient || !country) {
      return {
        message: "To send a remittance, please provide:\n• Amount (e.g., $500)\n• Recipient name (e.g., 'my mom')\n• Country (e.g., 'Mexico')\n\nExample: 'Send $500 to my mom in Mexico'",
        intent,
      };
    }
    
    try {
      const { createRemittance } = await import("@/lib/remittances/remittance-service");
      
      const remittance = await createRemittance({
        recipientName: recipient,
        recipientCountry: country,
        amount,
        metadata: {
          purpose: "Family remittance",
        },
      });
      
      const enhancedMessage = await this.enhanceResponse(
        `✅ **Remittance Created!**\n\n**Remittance #:** ${remittance.remittanceNumber}\n**Recipient:** ${remittance.recipientName}\n**Country:** ${remittance.recipientCountry}\n**Amount:** ${remittance.amount} USDC\n**Converted:** ${remittance.convertedAmount} ${remittance.recipientCurrency}\n**Exchange Rate:** 1 USDC = ${remittance.exchangeRate.toFixed(6)} ${remittance.recipientCurrency}\n**Fee:** ${remittance.fee} USDC\n**Total:** ${remittance.totalAmount} USDC\n\nReady to send?`,
        intent,
        "create_remittance",
        context,
        { remittance }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error creating remittance: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleFXAlertIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    const { amount: targetRate, recipient: direction, currency: pair } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    
    // Check if user wants to list alerts
    if (lowerCommand.includes("list") || lowerCommand.includes("show")) {
      try {
        const { getAllFXAlerts } = await import("@/lib/fx/fx-market-data");
        const alerts = getAllFXAlerts().filter(a => a.status === "active");
        
        if (alerts.length === 0) {
          return {
            message: "You don't have any active FX rate alerts. Create one by saying 'Notify me when USDC/EURC hits 0.95'",
            intent,
          };
        }
        
        let message = `🔔 **Your FX Rate Alerts**\n\n`;
        for (const alert of alerts) {
          message += `**${alert.pair}** ${alert.direction} ${alert.targetRate}\n`;
          message += `Status: ${alert.status}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(
          message,
          intent,
          "list_fx_alerts",
          context,
          { alerts }
        );
        
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching alerts: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Create alert
    if (!targetRate || !direction || !pair) {
      return {
        message: "To create an FX rate alert, please provide:\n• Currency pair (e.g., USDC-EURC)\n• Target rate (e.g., 0.95)\n• Direction (above or below)\n\nExample: 'Notify me when USDC/EURC hits 0.95 above'",
        intent,
      };
    }
    
    try {
      const { createFXRateAlert } = await import("@/lib/fx/fx-market-data");
      
      const alert = createFXRateAlert(
        pair,
        parseFloat(targetRate),
        direction as "above" | "below"
      );
      
      const enhancedMessage = await this.enhanceResponse(
        `✅ **FX Rate Alert Created!**\n\n**Pair:** ${alert.pair}\n**Alert:** ${alert.direction} ${alert.targetRate}\n**Status:** ${alert.status}\n\nI'll notify you when the rate ${alert.direction} ${alert.targetRate}!`,
        intent,
        "create_fx_alert",
        context,
        { alert }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error creating alert: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handlePerpetualIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to trade perpetuals.",
        intent,
      };
    }
    
    const { amount, recipient: side, currency: leverage } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    
    // Check if user wants to list positions
    if (lowerCommand.includes("list") || lowerCommand.includes("show") || lowerCommand.includes("positions")) {
      try {
        const { getAllPerpetualPositions } = await import("@/lib/trading/derivatives");
        const positions = getAllPerpetualPositions();
        
        if (positions.length === 0) {
          return {
            message: "You don't have any perpetual positions. Open one by saying 'Open 10x long on USDC/EURC with $1,000'",
            intent,
          };
        }
        
        let message = `📊 **Your Perpetual Positions**\n\n`;
        for (const pos of positions) {
          message += `**${pos.pair}** ${pos.side.toUpperCase()}\n`;
          message += `Size: ${pos.size}\n`;
          message += `Leverage: ${pos.leverage}x\n`;
          message += `Entry: ${pos.entryPrice}\n`;
          message += `Current: ${pos.currentPrice}\n`;
          message += `PnL: ${pos.pnl} (${pos.pnlPercent > 0 ? "+" : ""}${pos.pnlPercent}%)\n`;
          message += `Status: ${pos.status}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(
          message,
          intent,
          "list_perpetual_positions",
          context,
          { positions }
        );
        
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching positions: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Open position
    if (!side || !amount) {
      return {
        message: "⚠️ **High Risk Warning**\n\nTo open a perpetual position, please provide:\n• Side (long or short)\n• Size/Amount\n• Leverage (e.g., 10x)\n• Margin\n\nExample: 'Open 10x long on USDC/EURC with $1,000'\n\n⚠️ Leveraged trading is high risk. Only trade what you can afford to lose!",
        intent,
      };
    }
    
    try {
      const { openPerpetualPosition } = await import("@/lib/trading/derivatives");
      
      // Default values
      const pair = "USDC/EURC";
      const leverageNum = leverage ? parseInt(leverage) : 10;
      const margin = amount;
      
      const position = openPerpetualPosition(
        pair,
        side as "long" | "short",
        amount,
        leverageNum,
        margin
      );
      
      const enhancedMessage = await this.enhanceResponse(
        `⚠️ **Perpetual Position Opened**\n\n**Pair:** ${position.pair}\n**Side:** ${position.side.toUpperCase()}\n**Size:** ${position.size}\n**Leverage:** ${position.leverage}x\n**Entry Price:** ${position.entryPrice}\n**Liquidation Price:** ${position.liquidationPrice}\n**Margin:** ${position.margin}\n\n⚠️ Monitor your position closely! If price reaches ${position.liquidationPrice}, you will be liquidated.`,
        intent,
        "open_perpetual_position",
        context,
        { position }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error opening position: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  private static async handleOptionsIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "Please create a wallet first to trade options.",
        intent,
      };
    }
    
    return {
      message: "Options trading is coming soon! For now, you can trade perpetuals. Say 'Open long position' to get started.",
      intent,
    };
  }

  private static async handleAgentIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    const { recipient: name, currency: action } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    
    // Check if user wants to list agents
    if (lowerCommand.includes("list") || lowerCommand.includes("show")) {
      try {
        const { getAllAIAgents, getMarketplaceAgents } = await import("@/lib/agents/ai-agent-service");
        
        if (lowerCommand.includes("marketplace")) {
          const marketplace = getMarketplaceAgents();
          let message = `🤖 **Agent Marketplace**\n\n`;
          for (const agent of marketplace) {
            message += `**${agent.name}**\n`;
            message += `${agent.description}\n`;
            message += `Category: ${agent.category}\n`;
            message += `Rating: ${agent.rating || "N/A"}\n\n`;
          }
          const enhancedMessage = await this.enhanceResponse(message, intent, "list_marketplace_agents", context, { agents: marketplace });
          return {
            message: enhancedMessage,
            intent,
          };
        }
        
        const agents = getAllAIAgents();
        if (agents.length === 0) {
          return {
            message: "You don't have any AI agents. Create one by saying 'Create an agent to pay invoices under $500 automatically' or browse the marketplace!",
            intent,
          };
        }
        
        let message = `🤖 **Your AI Agents**\n\n`;
        for (const agent of agents) {
          message += `**${agent.name}**\n`;
          message += `Status: ${agent.status}\n`;
          message += `Executions: ${agent.executionCount}\n`;
          message += `Permissions: ${agent.permissions.length}\n\n`;
        }
        
        const enhancedMessage = await this.enhanceResponse(message, intent, "list_agents", context, { agents });
        return {
          message: enhancedMessage,
          intent,
        };
      } catch (error) {
        return {
          message: `❌ Error fetching agents: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }
    
    // Create agent
    if (!name || !action) {
      return {
        message: "To create an AI agent, please provide:\n• Agent name/description\n• Action to automate (e.g., 'pay invoices', 'compound yield')\n• Conditions (e.g., 'under $500')\n\nExample: 'Create an agent to pay all invoices under $500 automatically'",
        intent,
      };
    }
    
    try {
      const { createAIAgent } = await import("@/lib/agents/ai-agent-service");
      
      const agent = createAIAgent({
        name: name || "AI Agent",
        description: `Automated agent for ${action}`,
        permissions: [
          {
            action: action,
            conditions: {
              requiresApproval: false,
            },
          },
        ],
      });
      
      const enhancedMessage = await this.enhanceResponse(
        `✅ **AI Agent Created!**\n\n**Name:** ${agent.name}\n**Status:** ${agent.status}\n**Permissions:** ${agent.permissions.length} action(s)\n\nYour agent is now active and will execute actions automatically based on its permissions!`,
        intent,
        "create_agent",
        context,
        { agent }
      );
      
      return {
        message: enhancedMessage,
        intent,
      };
    } catch (error) {
      return {
        message: `❌ Error creating agent: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
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
      message: `💸 **Withdraw to fiat**\n\nOff-ramp is not available in this testnet build. I can help you send USDC on Arc or bridge to another chain.`,
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

  private static async handleScheduleIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; walletAddress?: string; walletId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "I'd love to help you schedule a payment! First, let's create a wallet for you. Would you like me to set that up?",
        intent,
        "schedule_no_wallet",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }

    const { amount, address, date, time } = intent.entities;

    // Ask ONE clarifying question at a time (interactive approach)
    if (!amount) {
      const message = await this.enhanceResponse(
        "I'd be happy to schedule a payment for you! How much would you like to send?",
        intent,
        "schedule_missing_amount",
        context,
        undefined,
        sessionId,
        true,
        ["amount"]
      );
      return { message, intent };
    }

    if (!address) {
      const message = await this.enhanceResponse(
        `Great! I'll schedule $${amount} USDC for you. What's the recipient's wallet address?`,
        intent,
        "schedule_missing_address",
        context,
        { amount },
        sessionId,
        true,
        ["address"]
      );
      return { message, intent };
    }

    // Validate address
    const addressValidation = validateAddress(address);
    if (!addressValidation.isValid) {
      const message = await this.enhanceResponse(
        `Hmm, that address doesn't look quite right. Could you double-check the wallet address? It should start with "0x" and be 42 characters long.`,
        intent,
        "schedule_invalid_address",
        context,
        { amount, address },
        sessionId,
        true,
        ["address"]
      );
      return { message, intent };
    }

    const normalizedAddress = addressValidation.normalizedAddress || address;

    // Parse schedule time
    const dateStr = date || "tomorrow";
    const timeStr = time || "12:00 pm";
    const scheduledTimestamp = parseScheduleTime(dateStr, timeStr);

    if (!scheduledTimestamp) {
      const message = await this.enhanceResponse(
        `I have the amount ($${amount}) and address, but I need to know when to schedule this. What date and time would you like? For example, "tomorrow at 3pm" or "next Monday at 9am".`,
        intent,
        "schedule_invalid_time",
        context,
        { amount, address },
        sessionId,
        true,
        ["date", "time"]
      );
      return { message, intent };
    }

    // Create scheduled payment
    if (typeof window !== "undefined") {
      const scheduledPayment = createScheduledPayment({
        amount,
        currency: "USDC",
        to: normalizedAddress,
        scheduledFor: scheduledTimestamp,
        walletId: context.walletId,
        walletAddress: context.walletAddress,
      });

      const scheduledDate = new Date(scheduledTimestamp);
      const formattedDate = scheduledDate.toLocaleString();

      const baseMessage = `✅ **Payment Scheduled!**\n\nI've scheduled a payment of **$${amount} USDC** to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n**Scheduled for:** ${formattedDate}\n\nI'll automatically execute this payment at the scheduled time. You can cancel it anytime before then.`;

      const message = await this.enhanceResponse(
        baseMessage,
        intent,
        "schedule_payment",
        context,
        {
          amount,
          address: normalizedAddress,
          scheduledFor: formattedDate,
          paymentId: scheduledPayment.id,
        },
        sessionId
      );

      return {
        message,
        intent,
        requiresConfirmation: false,
      };
    }

    const message = await this.enhanceResponse(
      "I've scheduled your payment. It will be executed automatically at the specified time.",
      intent,
      "schedule_payment",
      context
    );

    return { message, intent };
  }

  private static async handleSubscriptionIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "Please create a wallet first to set up subscriptions.",
        intent,
        "subscription_no_wallet",
        context
      );
      return { message, intent };
    }

    const amount = intent.entities.amount || "";
    const merchant = (intent.entities as any).merchant || "subscription";
    const frequency = (intent.entities as any).frequency || "monthly";
    const time = intent.entities.time || "8:00 am";

    // Construct nextChargeAt based on frequency
    const now = Date.now();
    let nextChargeAt = now + 24 * 60 * 60 * 1000; // Default: tomorrow
    
    if (frequency === "weekly") {
      nextChargeAt = now + 7 * 24 * 60 * 60 * 1000;
    } else if (frequency === "monthly") {
      nextChargeAt = now + 30 * 24 * 60 * 60 * 1000;
    }

    if (typeof window !== 'undefined') {
      const subscription = addSubscription({
        merchant,
        amount: amount || "0",
        currency: "USDC",
        frequency,
        nextChargeAt,
        autoRenew: true,
        remindBeforeMs: 2 * 24 * 60 * 60 * 1000, // 2 days (48 hours)
        paused: false,
      });

      const nextChargeDate = new Date(nextChargeAt).toLocaleString();
      const baseMessage = `✅ **Subscription Created!**\n\nI've set up a recurring subscription for **${merchant}**:\n• **Amount:** $${amount || "0"} USDC\n• **Frequency:** ${frequency}\n• **Next charge:** ${nextChargeDate}\n• **Auto-renew:** Enabled\n\nI'll remind you 2 days before each renewal, and the payment will be processed automatically.`;

      const message = await this.enhanceResponse(
        baseMessage,
        intent,
        "create_subscription",
        context,
        {
          merchant,
          amount: amount || "0",
          frequency,
          nextChargeDate,
        }
      );

      return { message, intent };
    }

    const message = await this.enhanceResponse(
      `Subscription created for ${merchant}: ${amount || "0"} USDC, ${frequency}. You'll be reminded 2 days before renewal.`,
      intent,
      "create_subscription",
      context
    );

    return { message, intent };
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
  
  private static async handleHelpIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    const helpMessage = `I'm your AI wallet assistant on ARCLE! I can help you with:

**Basic Operations:**
• Check your balance
• Send and receive USDC
• Make payments
• View your wallet address
• View transaction history

**Multi-Currency & FX:**
• View all currency balances (USDC, EURC)
• Convert between currencies (e.g., "Convert 100 USDC to EURC")
• Check exchange rates (e.g., "What's the USDC to EURC rate?")
• Multi-currency payments

**Invoice & Payment Management:**
• Create invoices (e.g., "Create invoice for $5,000 to Acme Corp, due in 30 days")
• View outstanding and overdue invoices
• Set up payment rolls for automated payroll (e.g., "Set up payroll: Pay Jake $3,000, Sarah $4,000 monthly")
• Track invoice payments and status

**Cross-Border Payments:**
• Send international remittances (e.g., "Send $500 to my mom in Mexico")
• View remittance history
• FX rate alerts (e.g., "Notify me when USDC/EURC hits 0.95")
• Historical FX rate data

**Advanced Trading:**
• Perpetual contracts (e.g., "Open 10x long on USDC/EURC with $1,000")
• Options trading (coming soon)
• Margin trading with leverage
• Stop loss and take profit orders

**AI Agents & Automation:**
• Create autonomous AI agents (e.g., "Create an agent to pay invoices under $500 automatically")
• Agent marketplace with pre-built agents
• Agent-to-agent payments
• Smart contract automation

**Cross-Chain Operations:**
• Bridge assets across chains (Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche)
• Zero slippage 1:1 USDC transfers via Circle CCTP

**DeFi & Yield:**
• Earn yield through automated yield farming
• Start savings accounts
• Execute intelligent trades
• Find arbitrage opportunities
• Rebalance portfolios
• Create limit orders
• Aggregate liquidity
• Auto-compound rewards
• Split payments
• Batch transactions

**Security:**
• Real-time transaction monitoring
• Scam detection
• Phishing URL detection
• Smart contract analysis

**Utilities:**
• **Schedule one-time payments** (e.g., "Schedule $50 to 0x... tomorrow at 3pm" or "Schedule one-time payment of $100 next Monday")
• Set up recurring subscriptions (e.g., "Subscribe $15 monthly for Netflix")
• View and manage scheduled payments
• Cancel scheduled payments before execution
• Request testnet tokens

Just ask me naturally, like "Send $50 to 0x..." or "What's my balance?" or "Schedule $100 to 0x... next Monday at 9am" and I'll help you!`;

    const message = await this.enhanceResponse(
      helpMessage,
      intent,
      "help",
      context
    );
    
    return { message, intent };
  }
  
  private static async handleUnknownIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    // Check if user is asking for testnet tokens
    const lowerMessage = intent.rawCommand.toLowerCase();
    if (lowerMessage.includes("faucet") || 
        lowerMessage.includes("testnet token") || 
        lowerMessage.includes("request token") ||
        lowerMessage.includes("get token") ||
        (lowerMessage.includes("token") && lowerMessage.includes("test"))) {
      const message = await this.enhanceResponse(
        "I can help you request testnet tokens! Just say \"Request testnet tokens\" or \"Get testnet USDC\" and I'll request tokens for your wallet.\n\nNote: Testnet tokens are for testing only and have no real value.",
        intent,
        "faucet_info",
        context
      );
      return {
        message,
        intent: { ...intent, intent: "faucet" },
      };
    }
    
    const message = await this.enhanceResponse(
      "I'm not quite sure what you're asking for. Let me help you! I can assist with:\n\n• Check your balance\n• Send USDC\n• Pay someone\n• Bridge assets (CCTP)\n• Earn yield\n• Start savings account\n• Execute trades\n• Find arbitrage opportunities\n• Rebalance portfolio\n• Create limit orders\n• Split payments\n• Batch transactions\n• Show your address\n• View transaction history\n• Request testnet tokens\n\nOr just type 'help' and I'll show you everything I can do!",
      intent,
      "unknown_intent",
      context
    );
    
    return { message, intent };
  }
  
}

