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
import { addSubscription } from "@/lib/subscriptions";
import { generateNaturalResponse, enhanceMessageWithReasoning } from "./natural-language-generator";
import { createScheduledPayment, parseScheduleTime } from "@/lib/scheduled-payments";
import {
  getConversationContext,
  updateConversationContext,
  addMessageToHistory,
  setPendingAction,
  clearPendingAction,
  getConversationSummary,
  type PendingAction,
  type ConversationContext
} from "./conversation-context";
import { removeMarkdownFormatting } from "@/lib/utils/format-message";

type AIContext = {
  hasWallet?: boolean;
  balance?: string;
  walletAddress?: string;
  walletId?: string;
  userId?: string;
  sessionId?: string;
};

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
  bridgeData?: {
    amount: string;
    fromChain: string;
    toChain: string;
    destinationAddress: string;
    walletId: string;
    walletAddress: string;
    fastTransfer?: boolean; // Enable Fast Transfer mode
    bridgeId?: string;
    transactionHash?: string;
    status?: string;
  };
}

export class AIService {
  /**
   * Process user message and generate AI response with natural language
   */
  static async processMessage(
    message: string,
    context?: AIContext,
    sessionId?: string
  ): Promise<AIResponse> {
    // Get or create session ID (sessionId should be provided by caller, fallback to UUID)
    const currentSessionId = sessionId || crypto.randomUUID();

    // Get userId from context first, then try localStorage (migration fallback)
    // Note: In production, userId should always come from context
    let userId = context?.userId;
    if (!userId && typeof window !== "undefined") {
      // Migration fallback: try localStorage (will be migrated to Supabase by chat page)
      const legacyUserId = localStorage.getItem("arcle_user_id");
      if (legacyUserId) {
        userId = legacyUserId;
      }
    }
    const runtimeContext: AIContext = {
      hasWallet: context?.hasWallet,
      balance: context?.balance,
      walletAddress: context?.walletAddress,
      walletId: context?.walletId,
      userId,
      sessionId: currentSessionId,
    };

    // Get conversation context (async now)
    const conversationContext = await getConversationContext(currentSessionId, userId);

    // Add user message to history (async now)
    await addMessageToHistory(currentSessionId, "user", message, userId);

    // Check for confirm/cancel intents first - these need context
    const classifiedIntent = IntentClassifier.classify(message);
    const intent = this.resolvePendingIntent(classifiedIntent, conversationContext);

    // Handle confirm intent - check if there's a pending action
    if (intent.intent === "confirm" && conversationContext.pendingAction) {
      const response = await this.handleConfirmIntent(intent, runtimeContext, conversationContext.pendingAction, currentSessionId);
      return this.finalizeResponse(response, currentSessionId, userId);
    }

    // Handle cancel intent
    if (intent.intent === "cancel" && conversationContext.pendingAction) {
      await clearPendingAction(currentSessionId, userId);
      const response = {
        message: "Action canceled. No changes were made.",
        intent,
      };
      return this.finalizeResponse(response, currentSessionId, userId);
    }

    let response: AIResponse | null = null;
    switch (intent.intent) {
      case "greeting":
        response = await this.handleGreetingIntent(intent, runtimeContext, currentSessionId);
        break;

      case "wallet_creation":
        response = await this.handleWalletCreationIntent(intent, runtimeContext, currentSessionId);
        break;

      case "send":
        response = await this.handleSendIntent(intent, runtimeContext, currentSessionId);
        break;

      case "receive":
        response = this.handleReceiveIntent(intent, runtimeContext);
        break;

      case "balance":
        response = await this.handleBalanceIntent(intent, runtimeContext);
        break;

      case "tokens":
        response = await this.handleTokensIntent(intent, runtimeContext);
        break;

      case "address":
        response = this.handleAddressIntent(intent, runtimeContext);
        break;

      case "transaction_history":
        response = await this.handleHistoryIntent(intent, runtimeContext);
        break;

      case "bridge":
        response = await this.handleBridgeIntent(intent, runtimeContext, currentSessionId);
        break;

      case "pay":
        response = await this.handlePayIntent(intent, runtimeContext, currentSessionId);
        break;

      case "yield":
        response = await this.handleYieldIntent(intent, runtimeContext);
        break;

      case "arbitrage":
        response = await this.handleArbitrageIntent(intent, runtimeContext);
        break;

      case "rebalance":
        response = await this.handleRebalanceIntent(intent, runtimeContext);
        break;

      case "split_payment":
        response = await this.handleSplitPaymentIntent(intent, runtimeContext);
        break;

      case "batch":
        response = await this.handleBatchIntent(intent, runtimeContext);
        break;

      case "savings":
        response = await this.handleSavingsIntent(intent, runtimeContext);
        break;

      case "trade":
        response = await this.handleTradeIntent(intent, runtimeContext, currentSessionId);
        break;

      case "limit_order":
        response = await this.handleLimitOrderIntent(intent, runtimeContext);
        break;

      case "liquidity":
        response = await this.handleLiquidityIntent(intent, runtimeContext);
        break;

      case "compound":
        response = await this.handleCompoundIntent(intent, runtimeContext);
        break;

      case "convert":
        response = await this.handleConvertIntent(intent, runtimeContext, currentSessionId);
        break;

      case "fx_rate":
        response = await this.handleFXRateIntent(intent, runtimeContext);
        break;

      case "multi_currency":
        response = await this.handleMultiCurrencyIntent(intent, runtimeContext);
        break;

      case "invoice":
        response = await this.handleInvoiceIntent(intent, runtimeContext);
        break;

      case "payment_roll":
        response = await this.handlePaymentRollIntent(intent, runtimeContext);
        break;

      case "remittance":
        response = await this.handleRemittanceIntent(intent, runtimeContext);
        break;

      case "fx_alert":
        response = await this.handleFXAlertIntent(intent, runtimeContext);
        break;

      case "perpetual":
        response = await this.handlePerpetualIntent(intent, runtimeContext);
        break;

      case "options":
        response = await this.handleOptionsIntent(intent, runtimeContext);
        break;

      case "agent":
        response = await this.handleAgentIntent(intent, runtimeContext);
        break;

      case "withdraw":
        response = await this.handleWithdrawIntent(intent, runtimeContext);
        break;

      case "scan":
        response = await this.handleScanIntent(intent, runtimeContext);
        break;

      case "schedule":
        response = await this.handleScheduleIntent(intent, runtimeContext, currentSessionId, conversationContext);
        break;

      case "subscription":
        response = await this.handleSubscriptionIntent(intent, runtimeContext, currentSessionId, conversationContext);
        break;

      case "renew":
        response = await this.handleRenewIntent(intent, runtimeContext);
        break;

      case "contact":
        response = await this.handleContactIntent(intent, runtimeContext, currentSessionId);
        break;

      case "notification":
        response = await this.handleNotificationIntent(intent, runtimeContext, currentSessionId);
        break;

      case "approve_token":
        response = await this.handleApproveTokenIntent(intent, runtimeContext, currentSessionId);
        break;

      case "reject_token":
        response = await this.handleRejectTokenIntent(intent, runtimeContext, currentSessionId);
        break;

      case "location":
        response = await this.handleLocationIntent(intent, runtimeContext, currentSessionId);
        break;

      case "help":
        response = await this.handleHelpIntent(intent, runtimeContext);
        break;

      default:
        response = await this.handleUnknownIntent(intent, runtimeContext);
    }

    return this.finalizeResponse(response, currentSessionId, userId);
  }

  private static resolvePendingIntent(
    intent: ParsedIntent,
    conversationContext?: ConversationContext
  ): ParsedIntent {
    if (intent.intent !== "unknown" || !conversationContext?.pendingAction) {
      return intent;
    }

    switch (conversationContext.pendingAction.type) {
      case "schedule":
        return { ...intent, intent: "schedule" };
      case "subscription":
        return { ...intent, intent: "subscription" };
      default:
        return intent;
    }
  }

  private static async finalizeResponse(
    response: AIResponse,
    sessionId?: string,
    userId?: string
  ): Promise<AIResponse> {
    if (sessionId) {
      if (response?.message) {
        await addMessageToHistory(sessionId, "assistant", response.message, userId);
      }
      await updateConversationContext(sessionId, { lastIntent: response.intent?.intent }, userId);
    }
    return response;
  }

  private static async persistScheduleDraft(
    sessionId?: string,
    context?: AIContext,
    draft?: { amount?: string; address?: string; date?: string; time?: string }
  ) {
    if (!sessionId) return;
    await setPendingAction(
      sessionId,
      {
        type: "schedule",
        timestamp: Date.now(),
        data: draft,
      },
      context?.userId
    );
  }

  private static async clearScheduleDraft(sessionId?: string, context?: AIContext) {
    if (!sessionId) return;
    const ctx = await getConversationContext(sessionId, context?.userId);
    if (ctx.pendingAction?.type === "schedule") {
      await clearPendingAction(sessionId, context?.userId);
    }
  }

  private static async persistSubscriptionDraft(
    sessionId?: string,
    context?: AIContext,
    draft?: { amount?: string; merchant?: string; frequency?: string; date?: string; time?: string }
  ) {
    if (!sessionId) return;
    await setPendingAction(
      sessionId,
      {
        type: "subscription",
        timestamp: Date.now(),
        data: draft,
      },
      context?.userId
    );
  }

  private static async clearSubscriptionDraft(sessionId?: string, context?: AIContext) {
    if (!sessionId) return;
    const ctx = await getConversationContext(sessionId, context?.userId);
    if (ctx.pendingAction?.type === "subscription") {
      await clearPendingAction(sessionId, context?.userId);
    }
  }

  /**
   * Handle confirm intent - execute pending action
   */
  private static async handleConfirmIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
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
      await clearPendingAction(sessionId, context?.userId);
    }

    // Execute the pending action based on type
    switch (pendingAction.type) {
      case "convert":
        // Execute FX swap with stored data
        return await this.executeFXSwap(
          pendingAction.data,
          context,
          sessionId
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
          message: `Confirmed! Executing ${pendingAction.type === "send" ? "send" : "payment"} transaction...`,
          intent,
          requiresConfirmation: false,
          transactionPreview: pendingAction.data.transactionPreview,
        };

      case "trade":
        // Execute trade
        return {
          message: `Confirmed! Executing trade...`,
          intent,
        };

      case "bridge": {
        const bridgeData = pendingAction.data?.bridgeData;
        if (!bridgeData) {
          return {
            message: "I couldn't find the bridge details. Could you please repeat the bridge request?",
            intent,
          };
        }

        return {
          message: "Awesome! Launching your bridge now. I'll keep you updated as it progresses.",
          intent: pendingAction.data?.sourceIntent || {
            intent: "bridge",
            confidence: 1,
            entities: pendingAction.data?.sourceIntent?.entities ?? {},
            rawCommand: pendingAction.data?.sourceIntent?.rawCommand || intent.rawCommand,
          },
          requiresConfirmation: true,
          bridgeData,
        };
      }

      default:
        return {
          message: `Confirmed! Processing your request...`,
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
    context?: AIContext,
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

      const resolvedSessionId = sessionId ?? context?.sessionId;
      const enhanced = await generateNaturalResponse({
        intent: intent.intent,
        action,
        data: { message: baseMessage, ...data },
        context: agentContext,
        userMessage: intent.rawCommand,
        sessionId: resolvedSessionId,
        isMissingInfo,
        missingFields,
      });

      // Remove markdown formatting from the final message
      return removeMarkdownFormatting(enhanced.message);
    } catch (error) {
      console.warn("Error enhancing response, using base message:", error);
      // Remove markdown from base message as fallback
      return removeMarkdownFormatting(baseMessage);
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
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
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
      // Check if user said "send money" without amount
      const lowerCommand = intent.rawCommand.toLowerCase();
      const isSendMoney = lowerCommand.includes("send money") || lowerCommand.includes("transfer money");

      const message = await this.enhanceResponse(
        isSendMoney
          ? "I'd be happy to help you send money! How much USDC would you like to send?"
          : "I'd be happy to help you send USDC! How much would you like to send?",
        intent,
        "send_missing_amount",
        context,
        undefined,
        sessionId,
        true,
        ["amount"]
      );
      return { message, intent };
    }

    // Ensure currency defaults to USDC for "send money" commands
    if (!intent.entities.currency) {
      intent.entities.currency = "USDC";
    }

    // Check if recipient is a contact name (if no address provided)
    let resolvedAddress = address;
    let contactName: string | undefined;

    if (!address && recipient && context?.userId) {
      // Try to find contact by name
      if (typeof window !== "undefined") {
        const { getContact, updateContactLastUsed } = await import("@/lib/storage/contacts");
        const contact = await getContact(context.userId, recipient);
        if (contact) {
          resolvedAddress = contact.address;
          contactName = contact.name;
          // Update last used timestamp
          await updateContactLastUsed(context.userId, contact.address);
        }
      }
    }

    if (!resolvedAddress) {
      // If recipient name was provided but not found as contact, ask
      if (recipient && !contactName) {
        return {
          message: `I couldn't find "${recipient}" in your contacts.\n\nEither:\n• Give me their wallet address\n• Or save them first: "Save contact ${recipient} as 0x..."\n\nWhat's the address for ${recipient}?`,
          intent,
        };
      }

      return {
        message: `I'll send $${amount} USDC. Who should I send it to?\n\nYou can give me:\n• A wallet address (0x...)\n• A contact name (if you've saved them)`,
        intent,
      };
    }

    // Validate address format and checksum
    const addressValidation = validateAddress(resolvedAddress);
    if (!addressValidation.isValid) {
      return {
        message: `That address doesn't look right. It should start with "0x" and be 42 characters long. Want to try again?`,
        intent,
      };
    }

    // Use normalized checksummed address
    const normalizedAddress = addressValidation.normalizedAddress || resolvedAddress;

    // Check for phishing URLs in the original message
    const phishingResult = detectPhishingUrls(intent.rawCommand);
    if (phishingResult.blocked) {
      return {
        message: `🚨 PHISHING DETECTED - TRANSACTION BLOCKED\n\nI detected suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\nReasons:\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis transaction has been blocked for your safety. Please verify the recipient address and never share your private keys or seed phrases.`,
        intent,
        requiresConfirmation: false,
      };
    }

    // Check if this is a new wallet address (not in transaction history)
    const isNewWallet = await this.checkIfNewWallet(normalizedAddress, context.walletId, context?.userId);

    // Calculate estimated fee (simplified)
    const estimatedFee = "0.01";

    // Calculate real risk score (include message for phishing detection)
    const riskResult = await calculateRiskScore(normalizedAddress, amount, undefined, intent.rawCommand, context?.userId);

    // Add phishing warning if detected but not blocked
    let phishingWarning = "";
    if (phishingResult.isPhishing && !phishingResult.blocked) {
      phishingWarning = `⚠️ PHISHING WARNING\n\nI detected potentially suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\nReasons:\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nPlease verify these URLs are legitimate before proceeding.\n\n`;
    }

    // If high risk, show warning but still allow user to approve/reject
    // Don't block - let user decide after seeing the risks
    let highRiskWarning = "";
    if (riskResult.blocked || riskResult.score >= 80) {
      highRiskWarning = `🚨 HIGH RISK TRANSACTION DETECTED\n\nRisk Score: ${riskResult.score}/100\n\nReasons:\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nWARNING: This transaction has been flagged as high risk. Please carefully verify the recipient address before proceeding. You can still approve this transaction if you're certain it's safe.\n\n`;
    }

    // Build risk message
    let riskMessage = "";
    if (riskResult.level === "high") {
      riskMessage = `⚠️ HIGH RISK (${riskResult.score}/100)`;
    } else if (riskResult.level === "medium") {
      riskMessage = `⚠️ MEDIUM RISK (${riskResult.score}/100)`;
    } else {
      riskMessage = `✅ LOW RISK (${riskResult.score}/100)`;
    }

    // Build base message with natural language
    let baseMessage = phishingWarning + highRiskWarning; // Add warnings first if present

    const recipientDisplay = contactName
      ? `${contactName} (${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)})`
      : `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}`;

    if (isNewWallet) {
      baseMessage += `Got it! I'm preparing to send $${amount} USDC to ${recipientDisplay}.\n\n⚠️ NEW WALLET ADDRESS DETECTED\n\nI noticed this address hasn't been used in your transaction history before. I'm being extra careful here because new addresses can sometimes be risky - it could be a typo or a new recipient. Please double-check this is the correct address before we proceed.\n\n`;
    } else {
      const familiarNote = contactName
        ? `I found ${contactName} in your contacts and I've sent to this address before, so it looks familiar.`
        : `I've sent to this address before, so it looks familiar.`;
      baseMessage += `Got it! I'm preparing to send $${amount} USDC to ${recipientDisplay}. ${familiarNote}\n\n`;
    }

    baseMessage += `${riskMessage}\n\nRisk Factors:\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nArc Benefits:\n• Gas paid in USDC (no ETH needed)\n• Sub-second transaction finality\n• Native USDC support\n\n`;

    // Add confirmation prompt based on whether it's a new wallet
    if (isNewWallet) {
      baseMessage += `This is a new wallet address. Do you want to proceed with this transaction?\n\nPlease confirm by saying "yes", "confirm", or "proceed" to continue, or "no", "cancel", or "stop" to abort.`;
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
        blocked: false, // Never block - always allow user to proceed after seeing warnings
        isNewWallet, // Add flag to indicate if this is a new wallet
      },
    };
  }

  /**
   * Check if an address is a new wallet (not in transaction history)
   */
  private static async checkIfNewWallet(
    address: string,
    walletId?: string,
    userId?: string
  ): Promise<boolean> {
    // Check address history from risk scoring
    if (!userId) return true; // Without userId, assume new wallet

    const { getAddressHistory } = await import("@/lib/security/risk-scoring");
    const addressHistory = await getAddressHistory(userId, address);

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

  private static async handleWalletCreationIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    // If wallet already exists, inform user
    if (context?.hasWallet) {
      const message = await this.enhanceResponse(
        "You already have a wallet! Your wallet address is ready to use. If you'd like to create a new one, just let me know.",
        intent,
        "wallet_already_exists",
        context
      );
      return { message, intent };
    }

    // Guide user through wallet creation with PIN explanation
    const message = await this.enhanceResponse(
      `Great! I'd love to help you set up your wallet.

Before we create your wallet, you'll need to set up a secure 6-digit PIN. Think of it like the PIN for your bank card - it's your personal key that keeps your wallet safe and secure.

**Why is a PIN important?**
Your PIN protects your wallet from unauthorized access. Just like you wouldn't want someone else using your bank card, your PIN ensures that only you can access and use your wallet. It's encrypted and stored securely - even I can't see it!

Once you're ready, I'll guide you through:
1. Setting up your secure PIN
2. Creating your wallet
3. Getting you started with your first transactions

Ready to get started? Just say "yes" or "let's do it" and I'll begin the setup process!`,
      intent,
      "wallet_creation_guidance",
      context
    );

    return { message, intent };
  }

  private static async handleBalanceIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "I'd love to check your balance! First, let's get your wallet set up. Before we create it, you'll need to set up a secure 6-digit PIN to protect it - think of it like the PIN for your bank card. Ready to get started?",
        intent,
        "balance_check_no_wallet",
        context
      );
      return { message, intent };
    }

    const balance = context.balance || "0.00";

    const message = await this.enhanceResponse(
      `Your balance is $${balance} USDC on Arc network.`,
      intent,
      "balance_check",
      context,
      { balance }
    );

    return { message, intent };
  }

  private static async handleTokensIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "You'll need a wallet first to check your tokens. Want me to create one for you?",
        intent,
      };
    }

    // Fetch all token balances
    const { getTokenBalances, formatTokensForAI } = await import("@/lib/tokens/token-balance");

    try {
      const tokenData = await getTokenBalances(context.walletId);

      if (!tokenData) {
        return {
          message: "Hmm, I'm having trouble fetching your token balances right now. Want to try again?",
          intent,
        };
      }

      const message = formatTokensForAI(tokenData.tokens, tokenData.totalValueUSD);

      return { message, intent };
    } catch (error: any) {
      console.error("[AI] Error fetching tokens:", error);
      return {
        message: "Oops, something went wrong while fetching your tokens. Let me try again...",
        intent,
      };
    }
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
      "You can view your transaction history in the transaction history panel on the right side of the screen. All your recent transactions on Arc network are displayed there.",
      intent,
      "fetch_history",
      context
    );

    return { message, intent };
  }

  private static async handleBridgeIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      return {
        message: "Hey! You'll need a wallet first to bridge assets across chains. Want me to help you set one up?",
        intent,
      };
    }

    const { amount, recipient: destinationChain, currency, address } = intent.entities;

    if (!amount) {
      return {
        message: "I can help you bridge USDC across chains!\n\nJust tell me:\n• How much to bridge\n• Which chain you're sending to\n\nExample: \"Bridge $50 to Ethereum\" or \"Bridge 100 USDC to Base\"",
        intent,
      };
    }

    if (!destinationChain) {
      return {
        message: `I'll bridge $${amount} USDC for you! Which chain should I send it to?\n\nYou can choose:\n• Ethereum\n• Base\n• Arbitrum\n• Optimism\n• Polygon\n• Avalanche\n\nJust say something like "Bridge to Base" and I'll handle the rest!`,
        intent,
      };
    }

    // If destination address is provided, prepare to execute bridge with Gateway deposit handling
    if (address && context.walletAddress && context.walletId) {
      // Check if user wants Fast Transfer (detect keywords like "fast", "instant", "quick")
      const lowerCommand = intent.rawCommand.toLowerCase();
      const wantsFast = lowerCommand.includes("fast") || lowerCommand.includes("instant") || lowerCommand.includes("quick") || lowerCommand.includes("asap");

      // Check if this is first-time bridge user (will need Gateway deposit)
      // The bridge API will handle auto-deposit, we just set expectations
      const speedInfo = wantsFast
        ? `Fast Transfer: Settles in seconds (~$0.25 fee)`
        : `Standard Transfer: 13-19 minutes (~$0.08 fee)`;

      const response: AIResponse = {
        message: `Perfect! Bridging $${amount} USDC from Arc to ${destinationChain}\n\n` +
          `${speedInfo}\n\n` +
          `Here's what's happening:\n` +
          `• If this is your first bridge, I'll set up instant bridging for you (takes a moment)\n` +
          `• Future bridges will be instant!\n• Destination: ${address.substring(0, 6)}...${address.substring(38)}\n\n` +
          `Ready to go?`,
        intent,
        requiresConfirmation: true,
        bridgeData: {
          amount,
          fromChain: "ARC-TESTNET",
          toChain: destinationChain.toUpperCase(),
          destinationAddress: address,
          walletId: context.walletId,
          walletAddress: context.walletAddress,
          fastTransfer: wantsFast, // Pass Fast Transfer preference
        },
      };

      if (sessionId) {
        await setPendingAction(sessionId, {
          type: "bridge",
          timestamp: Date.now(),
          data: {
            bridgeData: response.bridgeData,
            promptMessage: response.message,
            sourceIntent: intent,
          },
        }, context?.userId);
      }

      return response;
    }

    return {
      message: `Great! I'll bridge $${amount} USDC to ${destinationChain}.\n\n` +
        `Just need one more thing - what's the destination address on ${destinationChain}?\n\n` +
        `(Paste the address or say "my wallet" to use your same address on ${destinationChain})`,
      intent,
      requiresConfirmation: false,
    };
  }

  private static async handlePayIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
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
      const message = await this.enhanceResponse(
        "I'd be happy to help you make a payment! How much would you like to pay?",
        intent,
        "pay_missing_amount",
        context,
        undefined,
        sessionId,
        true,
        ["amount"]
      );
      return { message, intent };
    }

    // Check if recipient is a contact name (if no address provided)
    let resolvedAddress = address;
    let contactName: string | undefined;

    if (!address && recipient) {
      // Try to find contact by name
      if (typeof window !== "undefined") {
        const { getContactByName } = await import("@/lib/contacts/contact-service");
        const contact = getContactByName(recipient);
        if (contact) {
          resolvedAddress = contact.address;
          contactName = contact.name;
        }
      }
    }

    if (!resolvedAddress) {
      // If recipient name was provided but not found as contact, ask
      if (recipient && !contactName) {
        const message = await this.enhanceResponse(
          `I couldn't find "${recipient}" in your contacts. Would you like to:\n• Provide the wallet address directly\n• Save "${recipient}" as a new contact first\n\nWhat's the address for ${recipient}?`,
          intent,
          "pay_contact_not_found",
          context,
          { amount, recipient },
          sessionId,
          true,
          ["address"]
        );
        return { message, intent };
      }

      const message = await this.enhanceResponse(
        `I'll pay $${amount} USDC. Who would you like to pay? You can provide a wallet address or a contact name.`,
        intent,
        "pay_missing_address",
        context,
        { amount },
        sessionId,
        true,
        ["address", "recipient"]
      );
      return { message, intent };
    }

    // Validate address format and checksum
    const addressValidation = validateAddress(resolvedAddress);
    if (!addressValidation.isValid) {
      const message = await this.enhanceResponse(
        `That address doesn't look right. Could you double-check it? It should start with "0x" and be 42 characters long.`,
        intent,
        "pay_invalid_address",
        context,
        { amount, address: resolvedAddress },
        sessionId,
        true,
        ["address"]
      );
      return { message, intent };
    }

    // Use normalized checksummed address
    const normalizedAddress = addressValidation.normalizedAddress || resolvedAddress;

    // Update contact usage if it was found by name
    if (contactName && typeof window !== "undefined") {
      const { updateContactUsage } = await import("@/lib/contacts/contact-service");
      updateContactUsage(normalizedAddress);
    }

    // Check for phishing URLs in the original message
    const phishingResult = detectPhishingUrls(intent.rawCommand);
    if (phishingResult.blocked) {
      return {
        message: `🚨 PHISHING DETECTED - PAYMENT BLOCKED\n\nI detected suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\nReasons:\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nThis payment has been blocked for your safety. Please verify the recipient address and never share your private keys or seed phrases.`,
        intent,
        requiresConfirmation: false,
      };
    }

    // Check if this is a new wallet address (not in transaction history)
    const isNewWallet = await this.checkIfNewWallet(normalizedAddress, context.walletId, context?.userId);

    // Calculate estimated fee
    const estimatedFee = "0.01";

    // Calculate real risk score (include message for phishing detection)
    const riskResult = await calculateRiskScore(normalizedAddress, amount, undefined, intent.rawCommand, context?.userId);

    // Add phishing warning if detected but not blocked
    let phishingWarning = "";
    if (phishingResult.isPhishing && !phishingResult.blocked) {
      phishingWarning = `⚠️ PHISHING WARNING\n\nI detected potentially suspicious URLs in your message:\n${phishingResult.detectedUrls.map(url => `• ${url}`).join('\n')}\n\nReasons:\n${phishingResult.reasons.map(r => `• ${r}`).join('\n')}\n\nPlease verify these URLs are legitimate before proceeding.\n\n`;
    }

    // Don't block - show warning but allow user to proceed
    // Only block zero address (truly invalid)
    if (normalizedAddress === "0x0000000000000000000000000000000000000000") {
      return {
        message: `Invalid Address\n\nCannot send to zero address. Please provide a valid recipient address.`,
        intent,
        requiresConfirmation: false,
      };
    }

    // Build risk message
    let riskMessage = "";
    if (riskResult.level === "high") {
      riskMessage = `⚠️ HIGH RISK (${riskResult.score}/100)`;
    } else if (riskResult.level === "medium") {
      riskMessage = `MEDIUM RISK (${riskResult.score}/100)`;
    } else {
      riskMessage = `LOW RISK (${riskResult.score}/100)`;
    }

    // Build message with new wallet warning if applicable
    let message = phishingWarning; // Add phishing warning first if present
    message += `I'll pay $${amount} USDC to ${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}.\n\n`;

    // Add new wallet warning if this is a new address
    if (isNewWallet) {
      message += `⚠️ NEW WALLET ADDRESS DETECTED\n\nThis address hasn't been used in your transaction history before. Please verify this is the correct recipient address before proceeding.\n\n`;
    }

    message += `${riskMessage}\n\nRisk Factors:\n${riskResult.reasons.map(r => `• ${r}`).join('\n')}\n\n`;

    // Add confirmation prompt based on whether it's a new wallet
    if (isNewWallet) {
      message += `This is a new wallet address. Do you want to proceed with this payment?\n\nPlease confirm by saying "yes", "confirm", or "proceed" to continue, or "no", "cancel", or "stop" to abort.`;
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
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "You'll need a wallet first to earn yield. Want me to create one for you?",
        intent,
      };
    }

    const { amount } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    const { isUSYCAvailable, getAvailableBlockchains } = await import("@/lib/archived/legacy-dev-controlled/yield-savings-usyc");

    // Check available blockchains
    const availableChains = getAvailableBlockchains();
    const defaultChain = "ETH"; // USYC available on Ethereum

    // Determine action from command
    const isWithdraw = lowerCommand.includes("withdraw") || lowerCommand.includes("redeem");
    const isCheck = lowerCommand.includes("check") || lowerCommand.includes("balance") || lowerCommand.includes("status");

    if (isWithdraw) {
      // User wants to withdraw/redeem yield
      if (!amount) {
        return {
          message: `I'll help you withdraw your USYC and convert it back to USDC (including earned yield).\n\nHow much USYC would you like to redeem?`,
          intent,
        };
      }

      return {
        message: `I'll redeem $${amount} USYC and convert it to USDC. You'll receive your original amount plus any yield earned.\n\nShall I proceed?`,
        intent,
        requiresConfirmation: true,
      };
    } else if (isCheck) {
      // User wants to check yield position
      return {
        message: `Let me check your USYC position and yield earnings...\n\n(This would fetch your current USYC balance, initial investment, and earned yield)\n\nWant to deposit more or withdraw?`,
        intent,
      };
    } else {
      // User wants to deposit/subscribe to earn yield
      if (!amount) {
        return {
          message: `Great! Let's get you earning yield with USYC (Circle's yield token).\n\n💰 Current APY: ~5% (overnight federal funds rate)\nAvailable on: ${availableChains.join(", ")}\nBacked by US government securities\n\nHow much USDC would you like to deposit? (e.g., "$1000")`,
          intent,
        };
      }

      // Ready to deposit
      return {
        message: `Perfect! I'll deposit $${amount} USDC into USYC to start earning ~5% APY.\n\nYour funds will be:\n• Earning yield automatically\n• Backed by US government securities\n• Redeemable anytime 24/7\n\nShall I proceed with the deposit?`,
        intent,
        requiresConfirmation: true,
      };
    }
  }

  private static async handleArbitrageIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress) {
      return {
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    const minProfitMargin = amount ? parseFloat(amount) : 0.5; // Default 0.5% minimum

    const isExecute = lowerCommand.includes("execute") || lowerCommand.includes("run");

    if (isExecute) {
      return {
        message: `Ready to execute arbitrage! Make sure you have sufficient funds.\n\nI'll:\n1. Verify the opportunity still exists\n2. Calculate gas costs\n3. Execute if profitable\n\nShall I proceed?`,
        intent,
        requiresConfirmation: true,
      };
    } else {
      return {
        message: `I'll scan for arbitrage opportunities!\n\nScanning for:\n• Cross-chain price differences\n• DEX-to-DEX arbitrage\n• Minimum profit: ${minProfitMargin}%\n\nThis may take a moment...`,
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
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { recipient } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    const strategy = recipient || "balanced"; // Strategy name or default "balanced"

    const isAnalyze = lowerCommand.includes("analyze") || lowerCommand.includes("check");
    const isExecute = lowerCommand.includes("execute") || lowerCommand.includes("rebalance");

    if (isAnalyze) {
      return {
        message: `I'll analyze your portfolio and show what rebalancing actions are needed.\n\nStrategy: ${strategy}\n• Conservative: 70% USDC, 20% USDT, 10% WETH\n• Balanced: 50% USDC, 30% WETH, 20% USDT\n• Aggressive: 50% WETH, 30% USDC, 20% WBTC\n\nChecking your holdings...`,
        intent,
        requiresConfirmation: false,
      };
    } else if (isExecute) {
      return {
        message: `I'll rebalance your portfolio to match the ${strategy} strategy.\n\nI'll:\n1. Analyze current allocations\n2. Calculate required trades\n3. Execute trades to reach target\n\nShall I proceed?`,
        intent,
        requiresConfirmation: true,
      };
    }

    return {
      message: `I can rebalance your portfolio! Available strategies:\n• Conservative (low risk)\n• Balanced (medium risk)\n• Aggressive (higher returns)\n\nTry: "Rebalance my portfolio to balanced strategy" or "Analyze my portfolio"`,
      intent,
    };
  }

  private static async handleSplitPaymentIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount, recipient } = intent.entities;

    if (!amount) {
      return {
        message: `I can split a payment among multiple people! Tell me:\n• Total amount to split\n• Who should receive it\n• (Optional) Specific percentages\n\nExample: "Split $100 between Alice, Bob, and Charlie" or "Split $100: 50% Alice, 30% Bob, 20% Charlie"`,
        intent,
      };
    }

    // Parse recipients from rawCommand (look for multiple names/addresses)
    const recipientList: string[] = [];
    if (recipient) {
      if (recipient.includes(',')) {
        recipientList.push(...recipient.split(',').map((r: string) => r.trim()));
      } else {
        // Try to parse multiple recipients from command
        const words = intent.rawCommand.split(/\s+/);
        let foundRecipients = false;
        for (let i = 0; i < words.length; i++) {
          if (words[i].toLowerCase() === 'between' || words[i].toLowerCase() === 'among') {
            // Get remaining words as potential recipients
            const remaining = words.slice(i + 1).join(' ');
            const potential = remaining.split(/,| and /).map(r => r.trim()).filter(r => r);
            if (potential.length > 1) {
              recipientList.push(...potential);
              foundRecipients = true;
              break;
            }
          }
        }
        if (!foundRecipients) {
          recipientList.push(recipient);
        }
      }
    }

    if (recipientList.length === 0) {
      return {
        message: `I need to know who to split the $${amount} with. Example: "Split $100 between Alice and Bob"`,
        intent,
      };
    }

    if (recipientList.length === 1) {
      return {
        message: `Splitting between 1 person is just sending! Try: "Send $${amount} to ${recipientList[0]}"`,
        intent,
      };
    }

    if (recipientList.length > 50) {
      return {
        message: `Split payment limit is 50 recipients. You provided ${recipientList.length}.`,
        intent,
      };
    }

    // Even split by default
    const perPerson = (parseFloat(amount) / recipientList.length).toFixed(2);
    const percentage = (100 / recipientList.length).toFixed(1);

    return {
      message: `Perfect! I'll split $${amount} USDC evenly among ${recipientList.length} people.\n\nEach person gets: $${perPerson} USDC (${percentage}%)\n\nRecipients:\n${recipientList.map((r, i) => `${i + 1}. ${r} - $${perPerson}`).join("\n")}\n\nAll in one transaction!\n\nShall I proceed?`,
      intent,
      requiresConfirmation: true,
    };
  }

  private static async handleBatchIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount, recipient } = intent.entities;

    if (!recipient) {
      return {
        message: `I can batch send USDC to multiple people at once (saves ~33% on gas!).\n\nJust tell me:\n• How much to send to each person\n• The addresses or contact names\n\nExample: "Send $10 to Alice, Bob, and Charlie"`,
        intent,
      };
    }

    // Parse recipients from rawCommand (look for multiple names/addresses)
    const recipientList: string[] = [];
    if (recipient.includes(',')) {
      recipientList.push(...recipient.split(',').map((r: string) => r.trim()));
    } else {
      // Try to parse multiple recipients from command
      const words = intent.rawCommand.split(/\s+/);
      let foundRecipients = false;
      for (let i = 0; i < words.length; i++) {
        if (words[i].toLowerCase() === 'to') {
          // Get remaining words as potential recipients
          const remaining = words.slice(i + 1).join(' ');
          const potential = remaining.split(/,| and /).map(r => r.trim()).filter(r => r);
          if (potential.length > 1) {
            recipientList.push(...potential);
            foundRecipients = true;
            break;
          }
        }
      }
      if (!foundRecipients) {
        recipientList.push(recipient);
      }
    }

    if (recipientList.length === 0) {
      return {
        message: `I need the recipient addresses or contact names to batch send. Try: "Send $50 to 0x123..., 0x456..."`,
        intent,
      };
    }

    if (recipientList.length === 1) {
      return {
        message: `For just one recipient, a regular send is better! Try: "Send $${amount || "50"} to ${recipientList[0]}"`,
        intent,
      };
    }

    if (recipientList.length > 50) {
      return {
        message: `Batch limit is 50 recipients. You provided ${recipientList.length}. Please reduce the list.`,
        intent,
      };
    }

    if (!amount) {
      return {
        message: `Great! I'll batch send to ${recipientList.length} people.\n\nHow much USDC should each person receive?`,
        intent,
      };
    }

    const totalAmount = (parseFloat(amount) * recipientList.length).toFixed(2);

    return {
      message: `Perfect! I'll batch send $${amount} USDC to ${recipientList.length} recipients.\n\n💰 Total: $${totalAmount} USDC\nGas savings: ~33% vs individual sends\n\nRecipients:\n${recipientList.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nShall I proceed?`,
      intent,
      requiresConfirmation: true,
    };
  }

  private static async handleSavingsIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletId) {
      return {
        message: "You'll need a wallet first to start saving. Want me to create one?",
        intent,
      };
    }

    const { amount, recipient, time } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();

    // Detect action type
    const isGoal = lowerCommand.includes("save for") || lowerCommand.includes("goal");
    const isSafeLock = lowerCommand.includes("lock") || lowerCommand.includes("safelock");
    const isList = lowerCommand.includes("list") || lowerCommand.includes("show") || lowerCommand.includes("my savings");
    const isBreak = lowerCommand.includes("break") || lowerCommand.includes("withdraw") || lowerCommand.includes("cancel");
    const isCompare = lowerCommand.includes("compare") || lowerCommand.includes("difference");

    // Compare savings vs yield
    if (isCompare) {
      return {
        message: `💰 Savings vs Yield - What's the difference?\n\n` +
          `**Savings** (Goal-based & Disciplined):\n` +
          `• Save for specific goals (house, car, etc.)\n` +
          `• Higher APY (8-15%)\n` +
          `• Builds discipline with lock periods\n` +
          `• Penalty (3-10%) if withdrawn early\n` +
          `Best for: Planned expenses, goals\n\n` +
          `**Yield** (Flexible Investment):\n` +
          `• Earn passive income (5-7% APY)\n` +
          `• Withdraw anytime, no penalty\n` +
          `• No commitments\n` +
          `• Lower returns\n` +
          `Best for: Emergency funds, flexibility\n\n` +
          `Which would you like to start?`,
        intent,
      };
    }

    // List savings
    if (isList) {
      return {
        message: `Let me show your savings...\n\n(Fetching your goals and SafeLocks...)`,
        intent,
      };
    }

    // Break savings early
    if (isBreak) {
      if (!amount && !recipient) {
        return {
          message: `Which savings would you like to withdraw from?\n\nJust say the goal name or "show my savings" to see all.`,
          intent,
        };
      }

      return {
        message: `⚠️ Early Withdrawal Warning\n\nBreaking your savings early will incur a penalty (3-10% depending on progress).\n\nYou'll receive:\n• Your principal (minus penalty)\n• Earned yield so far\n\nAre you sure you want to withdraw early?`,
        intent,
        requiresConfirmation: true,
      };
    }

    // Create goal-based savings
    if (isGoal) {
      const goalName = recipient || "My Goal";

      if (!amount) {
        return {
          message: `Great! Let's create a savings goal for "${goalName}"\n\nHow much do you want to save?`,
          intent,
        };
      }

      // Ask for lock period if not specified
      if (!time) {
        return {
          message: `Perfect! Saving $${amount} for "${goalName}".\n\nHow long would you like to save? Choose:\n• 1 month → 8% APY\n• 3 months → 10% APY\n• 6 months → 12% APY\n• 1 year → 15% APY\n\n⚠️ Early withdrawal = 3-10% penalty`,
          intent,
        };
      }

      return {
        message: `Ready to create your savings goal!\n\n` +
          `Goal: ${goalName}\n` +
          `💰 Amount: $${amount}\n` +
          `Period: ${time}\n` +
          `APY: ~10-12%\n` +
          `⚠️ Early withdrawal penalty applies\n\n` +
          `Shall I create this savings goal?`,
        intent,
        requiresConfirmation: true,
      };
    }

    // SafeLock (fixed deposit)
    if (isSafeLock) {
      if (!amount) {
        const { formatAvailableLockPeriods } = await import("@/lib/defi/safelock");
        const periods = formatAvailableLockPeriods();

        return {
          message: `🔒 SafeLock - Lock your funds for guaranteed high returns!\n\n` +
            `${periods}\n\n` +
            `How much would you like to lock?`,
          intent,
        };
      }

      if (!time) {
        return {
          message: `Great! I'll SafeLock $${amount}.\n\nChoose your lock period:\n` +
            `• 2 weeks → 7% APY\n` +
            `• 1 month → 8% APY\n` +
            `• 3 months → 10% APY\n` +
            `• 6 months → 12% APY\n` +
            `• 1 year → 15% APY\n\n` +
            `⚠️ Early withdrawal penalties apply (decrease over time)`,
          intent,
        };
      }

      return {
        message: `🔒 SafeLock Confirmation\n\n` +
          `Amount: $${amount}\n` +
          `Period: ${time}\n` +
          `APY: ~10-12%\n` +
          `At Maturity: ~$${(parseFloat(amount) * 1.1).toFixed(2)}\n\n` +
          `⚠️ Funds will be locked. Early withdrawal = penalty.\n` +
          `At maturity: Full amount + yield, no penalty\n\n` +
          `Shall I create this SafeLock?`,
        intent,
        requiresConfirmation: true,
      };
    }

    // General savings help
    return {
      message: `💰 Start Saving with Arcle!\n\n` +
        `Choose your savings type:\n\n` +
        `**1. Goal-Based Savings**\n` +
        `"Save $5000 for a house"\n` +
        `• Set specific goals\n` +
        `• Optional recurring contributions\n` +
        `• 8-15% APY\n\n` +
        `**2. SafeLock**\n` +
        `"Lock $1000 for 3 months"\n` +
        `• Fixed deposits\n` +
        `• Guaranteed returns\n` +
        `• 7-15% APY\n\n` +
        `⚠️ Both have penalties for early withdrawal\n` +
        `Want flexible? Try "Start earning yield" instead!\n\n` +
        `What would you like to do?`,
      intent,
    };
  }

  private static async handleTradeIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount, currency, recipient } = intent.entities;
    const fromToken = currency || "USDC";
    const toToken = recipient || (currency === "USDC" ? "WETH" : "USDC");

    if (!amount) {
      return {
        message: `I can swap tokens for you on Uniswap!\n\nSupported chains: Ethereum, Base, Arbitrum, Polygon, Avalanche\n\nJust tell me:\n• How much to swap\n• From which token\n• To which token\n\nExample: "Trade 100 USDC for ETH" or "Swap 1 ETH for USDC"`,
        intent,
      };
    }

    const { isTradingAvailable } = await import("@/lib/archived/legacy-dev-controlled/token-trading-dex");
    const defaultChain = "ETH";

    if (!isTradingAvailable(defaultChain)) {
      return {
        message: `Trading not available on ${defaultChain} yet. Try Ethereum, Base, or Arbitrum.`,
        intent,
      };
    }

    return {
      message: `Great! I'll swap $${amount} ${fromToken} for ${toToken} on Uniswap.\n\nSettings:\n• Slippage tolerance: 0.5%\n• Route: ${fromToken} → ${toToken}\n• DEX: Uniswap V2\n\nI'll show you a quote before executing. Shall I proceed?`,
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
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount, currency, recipient } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();

    const isList = lowerCommand.includes("list") || lowerCommand.includes("show");
    const isCancel = lowerCommand.includes("cancel");

    if (isList) {
      return {
        message: `Let me show your limit orders...\n\n(Fetching pending orders...)`,
        intent,
        requiresConfirmation: false,
      };
    } else if (isCancel) {
      return {
        message: `Which limit order would you like to cancel? You can say the order number or "cancel all"`,
        intent,
      };
    }

    // Creating a new limit order
    const fromToken = currency || "USDC";
    const toToken = recipient || "WETH";
    const targetPrice = amount;

    if (!targetPrice) {
      return {
        message: `I can create limit orders that execute automatically when your target price is reached!\n\nExample: "Buy 1 ETH at $2400" or "Create limit sell order for ETH at $2600"\n\nWhat's your target price?`,
        intent,
      };
    }

    return {
      message: `Perfect! I'll create a limit order:\n\nOrder Details:\n• Type: Buy\n• From: ${fromToken}\n• To: ${toToken}\n• Target Price: $${targetPrice}\n• Expiry: 7 days\n\nI'll monitor prices and execute automatically when reached. Shall I create this order?`,
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
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { amount, currency, recipient } = intent.entities;
    const fromToken = currency || "USDC";
    const toToken = recipient || "WETH";

    if (!amount) {
      return {
        message: `I'll find the best liquidity across 10+ DEXs and multiple chains!\n\nSupported DEXs:\n• Uniswap V2 & V3\n• Sushiswap\n• Curve\n• Balancer\n• And more...\n\nHow much would you like to trade? (larger amounts benefit more from aggregation)`,
        intent,
      };
    }

    return {
      message: `Perfect! I'll aggregate liquidity for your trade:\n\nScanning:\n• Amount: $${amount} ${fromToken}\n• To: ${toToken}\n• Across: Ethereum, Base, Arbitrum, Polygon, Avalanche\n• DEXs: 10+ liquidity sources\n\nI'll find the best price and route. This may take a moment...`,
      intent,
      requiresConfirmation: false,
    };
  }

  private static async handleCompoundIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string }
  ): Promise<AIResponse> {
    if (!context?.hasWallet || !context?.walletAddress || !context?.walletId) {
      return {
        message: "You'll need a wallet first. Want me to create one?",
        intent,
      };
    }

    const { time } = intent.entities;
    const lowerCommand = intent.rawCommand.toLowerCase();
    const frequency = time || "weekly"; // daily, weekly, monthly

    const isEnable = lowerCommand.includes("enable") || lowerCommand.includes("start") || lowerCommand.includes("create") || lowerCommand.includes("set up");
    const isDisable = lowerCommand.includes("disable") || lowerCommand.includes("stop");
    const isCheck = lowerCommand.includes("check") || lowerCommand.includes("status") || lowerCommand.includes("history");

    if (isEnable) {
      return {
        message: `I'll set up auto-compounding for your USYC yield!\n\nSettings:\n• Frequency: ${frequency}\n• Minimum yield: $10\n• Reinvest: 100%\n\nYour yield will automatically reinvest to maximize returns. Shall I enable it?`,
        intent,
        requiresConfirmation: true,
      };
    } else if (isDisable) {
      return {
        message: `I'll disable auto-compounding. Your yield will still earn but won't automatically reinvest.`,
        intent,
        requiresConfirmation: true,
      };
    } else if (isCheck) {
      return {
        message: `Let me check your auto-compound status and history...\n\n(Fetching compound history...)`,
        intent,
        requiresConfirmation: false,
      };
    }

    return {
      message: `I can set up automatic compounding for your yield!\n\nOptions:\n• "Enable weekly auto-compound"\n• "Set up daily compounding"\n• "Check compound status"\n• "Disable auto-compound"\n\nWhat would you like to do?`,
      intent,
    };
  }

  private static async handleConvertIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
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
          message: `Conversion failed: ${result.error || "Unknown error"}`,
          intent,
        };
      }

      const { convertedAmount, rate } = result;

      // Store pending action for confirmation
      if (sessionId && context?.walletId) {
        await setPendingAction(sessionId, {
          type: "convert",
          data: {
            fromCurrency,
            toCurrency,
            amount,
            convertedAmount,
            rate,
            currency: fromCurrency,
            recipient: toCurrency,
          },
          timestamp: Date.now(),
        }, context?.userId);
      }

      const message = await this.enhanceResponse(
        `Currency Conversion Preview\n\nFrom: ${amount} ${fromCurrency}\nTo: ~${convertedAmount} ${toCurrency}\nRate: 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}\n\nReady to convert? This will execute a swap transaction.`,
        intent,
        "currency_conversion",
        context,
        {
          fromCurrency,
          toCurrency,
          amount,
          convertedAmount,
          rate,
        },
        sessionId
      );

      return {
        message,
        intent,
        requiresConfirmation: true,
      };
    } catch (error) {
      return {
        message: `Error fetching conversion rate: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent,
      };
    }
  }

  /**
   * Execute FX swap transaction
   */
  private static async executeFXSwap(
    swapData: any,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (!context?.walletId || !context?.walletAddress) {
      return {
        message: "Wallet not found. Please create a wallet first.",
        intent: { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
      };
    }

    const { fromCurrency, toCurrency, amount } = swapData;

    if (!fromCurrency || !toCurrency || !amount) {
      return {
        message: "Missing conversion details. Please try again.",
        intent: { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
      };
    }

    try {
      // Import FX swap execution service (archived - legacy implementation)
      const { executeFXSwap } = await import("@/lib/archived/legacy-dev-controlled/fx-swap-execution");

      // Execute the swap
      const result = await executeFXSwap({
        walletId: context.walletId,
        walletAddress: context.walletAddress,
        fromCurrency: fromCurrency as any,
        toCurrency: toCurrency as any,
        amount: amount.toString(),
      });

      if (!result.success) {
        return {
          message: `FX swap failed: ${result.error || "Unknown error"}`,
          intent: { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
        };
      }

      // Generate success message with transaction details
      // Only generate explorer link if blockchainHash is a valid hash (0x followed by 64 hex chars)
      const isValidHash = result.blockchainHash && /^0x[a-fA-F0-9]{64}$/.test(result.blockchainHash);
      const explorerLink = isValidHash
        ? `[View on ArcScan](https://testnet.arcscan.app/tx/${result.blockchainHash})`
        : "";

      const message = await this.enhanceResponse(
        `FX Swap Executed Successfully!\n\n` +
        `From: ${result.fromAmount} ${result.fromCurrency}\n` +
        `To: ${result.toAmount} ${result.toCurrency}\n` +
        `Rate: 1 ${result.fromCurrency} = ${result.rate.toFixed(6)} ${result.toCurrency}\n` +
        `Transaction ID: ${result.transactionId}\n` +
        (explorerLink ? `\n${explorerLink}` : ""),
        { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
        "fx_swap_executed",
        context,
        {
          transactionId: result.transactionId,
          blockchainHash: result.blockchainHash,
          fromCurrency: result.fromCurrency,
          toCurrency: result.toCurrency,
          fromAmount: result.fromAmount,
          toAmount: result.toAmount,
          rate: result.rate,
        },
        sessionId
      );

      return {
        message,
        intent: { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
        requiresConfirmation: false,
      };
    } catch (error) {
      console.error("FX swap execution error:", error);
      return {
        message: `Error executing FX swap: ${error instanceof Error ? error.message : "Unknown error"}`,
        intent: { intent: "convert", confidence: 1, entities: {}, rawCommand: "" },
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
          message: `Could not fetch exchange rate: ${result.error || "Unknown error"}`,
          intent,
        };
      }

      const { rate, source, timestamp } = result.rate;
      const rateDate = new Date(timestamp).toLocaleString();

      const message = await this.enhanceResponse(
        `Exchange Rate\n\n${fromCurrency} → ${toCurrency}\nRate: 1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}\nSource: ${source}\nUpdated: ${rateDate}`,
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
        message: `Error fetching exchange rate: ${error instanceof Error ? error.message : "Unknown error"}`,
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

      let message = `Your Currency Balances\n\n`;

      for (const balance of balances) {
        message += `${balance.currency}: ${balance.amount} ${balance.currency}\n`;
      }

      message += `\nTotal Value: ~$${totalValueUSD} USD\n\n`;
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
        message: `Error fetching currency balances: ${error instanceof Error ? error.message : "Unknown error"}`,
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

        let message = `📄 Your Invoices\n\n`;
        for (const invoice of invoices.slice(0, 10)) {
          const dueDate = new Date(invoice.dueDate).toLocaleDateString();
          message += `${invoice.invoiceNumber} - ${invoice.recipient}\n`;
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
          message: `Error fetching invoices: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        `Invoice Created!\n\nInvoice #: ${invoice.invoiceNumber}\nRecipient: ${invoice.recipient}\nAmount: ${invoice.amount} ${invoice.currency}\nDue Date: ${new Date(invoice.dueDate).toLocaleDateString()}\nStatus: ${invoice.status}\n\nI'll remind you before it's due!`,
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
        message: `Error creating invoice: ${error instanceof Error ? error.message : "Unknown error"}`,
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

        let message = `Your Payment Rolls\n\n`;
        for (const roll of rolls) {
          const nextDate = new Date(roll.nextPaymentDate).toLocaleDateString();
          message += `${roll.name}\n`;
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
          message: `Error fetching payment rolls: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        `Payment Roll Created!\n\nName: ${roll.name}\nFrequency: ${roll.frequency}\nTotal Amount: ${roll.totalAmount} ${roll.currency}\nRecipients: ${roll.recipients.length}\nNext Payment: ${new Date(roll.nextPaymentDate).toLocaleDateString()}\n\nI'll process payments automatically on the scheduled dates!`,
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
        message: `Error creating payment roll: ${error instanceof Error ? error.message : "Unknown error"}`,
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

        let message = `🌍 Your Remittances\n\n`;
        for (const rem of remittances.slice(0, 10)) {
          const date = new Date(rem.createdAt).toLocaleDateString();
          message += `${rem.remittanceNumber} - ${rem.recipientName}\n`;
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
          message: `Error fetching remittances: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        `Remittance Created!\n\nRemittance #: ${remittance.remittanceNumber}\nRecipient: ${remittance.recipientName}\nCountry: ${remittance.recipientCountry}\nAmount: ${remittance.amount} USDC\nConverted: ${remittance.convertedAmount} ${remittance.recipientCurrency}\nExchange Rate: 1 USDC = ${remittance.exchangeRate.toFixed(6)} ${remittance.recipientCurrency}\nFee: ${remittance.fee} USDC\nTotal: ${remittance.totalAmount} USDC\n\nReady to send?`,
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
        message: `Error creating remittance: ${error instanceof Error ? error.message : "Unknown error"}`,
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

        let message = `🔔 Your FX Rate Alerts\n\n`;
        for (const alert of alerts) {
          message += `${alert.pair} ${alert.direction} ${alert.targetRate}\n`;
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
          message: `Error fetching alerts: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        `FX Rate Alert Created!\n\nPair: ${alert.pair}\nAlert: ${alert.direction} ${alert.targetRate}\nStatus: ${alert.status}\n\nI'll notify you when the rate ${alert.direction} ${alert.targetRate}!`,
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
        message: `Error creating alert: ${error instanceof Error ? error.message : "Unknown error"}`,
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

        let message = `Your Perpetual Positions\n\n`;
        for (const pos of positions) {
          message += `${pos.pair} ${pos.side.toUpperCase()}\n`;
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
          message: `Error fetching positions: ${error instanceof Error ? error.message : "Unknown error"}`,
          intent,
        };
      }
    }

    // Open position
    if (!side || !amount) {
      return {
        message: "⚠️ High Risk Warning\n\nTo open a perpetual position, please provide:\n• Side (long or short)\n• Size/Amount\n• Leverage (e.g., 10x)\n• Margin\n\nExample: 'Open 10x long on USDC/EURC with $1,000'\n\n⚠️ Leveraged trading is high risk. Only trade what you can afford to lose!",
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
        `⚠️ Perpetual Position Opened\n\nPair: ${position.pair}\nSide: ${position.side.toUpperCase()}\nSize: ${position.size}\nLeverage: ${position.leverage}x\nEntry Price: ${position.entryPrice}\nLiquidation Price: ${position.liquidationPrice}\nMargin: ${position.margin}\n\n⚠️ Monitor your position closely! If price reaches ${position.liquidationPrice}, you will be liquidated.`,
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
          let message = `🤖 Agent Marketplace\n\n`;
          for (const agent of marketplace) {
            message += `${agent.name}\n`;
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

        let message = `🤖 Your AI Agents\n\n`;
        for (const agent of agents) {
          message += `${agent.name}\n`;
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
        `✅ AI Agent Created!\n\nName: ${agent.name}\nStatus: ${agent.status}\nPermissions: ${agent.permissions.length} action(s)\n\nYour agent is now active and will execute actions automatically based on its permissions!`,
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
      message: `💸 Withdraw to fiat\n\nOff-ramp is not available in this testnet build. I can help you send USDC on Arc or bridge to another chain.`,
      intent,
      requiresConfirmation: false,
    };
  }

  private static async handleScanIntent(
    intent: ParsedIntent,
    context?: { walletAddress?: string; userId?: string }
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
    const { score, reasons, blocked } = await calculateRiskScore(address, "0.00", undefined, undefined, context?.userId || undefined);
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
    context?: AIContext,
    sessionId?: string,
    conversationContext?: ConversationContext
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

    if (!context.walletId || !context.userId) {
      const message = await this.enhanceResponse(
        "I couldn't find your wallet details. Please reconnect your wallet or create one so I can schedule the payment.",
        intent,
        "schedule_missing_wallet_context",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }

    const draft =
      conversationContext?.pendingAction?.type === "schedule"
        ? conversationContext.pendingAction.data || {}
        : {};

    let amount = intent.entities.amount ?? draft.amount;
    let addressInput = intent.entities.address ?? draft.address;
    let dateInput =
      typeof intent.entities.date === "string" && intent.entities.date.trim().length
        ? intent.entities.date.trim()
        : draft.date;
    let timeInput =
      typeof intent.entities.time === "string" && intent.entities.time.trim().length
        ? intent.entities.time.trim()
        : draft.time;

    if (!amount) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: addressInput, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        "I'd be happy to schedule that payment. How much would you like to send?",
        intent,
        "schedule_missing_amount",
        context,
        { address: addressInput },
        sessionId,
        true,
        ["amount"]
      );
      return { message, intent };
    }

    if (!addressInput) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: addressInput, date: dateInput, time: timeInput });
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

    const addressValidation = validateAddress(addressInput);
    if (!addressValidation.isValid) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: addressInput, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `Hmm, that address doesn't look quite right. Could you double-check the wallet address? It should start with "0x" and be 42 characters long.`,
        intent,
        "schedule_invalid_address",
        context,
        { amount, address: addressInput },
        sessionId,
        true,
        ["address"]
      );
      return { message, intent };
    }

    const normalizedAddress = addressValidation.normalizedAddress || addressInput;
    const shortAddress =
      normalizedAddress.length > 10
        ? `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`
        : normalizedAddress;

    if (!dateInput) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: normalizedAddress, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `Almost there! What exact day should I send the $${amount} payment to ${shortAddress}? You can say something like "July 12" or "next Monday".`,
        intent,
        "schedule_missing_date",
        context,
        { amount, address: normalizedAddress },
        sessionId,
        true,
        ["date"]
      );
      return { message, intent };
    }

    if (!timeInput) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: normalizedAddress, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `Great. And what time on ${dateInput} should it run? For example: "3:00 pm" or "09:30".`,
        intent,
        "schedule_missing_time",
        context,
        { amount, address: normalizedAddress, date: dateInput },
        sessionId,
        true,
        ["time"]
      );
      return { message, intent };
    }

    const scheduledTimestamp = parseScheduleTime(dateInput, timeInput);
    if (!scheduledTimestamp) {
      await this.persistScheduleDraft(sessionId, context, { amount, address: normalizedAddress, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `I couldn't interpret "${dateInput} at ${timeInput}". Could you rephrase the date and time?`,
        intent,
        "schedule_invalid_time",
        context,
        { amount, address: normalizedAddress },
        sessionId,
        true,
        ["date", "time"]
      );
      return { message, intent };
    }

    await this.clearScheduleDraft(sessionId, context);

    if (typeof window !== "undefined") {
      const scheduledPayment = await createScheduledPayment({
        userId: context.userId,
        walletId: context.walletId,
        amount,
        currency: "USDC",
        to: normalizedAddress,
        scheduledFor: scheduledTimestamp,
      });

      const formattedDate = new Date(scheduledTimestamp).toLocaleString();
      const baseMessage = `✅ Payment Scheduled!\n\nI've scheduled a payment of $${amount} USDC to ${shortAddress}.\n\nScheduled for: ${formattedDate}\n\nI'll automatically execute this payment at ${formattedDate}. You can cancel it anytime before then.`;

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
      context,
      {
        amount,
        address: normalizedAddress,
        scheduledFor: new Date(scheduledTimestamp).toLocaleString(),
      },
      sessionId
    );

    return { message, intent };
  }

  private static async handleSubscriptionIntent(
    intent: ParsedIntent,
    context?: AIContext,
    sessionId?: string,
    conversationContext?: ConversationContext
  ): Promise<AIResponse> {
    if (!context?.hasWallet) {
      const message = await this.enhanceResponse(
        "Please create a wallet first to set up subscriptions.",
        intent,
        "subscription_no_wallet",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }

    if (!context.walletId || !context.userId) {
      const message = await this.enhanceResponse(
        "I need your wallet connected before setting up a subscription. Please reconnect your wallet or create one first.",
        intent,
        "subscription_missing_wallet",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }

    const draft =
      conversationContext?.pendingAction?.type === "subscription"
        ? conversationContext.pendingAction.data || {}
        : {};

    let amount = intent.entities.amount ?? draft.amount;
    let merchant = (intent.entities as any).merchant ?? draft.merchant;
    let frequency = (intent.entities as any).frequency ?? draft.frequency ?? "monthly";
    let dateInput =
      typeof intent.entities.date === "string" && intent.entities.date.trim().length
        ? intent.entities.date.trim()
        : draft.date;
    let timeInput =
      typeof intent.entities.time === "string" && intent.entities.time.trim().length
        ? intent.entities.time.trim()
        : draft.time;

    if (!amount) {
      await this.persistSubscriptionDraft(sessionId, context, { amount, merchant, frequency, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        "How much should I charge each cycle?",
        intent,
        "subscription_missing_amount",
        context,
        { merchant },
        sessionId,
        true,
        ["amount"]
      );
      return { message, intent };
    }

    if (!merchant) {
      await this.persistSubscriptionDraft(sessionId, context, { amount, merchant, frequency, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        "Who is this subscription for? (e.g., Netflix, rent, payroll)",
        intent,
        "subscription_missing_merchant",
        context,
        { amount },
        sessionId,
        true,
        ["merchant"]
      );
      return { message, intent };
    }

    if (!dateInput) {
      await this.persistSubscriptionDraft(sessionId, context, { amount, merchant, frequency, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `When should the first ${frequency} charge run?`,
        intent,
        "subscription_missing_start_date",
        context,
        { amount, merchant, frequency },
        sessionId,
        true,
        ["date"]
      );
      return { message, intent };
    }

    if (!timeInput) {
      await this.persistSubscriptionDraft(sessionId, context, { amount, merchant, frequency, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `And what time on ${dateInput} should it run?`,
        intent,
        "subscription_missing_time",
        context,
        { amount, merchant, frequency, date: dateInput },
        sessionId,
        true,
        ["time"]
      );
      return { message, intent };
    }

    const nextChargeAt = parseScheduleTime(dateInput, timeInput);
    if (!nextChargeAt) {
      await this.persistSubscriptionDraft(sessionId, context, { amount, merchant, frequency, date: dateInput, time: timeInput });
      const message = await this.enhanceResponse(
        `I couldn't interpret "${dateInput} at ${timeInput}". Could you rephrase the start date and time?`,
        intent,
        "subscription_invalid_time",
        context,
        { amount, merchant, frequency },
        sessionId,
        true,
        ["date", "time"]
      );
      return { message, intent };
    }

    await this.clearSubscriptionDraft(sessionId, context);

    if (typeof window !== "undefined") {
      const subscription = await addSubscription({
        userId: context.userId,
        walletId: context.walletId,
        merchant,
        amount,
        currency: "USDC",
        frequency,
        nextChargeAt,
        autoRenew: true,
        remindBeforeMs: 2 * 24 * 60 * 60 * 1000,
        paused: false,
      });

      const nextChargeDate = new Date(subscription.nextChargeAt).toLocaleString();

      const baseMessage = `✅ Subscription Created!\n\n${merchant}\nAmount: $${amount} USDC\nFrequency: ${frequency}\nNext charge: ${nextChargeDate}\n\nI'll remind you 2 days before each charge and auto-pay it for you.`;

      const message = await this.enhanceResponse(
        baseMessage,
        intent,
        "subscription_created",
        context,
        {
          merchant,
          amount,
          frequency,
          nextChargeDate,
          subscriptionId: subscription.id,
        },
        sessionId
      );

      return { message, intent };
    }

    const message = await this.enhanceResponse(
      `Subscription created for ${merchant}: $${amount} USDC, ${frequency}. You'll be reminded 2 days before renewal.`,
      intent,
      "subscription_created",
      context,
      { merchant, amount, frequency },
      sessionId
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

  /**
   * Handle location sharing intent
   */
  private static async handleLocationIntent(
    intent: ParsedIntent,
    context?: AIContext,
    sessionId?: string
  ): Promise<AIResponse> {
    const coordinates = intent.entities.address;
    const isDelivery = intent.entities.recipient === "delivery";

    // Generate response based on context
    let message = "";

    if (isDelivery || intent.rawCommand.toLowerCase().includes("delivery") || intent.rawCommand.toLowerCase().includes("order")) {
      // Delivery context
      message = "Got it, I've saved your location for delivery tracking. What's your order number?";
    } else if (intent.rawCommand.toLowerCase().includes("dispatcher") || intent.rawCommand.toLowerCase().includes("driver")) {
      // Dispatcher context
      message = "Location updated. I'll share this with the delivery team.";
    } else {
      // No clear context - ask what they need
      message = "I see you've shared your location. Is this for a delivery, or something else?";
    }

    // Enhance with AI if coordinates are present
    if (coordinates) {
      const enhanced = await this.enhanceResponse(
        message,
        intent,
        "location_shared",
        context,
        { coordinates, isDelivery },
        sessionId
      );
      return { message: enhanced, intent };
    }

    return { message, intent };
  }

  private static async handleHelpIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string }
  ): Promise<AIResponse> {
    const helpMessage = `I'm your AI wallet assistant on ARCLE! I can help you with:

Basic Operations:
• Check your balance
• Send and receive USDC
• Make payments
• View your wallet address
• View transaction history

Multi-Currency & FX:
• View all currency balances (USDC, EURC)
• Convert between currencies (e.g., "Convert 100 USDC to EURC")
• Check exchange rates (e.g., "What's the USDC to EURC rate?")
• Multi-currency payments

Invoice & Payment Management:
• Create invoices (e.g., "Create invoice for $5,000 to Acme Corp, due in 30 days")
• View outstanding and overdue invoices
• Set up payment rolls for automated payroll (e.g., "Set up payroll: Pay Jake $3,000, Sarah $4,000 monthly")
• Track invoice payments and status

Cross-Border Payments:
• Send international remittances (e.g., "Send $500 to my mom in Mexico")
• View remittance history
• FX rate alerts (e.g., "Notify me when USDC/EURC hits 0.95")
• Historical FX rate data

Advanced Trading:
• Perpetual contracts (e.g., "Open 10x long on USDC/EURC with $1,000")
• Options trading (coming soon)
• Margin trading with leverage
• Stop loss and take profit orders

AI Agents & Automation:
• Create autonomous AI agents (e.g., "Create an agent to pay invoices under $500 automatically")
• Agent marketplace with pre-built agents
• Agent-to-agent payments
• Smart contract automation

Cross-Chain Operations:
• Bridge assets across chains (Ethereum, Base, Arbitrum, Optimism, Polygon, Avalanche)
• Zero slippage 1:1 USDC transfers via Circle CCTP

DeFi & Yield:
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

Security:
• Real-time transaction monitoring
• Scam detection
• Phishing URL detection
• Smart contract analysis

Contact Management:
• Save addresses as contacts (e.g., "Save this address as Jake" or "Add contact Jake")
• Send to contacts by name (e.g., "Send $50 to Jake" - AI finds the address automatically!)
• List, search, update, and delete contacts
• Recent addresses tracking

Real-Time Notifications:
• Transaction confirmations - Get notified automatically when transactions confirm
• Balance change alerts - Know immediately when your balance changes
• Security alerts - Get notified about suspicious activity
• All notifications appear in chat as natural language messages

Utilities:
• Schedule one-time payments (e.g., "Schedule $50 to 0x... tomorrow at 3pm" or "Schedule one-time payment of $100 next Monday")
• Set up recurring subscriptions (e.g., "Subscribe $15 monthly for Netflix")
• View and manage scheduled payments
• Cancel scheduled payments before execution
• Request testnet tokens

Just ask me naturally, like "Send $50 to Jake" or "What's my balance?" or "Schedule $100 to 0x... next Monday at 9am" and I'll help you!`;

    const message = await this.enhanceResponse(
      helpMessage,
      intent,
      "help",
      context
    );

    return { message, intent };
  }

  private static async handleContactIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (typeof window === "undefined") {
      return {
        message: "Contact management is only available in the browser.",
        intent,
      };
    }

    const { getContacts, saveContact, getContact, deleteContact, formatContactsForAI } = await import("@/lib/storage/contacts");
    const { validateAddress } = await import("@/lib/security/address-validation");

    const lowerCommand = intent.rawCommand.toLowerCase();
    const { recipient: name, address, date: notes, time: tags } = intent.entities;

    // Require userId for contact operations
    if (!context?.userId) {
      return {
        message: "Please create a wallet first to manage contacts.",
        intent,
      };
    }

    // List contacts
    if (lowerCommand.includes("list") || lowerCommand.includes("show") || lowerCommand.includes("my contacts")) {
      const contacts = await getContacts(context.userId);
      const message = formatContactsForAI(contacts);
      return { message, intent };
    }

    // Delete contact
    if (lowerCommand.includes("delete") || lowerCommand.includes("remove")) {
      if (!name) {
        return {
          message: "Which contact would you like to delete? Just tell me their name.",
          intent,
        };
      }

      const success = await deleteContact(context.userId, name);
      if (!success) {
        return {
          message: `I couldn't find a contact named "${name}". Want to see your contacts?`,
          intent,
        };
      }

      return {
        message: `✅ Removed ${name} from your contacts.`,
        intent,
      };
    }

    // Add/Save contact
    if (lowerCommand.includes("save") || lowerCommand.includes("add")) {
      if (!name) {
        return {
          message: "I'd be happy to save a contact! What name should I use?",
          intent,
        };
      }

      if (!address) {
        return {
          message: `Got it! I'll save "${name}". What's their wallet address?`,
          intent,
        };
      }

      // Validate address
      const addressValidation = validateAddress(address);
      if (!addressValidation.isValid) {
        return {
          message: `That address doesn't look right. It should start with "0x" and be 42 characters long. Want to try again?`,
          intent,
        };
      }

      try {
        const normalizedAddress = addressValidation.normalizedAddress || address;
        const contact = await saveContact(context.userId, name, normalizedAddress, undefined, notes);

        const shortAddr = `${normalizedAddress.substring(0, 6)}...${normalizedAddress.substring(38)}`;
        return {
          message: `✅ Saved! I've added ${name} (${shortAddr}) to your contacts.\n\nNow you can say "Send $50 to ${name}" and I'll know who you mean!`,
          intent,
        };
      } catch (error: any) {
        return {
          message: `Hmm, something went wrong: ${error.message}`,
          intent,
        };
      }
    }

    // Search contacts by name
    if (name) {
      const contact = await getContact(context.userId, name);
      if (!contact) {
        return {
          message: `I couldn't find a contact named "${name}". Want to see all your contacts?`,
          intent,
        };
      }

      const shortAddr = `${contact.address.substring(0, 6)}...${contact.address.substring(38)}`;
      return {
        message: `Found ${contact.name}!\n\nAddress: ${shortAddr}${contact.notes ? `\nNotes: ${contact.notes}` : ""}`,
        intent,
      };
    }

    // Default: show help
    const message = await this.enhanceResponse(
      "I can help you manage your contacts! You can:\n• Save an address: 'Save this address as Jake'\n• List contacts: 'Show my contacts'\n• Delete a contact: 'Delete Jake'\n• Search: 'Find Jake'\n\nWhat would you like to do?",
      intent,
      "contact_help",
      context,
      undefined,
      sessionId
    );
    return { message, intent };
  }

  private static async handleNotificationIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (typeof window === "undefined") {
      return {
        message: "Notification management is only available in the browser.",
        intent,
      };
    }

    if (!context?.userId) {
      return {
        message: "Please log in (or create a wallet) to manage notifications.",
        intent,
      };
    }

    const { getUserSettings, updateSettings } = await import("@/lib/db/services/settings");
    const {
      getUserNotifications,
      markAllAsRead,
      getUnreadCount
    } = await import("@/lib/db/services/notifications");

    const lowerCommand = intent.rawCommand.toLowerCase();

    // Get preferences
    if (lowerCommand.includes("preferences") || lowerCommand.includes("settings") || lowerCommand.includes("show")) {
      const settings = await getUserSettings(context.userId);
      const preferences = settings?.notificationPreferences || {
        transactionNotifications: true,
        balanceChangeNotifications: true,
        securityAlerts: true,
        systemNotifications: true,
        minBalanceChange: "10",
      };
      const unreadCount = await getUnreadCount(context.userId);

      let message = `🔔 Notification Settings\n\n`;
      message += `Transaction Notifications: ${preferences.transactionNotifications ? "✅ On" : "❌ Off"}\n`;
      message += `Balance Change Alerts: ${preferences.balanceChangeNotifications ? "✅ On" : "❌ Off"}\n`;
      message += `Security Alerts: ${preferences.securityAlerts ? "✅ On" : "❌ Off"}\n`;
      message += `System Notifications: ${preferences.systemNotifications ? "✅ On" : "❌ Off"}\n`;
      message += `Minimum Balance Change: ${preferences.minBalanceChange || "10"} USDC\n\n`;
      message += `Unread Notifications: ${unreadCount}`;

      const enhancedMessage = await this.enhanceResponse(
        message,
        intent,
        "show_notification_preferences",
        context,
        { preferences, unreadCount },
        sessionId
      );
      return { message: enhancedMessage, intent };
    }

    // Turn on/off transaction notifications
    if (lowerCommand.includes("transaction")) {
      const turnOn = !lowerCommand.includes("off") && !lowerCommand.includes("disable");

      const settings = await getUserSettings(context.userId);
      const currentPrefs = settings?.notificationPreferences || {};

      await updateSettings(context.userId, {
        notificationPreferences: {
          ...currentPrefs,
          transactionNotifications: turnOn
        } as any // Cast to handle partial updates if needed or strict typing
      });

      const message = await this.enhanceResponse(
        turnOn
          ? "✅ Transaction notifications are now enabled. I'll notify you when your transactions confirm!"
          : "❌ Transaction notifications are now disabled.",
        intent,
        "toggle_transaction_notifications",
        context,
        { enabled: turnOn },
        sessionId
      );
      return { message, intent };
    }

    // Turn on/off balance notifications
    if (lowerCommand.includes("balance")) {
      const turnOn = !lowerCommand.includes("off") && !lowerCommand.includes("disable");

      const settings = await getUserSettings(context.userId);
      const currentPrefs = settings?.notificationPreferences || {};

      await updateSettings(context.userId, {
        notificationPreferences: {
          ...currentPrefs,
          balanceChangeNotifications: turnOn
        } as any
      });

      const message = await this.enhanceResponse(
        turnOn
          ? "✅ Balance change notifications are now enabled. I'll notify you when your balance changes!"
          : "❌ Balance change notifications are now disabled.",
        intent,
        "toggle_balance_notifications",
        context,
        { enabled: turnOn },
        sessionId
      );
      return { message, intent };
    }

    // Turn on/off all notifications
    if (lowerCommand.includes("all") || lowerCommand.includes("notifications")) {
      const turnOn = !lowerCommand.includes("off") && !lowerCommand.includes("disable");

      const settings = await getUserSettings(context.userId);
      const currentPrefs = settings?.notificationPreferences || {};

      await updateSettings(context.userId, {
        notificationPreferences: {
          ...currentPrefs,
          transactionNotifications: turnOn,
          balanceChangeNotifications: turnOn,
          securityAlerts: turnOn,
          systemNotifications: turnOn,
        } as any
      });

      const message = await this.enhanceResponse(
        turnOn
          ? "✅ All notifications are now enabled!"
          : "❌ All notifications are now disabled.",
        intent,
        "toggle_all_notifications",
        context,
        { enabled: turnOn },
        sessionId
      );
      return { message, intent };
    }

    // Mark all as read
    if (lowerCommand.includes("read") || lowerCommand.includes("clear")) {
      await markAllAsRead(context.userId);
      const message = await this.enhanceResponse(
        "✅ All notifications marked as read!",
        intent,
        "mark_all_read",
        context,
        undefined,
        sessionId
      );
      return { message, intent };
    }

    // Default: show help
    const message = await this.enhanceResponse(
      "I can help you manage notifications! You can:\n• View settings: 'Show notification settings'\n• Turn on/off: 'Enable transaction notifications' or 'Disable balance notifications'\n• Mark as read: 'Mark all notifications as read'\n\nWhat would you like to do?",
      intent,
      "notification_help",
      context,
      undefined,
      sessionId
    );
    return { message, intent };
  }

  /**
   * Handle approve token intent - user approves a suspicious token
   */
  private static async handleApproveTokenIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (typeof window === "undefined") {
      return {
        message: "Token approval is only available in the browser.",
        intent,
      };
    }

    if (!context?.userId) {
      return {
        message: "Please log in to manage token approvals.",
        intent,
      };
    }

    const {
      approveSuspiciousToken
    } = await import("@/lib/notifications/incoming-transaction-monitor");
    const { addSafeToken } = await import("@/lib/security/token-analysis");
    const { getNotificationsByType } = await import("@/lib/db/services/notifications");

    // Get all notifications to find pending token approvals
    const notifications = await getNotificationsByType(context.userId, 'system');
    const pendingTokenNotifications = notifications.filter(
      n => n.metadata?.requiresApproval && !n.metadata?.transfer?.approved && !n.metadata?.transfer?.rejected
    );

    if (pendingTokenNotifications.length === 0) {
      return {
        message: "No pending token approvals found. All tokens have been processed.",
        intent,
      };
    }

    // Get the most recent pending token
    const latestNotification = pendingTokenNotifications[0];
    const transfer = latestNotification.metadata?.transfer;

    if (!transfer) {
      return {
        message: "Token information not found. Please try again.",
        intent,
      };
    }

    // Approve the token
    await approveSuspiciousToken(transfer, context.userId);
    await addSafeToken(context.userId, transfer.tokenAddress);


    const message = await this.enhanceResponse(
      `✅ Token Approved\n\n` +
      `Token: ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n` +
      `Amount: ${transfer.amount}\n` +
      `Address: ${transfer.tokenAddress.slice(0, 10)}...${transfer.tokenAddress.slice(-8)}\n\n` +
      `The token has been added to your wallet and marked as safe. You can now use it normally.`,
      intent,
      "token_approved",
      context,
      {
        transfer,
        tokenAddress: transfer.tokenAddress,
      },
      sessionId
    );

    return { message, intent };
  }

  /**
   * Handle reject token intent - user rejects a suspicious token
   */
  private static async handleRejectTokenIntent(
    intent: ParsedIntent,
    context?: { hasWallet?: boolean; balance?: string; walletAddress?: string; walletId?: string; userId?: string },
    sessionId?: string
  ): Promise<AIResponse> {
    if (typeof window === "undefined") {
      return {
        message: "Token rejection is only available in the browser.",
        intent,
      };
    }

    if (!context?.userId) {
      return {
        message: "Please log in to manage token rejections.",
        intent,
      };
    }

    const {
      rejectSuspiciousToken
    } = await import("@/lib/notifications/incoming-transaction-monitor");
    const { addScamToken } = await import("@/lib/security/token-analysis");
    const { getNotificationsByType } = await import("@/lib/db/services/notifications");

    // Get all notifications to find pending token approvals
    const notifications = await getNotificationsByType(context.userId, 'system');
    const pendingTokenNotifications = notifications.filter(
      n => n.metadata?.requiresApproval && !n.metadata?.transfer?.approved && !n.metadata?.transfer?.rejected
    );

    if (pendingTokenNotifications.length === 0) {
      return {
        message: "No pending token approvals found. All tokens have been processed.",
        intent,
      };
    }

    // Get the most recent pending token
    const latestNotification = pendingTokenNotifications[0];
    const transfer = latestNotification.metadata?.transfer;

    if (!transfer) {
      return {
        message: "Token information not found. Please try again.",
        intent,
      };
    }

    // Reject the token
    await rejectSuspiciousToken(transfer, context.userId);
    await addScamToken(context.userId, transfer.tokenAddress);

    const message = await this.enhanceResponse(
      `❌ Token Rejected\n\n` +
      `Token: ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n` +
      `Address: ${transfer.tokenAddress.slice(0, 10)}...${transfer.tokenAddress.slice(-8)}\n\n` +
      `The token has been rejected and will not be added to your wallet. It has been marked as a scam token for future reference.`,
      intent,
      "token_rejected",
      context,
      {
        transfer,
        tokenAddress: transfer.tokenAddress,
      },
      sessionId
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


