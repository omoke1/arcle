/**
 * Intent Classification System
 * 
 * Classifies user commands into wallet operation intents
 * and extracts entities (amounts, addresses, etc.)
 */

export type IntentType =
  | "greeting"
  | "wallet_creation"
  | "send"
  | "receive"
  | "balance"
  | "tokens"
  | "address"
  | "transaction_history"
  | "bridge"
  | "pay"
  | "yield"
  | "withdraw"
  | "faucet"
  | "scan"
  | "schedule"
  | "subscription"
  | "renew"
  | "arbitrage"
  | "rebalance"
  | "split_payment"
  | "batch"
  | "savings"
  | "trade"
  | "limit_order"
  | "liquidity"
  | "compound"
  | "convert"
  | "fx_rate"
  | "multi_currency"
  | "invoice"
  | "payment_roll"
  | "remittance"
  | "fx_alert"
  | "perpetual"
  | "options"
  | "agent"
  | "confirm"
  | "cancel"
  | "contact"
  | "notification"
  | "approve_token"
  | "reject_token"
  | "help"
  | "location"
  | "bill_payment"
  | "unknown";

export interface ParsedIntent {
  intent: IntentType;
  confidence: number;
  entities: {
    amount?: string;
    currency?: string;
    address?: string;
    recipient?: string;
    transactionId?: string;
    date?: string;
    time?: string;
    frequency?: string;
    merchant?: string;
    billType?: string;
    provider?: string;
    identifier?: string;
  };
  rawCommand: string;
}

/**
 * Simple rule-based intent classifier
 * TODO: Replace with AI model for better accuracy
 */
export class IntentClassifier {
  /**
   * Classify user intent from natural language command
   */
  static classify(command: string): ParsedIntent {
    const lowerCommand = command.toLowerCase().trim();

    // Greeting intent - check first to avoid false matches
    if (this.matchesGreeting(lowerCommand)) {
      return {
        intent: "greeting",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Location sharing intent - check early for coordinates/maps
    if (this.matchesLocation(command, lowerCommand)) {
      return {
        intent: "location",
        confidence: 0.95,
        entities: this.extractLocationEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Wallet creation intent - check early to catch all variations
    if (this.matchesWalletCreation(lowerCommand)) {
      return {
        intent: "wallet_creation",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Schedule intent (check BEFORE send/pay to avoid conflicts)
    if (this.matchesSchedule(lowerCommand)) {
      return {
        intent: "schedule",
        confidence: 0.95,
        entities: this.extractScheduleEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Invoice intent (check BEFORE send/pay to avoid conflicts)
    if (this.matchesInvoice(lowerCommand)) {
      return {
        intent: "invoice",
        confidence: 0.95,
        entities: this.extractInvoiceEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Payment roll intent (check BEFORE send/pay to avoid conflicts)
    if (this.matchesPaymentRoll(lowerCommand)) {
      return {
        intent: "payment_roll",
        confidence: 0.95,
        entities: this.extractPaymentRollEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Send intent
    if (this.matchesSend(lowerCommand)) {
      return {
        intent: "send",
        confidence: 0.9,
        entities: this.extractSendEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Receive intent
    if (this.matchesReceive(lowerCommand)) {
      return {
        intent: "receive",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Rebalance intent (check before balance to avoid conflicts)
    if (this.matchesRebalance(lowerCommand)) {
      return {
        intent: "rebalance",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Balance intent
    if (this.matchesBalance(lowerCommand)) {
      return {
        intent: "balance",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Tokens intent (all tokens, not just balance)
    if (this.matchesTokens(lowerCommand)) {
      return {
        intent: "tokens",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Address intent
    if (this.matchesAddress(lowerCommand)) {
      return {
        intent: "address",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Bridge intent (check before send to avoid conflicts)
    if (this.matchesBridge(lowerCommand)) {
      return {
        intent: "bridge",
        confidence: 0.9,
        entities: this.extractBridgeEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Pay intent (check before send to avoid conflicts)
    if (this.matchesPay(lowerCommand)) {
      return {
        intent: "pay",
        confidence: 0.9,
        entities: this.extractSendEntities(command, lowerCommand), // Same as send
        rawCommand: command,
      };
    }

    // Yield intent
    if (this.matchesYield(lowerCommand)) {
      return {
        intent: "yield",
        confidence: 0.9,
        entities: this.extractYieldEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Arbitrage intent
    if (this.matchesArbitrage(lowerCommand)) {
      return {
        intent: "arbitrage",
        confidence: 0.9,
        entities: this.extractArbitrageEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Split payment intent
    if (this.matchesSplitPayment(lowerCommand)) {
      return {
        intent: "split_payment",
        confidence: 0.9,
        entities: this.extractSplitPaymentEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Batch transaction intent
    if (this.matchesBatch(lowerCommand)) {
      return {
        intent: "batch",
        confidence: 0.9,
        entities: this.extractBatchEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Savings intent
    if (this.matchesSavings(lowerCommand)) {
      return {
        intent: "savings",
        confidence: 0.9,
        entities: this.extractSavingsEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Trade intent
    if (this.matchesTrade(lowerCommand)) {
      return {
        intent: "trade",
        confidence: 0.9,
        entities: this.extractTradeEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Limit order intent
    if (this.matchesLimitOrder(lowerCommand)) {
      return {
        intent: "limit_order",
        confidence: 0.9,
        entities: this.extractLimitOrderEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Liquidity intent
    if (this.matchesLiquidity(lowerCommand)) {
      return {
        intent: "liquidity",
        confidence: 0.9,
        entities: this.extractLiquidityEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Compound intent
    if (this.matchesCompound(lowerCommand)) {
      return {
        intent: "compound",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Convert/FX intent (check before other intents to avoid conflicts)
    if (this.matchesConvert(lowerCommand)) {
      return {
        intent: "convert",
        confidence: 0.9,
        entities: this.extractFXRateEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // FX Rate intent
    if (this.matchesFXRate(lowerCommand)) {
      return {
        intent: "fx_rate",
        confidence: 0.9,
        entities: this.extractFXRateEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Multi-currency balance intent
    if (this.matchesMultiCurrency(lowerCommand)) {
      return {
        intent: "multi_currency",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }


    // Remittance intent
    if (this.matchesRemittance(lowerCommand)) {
      return {
        intent: "remittance",
        confidence: 0.9,
        entities: this.extractRemittanceEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // FX Alert intent
    if (this.matchesFXAlert(lowerCommand)) {
      return {
        intent: "fx_alert",
        confidence: 0.9,
        entities: this.extractFXAlertEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Perpetual trading intent
    if (this.matchesPerpetual(lowerCommand)) {
      return {
        intent: "perpetual",
        confidence: 0.9,
        entities: this.extractPerpetualEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Options trading intent
    if (this.matchesOptions(lowerCommand)) {
      return {
        intent: "options",
        confidence: 0.9,
        entities: this.extractOptionsEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // AI Agent intent
    if (this.matchesAgent(lowerCommand)) {
      return {
        intent: "agent",
        confidence: 0.9,
        entities: this.extractAgentEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Transaction history intent
    if (this.matchesHistory(lowerCommand)) {
      return {
        intent: "transaction_history",
        confidence: 0.85,
        entities: this.extractHistoryEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Scan intent (check before help to avoid conflicts)
    if (this.matchesScan(lowerCommand)) {
      return {
        intent: "scan",
        confidence: 0.9,
        entities: this.extractScanEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Withdraw intent
    if (this.matchesWithdraw(lowerCommand)) {
      return {
        intent: "withdraw",
        confidence: 0.9,
        entities: this.extractWithdrawEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Confirm intent (check early to catch "yes", "confirm", etc.)
    if (this.matchesConfirm(lowerCommand)) {
      return {
        intent: "confirm",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Cancel intent
    if (this.matchesCancel(lowerCommand)) {
      return {
        intent: "cancel",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Contact intent (check before help to avoid conflicts)
    if (this.matchesContact(lowerCommand)) {
      return {
        intent: "contact",
        confidence: 0.9,
        entities: this.extractContactEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Notification intent
    if (this.matchesNotification(lowerCommand)) {
      return {
        intent: "notification",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Approve token intent
    if (this.matchesApproveToken(lowerCommand)) {
      return {
        intent: "approve_token",
        confidence: 0.9,
        entities: this.extractTokenApprovalEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Reject token intent
    if (this.matchesRejectToken(lowerCommand)) {
      return {
        intent: "reject_token",
        confidence: 0.9,
        entities: this.extractTokenApprovalEntities(command, lowerCommand),
        rawCommand: command,
      };
    }

    // Help intent
    if (this.matchesHelp(lowerCommand)) {
      return {
        intent: "help",
        confidence: 0.95,
        entities: {},
        rawCommand: command,
      };
    }

    // Subscription intent (create/manage)
    if (/(subscribe|subscription|auto-?renew|recurring payment)/.test(lowerCommand)) {
      const amountMatch = command.match(/\$?\s?(\d+(?:\.\d{1,2})?)/);
      const merchantMatch = command.match(/for\s+([a-zA-Z0-9\- ]{2,30})/i);
      const monthly = /monthly|every\s*month|1st|2nd|3rd|\d{1,2}th/.test(lowerCommand);
      const weekly = /weekly|every\s*week/.test(lowerCommand);
      const daily = /daily|every\s*day/.test(lowerCommand);
      let frequency: any = monthly ? "monthly" : weekly ? "weekly" : daily ? "daily" : undefined;
      const timeMatch = command.match(/\b(\d{1,2}:\d{2}\s?(am|pm)?|\d{1,2}\s?(am|pm))\b/i);
      return {
        intent: "subscription",
        confidence: 0.9,
        entities: {
          amount: amountMatch ? amountMatch[1] : undefined,
          merchant: merchantMatch ? merchantMatch[1].trim() : undefined,
          frequency,
          time: timeMatch ? timeMatch[0] : undefined,
        },
      } as any;
    }

    // Renew intent
    if (/\brenew\b|\bauto-?renew\b/.test(lowerCommand)) {
      return {
        intent: "renew",
        confidence: 0.9,
        entities: {},
        rawCommand: command,
      };
    }

    // Unknown intent
    return {
      intent: "unknown",
      confidence: 0.1,
      entities: {},
      rawCommand: command,
    };
  }

  private static matchesSend(command: string): boolean {
    // Enhanced patterns to catch "send money", "send usdc", "send funds", etc.
    const sendPatterns = [
      /\bsend\b/i,
      /\btransfer\b/i,
      /\bgive\b/i,
      /\bmove\b/i,
      /\bsend\s+(money|usdc|funds|cash|dollars?|tokens?)/i,
      /\btransfer\s+(money|usdc|funds|cash|dollars?|tokens?)/i,
      /\bwire\b/i,
      /\bremit\b/i,
    ];
    return sendPatterns.some(pattern => pattern.test(command));
  }

  private static matchesPay(command: string): boolean {
    const payKeywords = ["pay", "payment", "pay to", "make payment"];
    return payKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesBridge(command: string): boolean {
    const bridgeKeywords = ["bridge", "cross-chain", "cross chain", "bridge to", "move to"];
    return bridgeKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesYield(command: string): boolean {
    const yieldKeywords = ["yield", "earn", "staking", "stake", "farm", "yield farming", "apy", "interest"];
    return yieldKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesWithdraw(command: string): boolean {
    const withdrawKeywords = ["withdraw", "offramp", "cash out", "cashout", "convert to fiat", "sell", "sell usdc", "withdraw to bank"];
    return withdrawKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesScan(command: string): boolean {
    const scanKeywords = ["scan", "scan address", "check address", "analyze address", "security check", "risk check"];
    return scanKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesReceive(command: string): boolean {
    const receiveKeywords = ["receive", "get", "show address", "qr", "qr code", "my address"];
    return receiveKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesBalance(command: string): boolean {
    const balanceKeywords = ["balance", "how much", "what's my balance", "check balance", "funds"];
    return balanceKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesTokens(command: string): boolean {
    const tokenKeywords = [
      "what tokens", "show tokens", "list tokens", "my tokens",
      "all tokens", "tokens i have", "token balances",
      "what do i have", "show me my tokens", "what assets"
    ];
    return tokenKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesAddress(command: string): boolean {
    const addressKeywords = ["address", "wallet address", "my address", "show address", "qr"];
    return addressKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesHistory(command: string): boolean {
    const historyKeywords = ["history", "transactions", "recent", "past", "list transactions"];
    return historyKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesConfirm(command: string): boolean {
    const confirmKeywords = [
      "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "okey",
      "confirm", "confirmed", "confirmation",
      "proceed", "proceed with", "go ahead", "go for it",
      "do it", "execute", "run it", "send it", "make it happen",
      "continue", "let's do it", "let's go", "sounds good",
      "that's right", "correct", "affirmative", "absolutely",
      "approve", "approved", "accept", "accepted"
    ];
    const trimmed = command.trim().toLowerCase();
    // Check for exact matches or if command starts with any keyword
    return confirmKeywords.some(keyword => {
      const keywordLower = keyword.toLowerCase();
      return trimmed === keywordLower ||
        trimmed.startsWith(keywordLower + " ") ||
        trimmed.startsWith(keywordLower + ",") ||
        trimmed.startsWith(keywordLower + ".");
    });
  }

  private static matchesCancel(command: string): boolean {
    const cancelKeywords = ["no", "cancel", "stop", "abort", "don't", "dont", "nevermind", "never mind", "nope"];
    const trimmed = command.trim().toLowerCase();
    return cancelKeywords.some(keyword => trimmed === keyword || trimmed.startsWith(keyword + " "));
  }

  private static matchesHelp(command: string): boolean {
    const helpKeywords = ["help", "what can you do", "how", "commands", "what do you do"];
    return helpKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesContact(command: string): boolean {
    const contactKeywords = [
      "contact",
      "save contact",
      "add contact",
      "save address",
      "save as",
      "my contacts",
      "list contacts",
      "show contacts",
      "delete contact",
      "remove contact",
      "update contact",
      "edit contact",
      "contacts",
      "address book",
      "addressbook"
    ];
    return contactKeywords.some(keyword => command.includes(keyword));
  }

  private static extractContactEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract contact name (for save/add operations)
    // Patterns: "save as Jake", "add contact Jake", "save this as John"
    const savePatterns = [
      /save\s+(?:this\s+)?(?:address\s+)?as\s+([a-zA-Z0-9\s]{2,30})/i,
      /add\s+contact\s+([a-zA-Z0-9\s]{2,30})/i,
      /save\s+contact\s+([a-zA-Z0-9\s]{2,30})/i,
      /(?:save|add)\s+([a-zA-Z0-9\s]{2,30})\s+(?:as\s+)?contact/i,
    ];

    for (const pattern of savePatterns) {
      const match = original.match(pattern);
      if (match && match[1]) {
        entities.recipient = match[1].trim(); // Store name in recipient field
        break;
      }
    }

    // Extract address (0x followed by 40 hex chars)
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    // Extract contact name for lookup (for list/delete/update operations)
    // Patterns: "delete Jake", "update John", "show Jake's contact"
    if (!entities.recipient) {
      const lookupPatterns = [
        /(?:delete|remove|update|edit|show|get)\s+contact\s+([a-zA-Z0-9\s]{2,30})/i,
        /(?:delete|remove|update|edit|show|get)\s+([a-zA-Z0-9\s]{2,30})(?:\s+contact)?/i,
      ];

      for (const pattern of lookupPatterns) {
        const match = original.match(pattern);
        if (match && match[1]) {
          entities.recipient = match[1].trim();
          break;
        }
      }
    }

    // Extract notes (after "notes" or "with notes")
    const notesMatch = original.match(/(?:notes?|note):\s*([^,]+)/i);
    if (notesMatch) {
      entities.date = notesMatch[1].trim(); // Store notes in date field (temporary)
    }

    // Extract tags (after "tags" or comma-separated)
    const tagsMatch = original.match(/(?:tags?|tag):\s*([^,]+)/i);
    if (tagsMatch) {
      entities.time = tagsMatch[1].trim(); // Store tags in time field (temporary)
    }

    return entities;
  }

  private static matchesNotification(command: string): boolean {
    const notificationKeywords = [
      "notification",
      "notifications",
      "notify",
      "alerts",
      "alert",
      "notification settings",
      "notification preferences",
      "turn on notifications",
      "turn off notifications",
      "enable notifications",
      "disable notifications"
    ];
    return notificationKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesApproveToken(command: string): boolean {
    const approveKeywords = [
      "approve token",
      "approve this token",
      "allow token",
      "accept token",
      "trust token",
      "yes approve",
      "approve it",
      "add token",
      "keep token"
    ];
    return approveKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesRejectToken(command: string): boolean {
    const rejectKeywords = [
      "reject token",
      "reject this token",
      "block token",
      "deny token",
      "remove token",
      "delete token",
      "no reject",
      "reject it",
      "don't approve",
      "don't accept"
    ];
    return rejectKeywords.some(keyword => command.includes(keyword));
  }

  private static extractTokenApprovalEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract token address if mentioned
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/i);
    if (addressMatch) {
      entities.recipient = addressMatch[0];
    }

    // Extract token symbol/name if mentioned
    const tokenMatch = original.match(/(?:token|symbol)\s+(\w+)/i);
    if (tokenMatch) {
      entities.currency = tokenMatch[1];
    }

    return entities;
  }

  private static matchesSchedule(command: string): boolean {
    // If the user explicitly mentions recurring/subscription language, let the subscription intent handle it
    const recurringPatterns = [
      "recurring",
      "subscription",
      "subscribe",
      "auto renew",
      "auto-renew",
      "auto pay",
      "autopay",
      "every day",
      "every week",
      "every month",
      "monthly",
      "weekly",
      "daily",
    ];
    if (recurringPatterns.some((keyword) => command.includes(keyword))) {
      return false;
    }

    const scheduleKeywords = [
      "schedule",
      "schedule payment",
      "schedule a payment",
      "schedule one-time payment",
      "schedule one time payment",
      "one-time payment",
      "one time payment",
      "pay later",
      "send later",
      "set reminder",
      "remind me to pay",
      "pay on",
      "pay at",
      "send on",
      "send at",
      "automatic payment",
      "scheduled transaction"
    ];
    return scheduleKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesWalletCreation(command: string): boolean {
    // Comprehensive wallet creation patterns
    const walletKeywords = [
      // Direct creation requests
      "create wallet", "create a wallet", "create me a wallet", "create my wallet",
      "make wallet", "make a wallet", "make me a wallet", "make my wallet",
      "set up wallet", "setup wallet", "set up a wallet", "setup a wallet",
      "get wallet", "get a wallet", "get me a wallet", "get my wallet",
      "new wallet", "i need a wallet", "i want a wallet", "i want wallet",
      "need wallet", "need a wallet", "want wallet", "want a wallet",
      // Account creation
      "create account", "create an account", "create my account",
      "set up account", "setup account", "set up an account",
      "new account", "i need an account", "i want an account",
      // Wallet-related phrases
      "wallet for me", "wallet please", "wallet now",
      "start wallet", "begin wallet", "initialize wallet",
      "open wallet", "activate wallet", "enable wallet",
      // Variations
      "can you create", "can you make", "can you set up",
      "please create", "please make", "please set up",
      "help me create", "help me make", "help me set up",
      "i'd like a wallet", "i'd like wallet", "i would like wallet",
      "let's create", "let's make", "let's set up",
    ];

    return walletKeywords.some(keyword => command.includes(keyword));
  }

  private static matchesGreeting(command: string): boolean {
    // Common greetings and variations
    const greetingPatterns = [
      // Simple greetings
      /^(hi|hello|hey|greetings|sup|what's up|whats up|yo|hola|salut|ciao|g'day|howdy|wassup|what's good|whats good)\b/i,
      // Time-based greetings
      /^(good morning|good afternoon|good evening|good night|morning|afternoon|evening)\b/i,
      // Greetings with modifiers
      /^(hi|hello|hey)\s+(there|friend|buddy|pal|mate|you|everyone|all|how are you|how are we)\b/i,
      // Casual greetings
      /^(sup|wassup|what's up|whats up|what's good|whats good)\s*(with\s+you|man|bro|dude|everyone)?\s*$/i,
      // How are you variations
      /^(how are you|how are we|how's it going|hows it going|how's things|hows things|how you doing|how do you do)\s*$/i,
      // Other friendly greetings
      /^(nice to meet you|pleased to meet you|how do you do)\s*$/i,
    ];

    // Check if command matches greeting patterns (exact match or starts with greeting)
    const trimmed = command.trim();
    return greetingPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Extract entities from send command
   * Enhanced to handle "send money", "send $50", "send money to address", etc.
   */
  private static extractSendEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount (supports $50, 50 USDC, 50.5, "send money $50", etc.)
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?|money)?/i,
      /(\d+(?:\.\d+)?)\s*(?:usdc|dollars?|money)/i,
      /send\s+(?:money\s+)?\$?(\d+(?:\.\d+)?)/i,
      /transfer\s+(?:money\s+)?\$?(\d+(?:\.\d+)?)/i,
      /pay\s+\$?(\d+(?:\.\d+)?)/i,
      /send\s+\$?(\d+(?:\.\d+)?)\s+(?:usdc|dollars?|money)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract currency - default to USDC if not specified
    if (lower.includes("usdc") || lower.includes("usd")) {
      entities.currency = "USDC";
    } else if (lower.includes("eurc")) {
      entities.currency = "EURC";
    } else {
      // Default to USDC for "send money" if no currency specified
      entities.currency = "USDC";
    }

    // Extract address (0x followed by 40 hex chars)
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    // Extract recipient name (if mentioned)
    const recipientPatterns = [
      /to\s+([a-zA-Z]+)/i,
      /send\s+(?:money\s+)?\$?\d+(?:\s+\w+)?\s+to\s+([a-zA-Z]+)/i,
      /send\s+(?:money\s+)?to\s+([a-zA-Z]+)/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = original.match(pattern);
      if (match && match[1] && !match[1].match(/0x|usdc|dollar|money/i)) {
        entities.recipient = match[1];
        break;
      }
    }

    return entities;
  }

  /**
   * Extract entities from history command
   */
  private static extractHistoryEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract transaction ID if mentioned
    const txIdMatch = original.match(/0x[a-fA-F0-9]{64}/);
    if (txIdMatch) {
      entities.transactionId = txIdMatch[0];
    }

    return entities;
  }

  /**
   * Extract entities from bridge command
   */
  private static extractBridgeEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)/i,
      /bridge\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract destination chain
    const chainPatterns = [
      /to\s+(ethereum|base|polygon|avalanche|arbitrum|optimism|solana)/i,
      /on\s+(ethereum|base|polygon|avalanche|arbitrum|optimism|solana)/i,
      /from\s+arc\s+to\s+(ethereum|base|polygon|avalanche|arbitrum|optimism|solana)/i,
    ];

    for (const pattern of chainPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.recipient = match[1]; // Using recipient field for destination chain
        break;
      }
    }

    // Extract currency
    if (lower.includes("usdc") || lower.includes("usd")) {
      entities.currency = "USDC";
    } else if (lower.includes("eurc")) {
      entities.currency = "EURC";
    }

    // Extract destination address (Ethereum address format: 0x followed by 40 hex chars)
    const addressPattern = /0x[a-fA-F0-9]{40}/i;
    const addressMatch = original.match(addressPattern);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    return entities;
  }

  /**
   * Match arbitrage intent
   */
  private static matchesArbitrage(command: string): boolean {
    const keywords = ["arbitrage", "find arbitrage", "arbitrage opportunity", "price difference"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match rebalance intent
   */
  private static matchesRebalance(command: string): boolean {
    const keywords = ["rebalance", "rebalance portfolio", "rebalance my", "balance portfolio"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match split payment intent
   */
  private static matchesSplitPayment(command: string): boolean {
    const keywords = ["split", "split payment", "split between", "divide payment", "split $"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match batch transaction intent
   */
  private static matchesBatch(command: string): boolean {
    const keywords = ["batch", "batch transaction", "batch these", "multiple transactions"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match savings intent
   */
  private static matchesSavings(command: string): boolean {
    const keywords = ["savings", "savings account", "create savings", "open savings"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match trade intent
   */
  private static matchesTrade(command: string): boolean {
    const keywords = ["trade", "swap", "exchange", "convert", "trade usdc", "swap usdc"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match limit order intent
   */
  private static matchesLimitOrder(command: string): boolean {
    const keywords = ["limit order", "limit buy", "limit sell", "order at", "when price"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match liquidity intent
   */
  private static matchesLiquidity(command: string): boolean {
    const keywords = ["liquidity", "aggregate liquidity", "best price", "find best"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Match compound intent
   */
  private static matchesCompound(command: string): boolean {
    const keywords = ["compound", "auto compound", "compound rewards", "reinvest"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesConvert(command: string): boolean {
    const keywords = ["convert", "exchange", "swap", "change", "convert to", "exchange to"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesFXRate(command: string): boolean {
    const keywords = ["fx rate", "exchange rate", "currency rate", "rate", "what's the rate", "show rate"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesMultiCurrency(command: string): boolean {
    const keywords = ["currencies", "all currencies", "multi currency", "what currencies", "show currencies"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesInvoice(command: string): boolean {
    const keywords = [
      "invoice",
      "create invoice",
      "send invoice",
      "bill",
      "invoice for",
      "outstanding invoices",
      "overdue invoices",
      "list invoices",
      "show invoices",
      "my invoices",
      "invoice to",
      "bill for",
      "create bill"
    ];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesPaymentRoll(command: string): boolean {
    const keywords = ["payment roll", "payroll", "pay employees", "recurring payment", "automated payment", "pay team"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesRemittance(command: string): boolean {
    const keywords = ["remittance", "send to", "send money to", "transfer to", "send to my", "family in", "mom in", "dad in"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesFXAlert(command: string): boolean {
    const keywords = ["alert", "notify", "notify me when", "tell me when", "rate alert", "fx alert"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesPerpetual(command: string): boolean {
    const keywords = ["perpetual", "perps", "long", "short", "leverage", "margin", "open position"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesOptions(command: string): boolean {
    const keywords = ["option", "call", "put", "strike", "expiry", "premium"];
    return keywords.some(keyword => command.includes(keyword));
  }

  private static matchesAgent(command: string): boolean {
    const keywords = ["agent", "create agent", "ai agent", "autonomous", "automate", "agent marketplace"];
    return keywords.some(keyword => command.includes(keyword));
  }

  /**
   * Extract entities from arbitrage command
   */
  private static extractArbitrageEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};
    // Arbitrage doesn't need specific entities, just triggers the scan
    return entities;
  }

  /**
   * Extract entities from split payment command
   */
  private static extractSplitPaymentEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract total amount (look for amount after "split" or "$")
    const amountPatterns = [
      /split\s+\$?(\d+(?:\.\d+)?)/i,
      /\$(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract number of recipients (look for number before "people", "recipients", "ways", "between")
    const recipientPatterns = [
      /between\s+(\d+)\s*(?:people|recipients|ways)/i,
      /(\d+)\s*(?:people|recipients|ways)/i,
      /split.*?(\d+)\s*(?:ways|recipients)/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.recipient = match[1];
        break;
      }
    }

    return entities;
  }

  /**
   * Extract entities from batch command
   */
  private static extractBatchEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};
    // Batch transactions are usually handled through UI or explicit transaction lists
    return entities;
  }

  /**
   * Extract entities from savings command
   */
  private static extractSavingsEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract initial deposit
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /deposit\s+\$?(\d+(?:\.\d+)?)/i,
      /with\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract risk tolerance
    if (lower.includes("low risk") || lower.includes("low-risk")) {
      entities.recipient = "low";
    } else if (lower.includes("medium risk") || lower.includes("medium-risk")) {
      entities.recipient = "medium";
    } else if (lower.includes("high risk") || lower.includes("high-risk")) {
      entities.recipient = "high";
    }

    return entities;
  }

  /**
   * Extract entities from trade command
   */
  private static extractTradeEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /trade\s+\$?(\d+(?:\.\d+)?)/i,
      /swap\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract from/to tokens
    if (lower.includes("usdc to") || lower.includes("usdc for")) {
      entities.currency = "USDC";
      const toTokenMatch = original.match(/(?:to|for)\s+(\w+)/i);
      if (toTokenMatch) {
        entities.recipient = toTokenMatch[1];
      }
    }

    return entities;
  }

  /**
   * Extract entities from limit order command
   */
  private static extractLimitOrderEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /order\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract target price
    const priceMatch = original.match(/(?:at|when|price)\s+\$?(\d+(?:\.\d+)?)/i);
    if (priceMatch) {
      entities.recipient = priceMatch[1]; // Store price in recipient field temporarily
    }

    // Extract order type
    if (lower.includes("buy")) {
      entities.currency = "buy";
    } else if (lower.includes("sell")) {
      entities.currency = "sell";
    }

    return entities;
  }

  /**
   * Extract entities from liquidity command
   */
  private static extractLiquidityEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    return entities;
  }

  /**
   * Extract entities from yield command
   */
  private static extractYieldEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount to stake/yield
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)/i,
      /(?:yield|stake|earn)\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract currency
    if (lower.includes("usdc") || lower.includes("usd")) {
      entities.currency = "USDC";
    } else if (lower.includes("eurc")) {
      entities.currency = "EURC";
    }

    return entities;
  }

  /**
   * Extract entities from schedule command
   */
  private static extractScheduleEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /schedule\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract address
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    // Extract date (tomorrow, next Monday, specific date, etc.)
    const datePatterns = [
      /(tomorrow|today|next\s+\w+|in\s+\d+\s+(?:day|days|week|weeks)|20\d{2}-\d{2}-\d{2})/i,
      /on\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    ];

    for (const pattern of datePatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.date = match[1];
        break;
      }
    }

    // Extract time
    const timePatterns = [
      /\b(\d{1,2}):?(\d{2})?\s*(am|pm)\b/i,
      /\bat\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i,
    ];

    for (const pattern of timePatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.time = match[0].replace(/at\s+/i, "").trim();
        break;
      }
    }

    return entities;
  }

  /**
   * Extract entities from FX rate/convert command
   */
  private static extractFXRateEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountMatch = original.match(/\$?(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      entities.amount = amountMatch[1];
    }

    // Extract currencies (from/to)
    const currencyPatterns = [
      /(?:from|convert)\s+(\w+)\s+(?:to|for)\s+(\w+)/i,
      /(\w+)\s+(?:to|for)\s+(\w+)/i,
      /convert\s+(\w+)\s+(\w+)/i,
    ];

    for (const pattern of currencyPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.currency = match[1].toUpperCase();
        entities.recipient = match[2].toUpperCase();
        break;
      }
    }

    // If no explicit currencies, try to detect from common patterns
    if (!entities.currency) {
      if (/\b(usdc|usd|dollar)\b/i.test(original)) {
        entities.currency = "USDC";
      } else if (/\b(eurc|eur|euro)\b/i.test(original)) {
        entities.currency = "EURC";
      }
    }

    if (!entities.recipient) {
      if (/\b(usdc|usd|dollar)\b/i.test(original) && !entities.currency?.includes("USDC")) {
        entities.recipient = "USDC";
      } else if (/\b(eurc|eur|euro)\b/i.test(original) && !entities.currency?.includes("EURC")) {
        entities.recipient = "EURC";
      }
    }

    return entities;
  }

  /**
   * Extract entities from invoice command
   */
  private static extractInvoiceEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|eurc|dollars?|euros?)?/i,
      /invoice\s+(?:for|of)\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract recipient
    const recipientPatterns = [
      /(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})(?:\s|,|$)/i,
      /invoice\s+(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.recipient = match[1].trim();
        break;
      }
    }

    // Extract due date
    const datePatterns = [
      /(?:due|by)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      /(?:due|by)\s+(tomorrow|next\s+week|in\s+\d+\s+days?)/i,
    ];

    for (const pattern of datePatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.date = match[1];
        break;
      }
    }

    // Extract currency
    if (/\b(usdc|usd|dollar)\b/i.test(original)) {
      entities.currency = "USDC";
    } else if (/\b(eurc|eur|euro)\b/i.test(original)) {
      entities.currency = "EURC";
    }

    return entities;
  }

  /**
   * Extract entities from payment roll command
   */
  private static extractPaymentRollEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract frequency
    if (/\b(daily|every\s+day)\b/i.test(original)) {
      entities.frequency = "daily";
    } else if (/\b(weekly|every\s+week)\b/i.test(original)) {
      entities.frequency = "weekly";
    } else if (/\b(biweekly|every\s+2\s+weeks)\b/i.test(original)) {
      entities.frequency = "biweekly";
    } else if (/\b(monthly|every\s+month)\b/i.test(original)) {
      entities.frequency = "monthly";
    }

    // Extract recipients and amounts (simple pattern)
    const recipientPattern = /(?:pay|send)\s+\$?(\d+(?:\.\d+)?)\s*(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})/gi;
    const matches = Array.from(original.matchAll(recipientPattern));
    if (matches.length > 0) {
      // Store first recipient in entities
      entities.recipient = matches[0][2].trim();
      entities.amount = matches[0][1];
    }

    return entities;
  }

  /**
   * Extract entities from remittance command
   */
  private static extractRemittanceEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /send\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract recipient name
    const recipientPatterns = [
      /(?:to|for)\s+(?:my\s+)?([a-zA-Z\s]{2,50})(?:\s+in|\s+to|$)/i,
      /send\s+(?:to|for)\s+([a-zA-Z\s]{2,50})/i,
    ];

    for (const pattern of recipientPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.recipient = match[1].trim();
        break;
      }
    }

    // Extract country
    const countries = ["mexico", "canada", "united states", "united kingdom", "germany", "france", "spain", "italy", "japan", "china", "india", "brazil", "australia"];
    for (const country of countries) {
      if (lower.includes(country)) {
        entities.address = country; // Store country in address field
        break;
      }
    }

    return entities;
  }

  /**
   * Extract entities from FX alert command
   */
  private static extractFXAlertEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract target rate
    const ratePatterns = [
      /(?:when|at|hits?|reaches?)\s+(\d+\.?\d*)/i,
      /(?:above|below)\s+(\d+\.?\d*)/i,
    ];

    for (const pattern of ratePatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1]; // Store rate in amount field
        break;
      }
    }

    // Extract direction
    if (lower.includes("above") || lower.includes("over") || lower.includes("higher")) {
      entities.recipient = "above"; // Store direction in recipient field
    } else if (lower.includes("below") || lower.includes("under") || lower.includes("lower")) {
      entities.recipient = "below";
    }

    // Extract currency pair
    if (lower.includes("usdc") && lower.includes("eurc")) {
      entities.currency = "USDC-EURC";
    } else if (lower.includes("eurc") && lower.includes("usdc")) {
      entities.currency = "EURC-USDC";
    }

    return entities;
  }

  /**
   * Extract entities from perpetual trading command
   */
  private static extractPerpetualEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract side
    if (lower.includes("long")) {
      entities.recipient = "long"; // Store side in recipient field
    } else if (lower.includes("short")) {
      entities.recipient = "short";
    }

    // Extract amount/size
    const amountMatch = original.match(/\$?(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      entities.amount = amountMatch[1];
    }

    // Extract leverage
    const leverageMatch = original.match(/(\d+)x|leverage\s+(\d+)/i);
    if (leverageMatch) {
      entities.currency = leverageMatch[1] || leverageMatch[2]; // Store leverage in currency field
    }

    return entities;
  }

  /**
   * Extract entities from options trading command
   */
  private static extractOptionsEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract option type
    if (lower.includes("call")) {
      entities.recipient = "call"; // Store type in recipient field
    } else if (lower.includes("put")) {
      entities.recipient = "put";
    }

    // Extract strike price
    const strikeMatch = original.match(/strike\s+(\d+\.?\d*)|at\s+(\d+\.?\d*)/i);
    if (strikeMatch) {
      entities.amount = strikeMatch[1] || strikeMatch[2]; // Store strike in amount field
    }

    return entities;
  }

  /**
   * Extract entities from agent command
   */
  private static extractAgentEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract agent name
    const nameMatch = original.match(/(?:create|make|build)\s+(?:an?\s+)?(?:ai\s+)?agent\s+(?:to|for|that)\s+([^,]+?)(?:,|$|to)/i);
    if (nameMatch) {
      entities.recipient = nameMatch[1].trim(); // Store name in recipient field
    }

    // Extract action
    if (lower.includes("pay") && lower.includes("invoice")) {
      entities.currency = "pay_invoice"; // Store action in currency field
    } else if (lower.includes("compound")) {
      entities.currency = "compound_yield";
    } else if (lower.includes("rebalance")) {
      entities.currency = "rebalance_portfolio";
    }

    return entities;
  }

  /**
   * Extract entities from scan command
   */
  private static extractScanEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract address (0x followed by 40 hex chars)
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }

    return entities;
  }

  /**
   * Extract entities from withdraw command
   */
  private static extractWithdrawEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract amount
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)/i,
      /(?:withdraw|cash out|cashout)\s+\$?(\d+(?:\.\d+)?)/i,
    ];

    for (const pattern of amountPatterns) {
      const match = original.match(pattern);
      if (match) {
        entities.amount = match[1];
        break;
      }
    }

    // Extract destination (bank account, card, etc.)
    if (lower.includes("bank") || lower.includes("bank account")) {
      entities.recipient = "bank";
    } else if (lower.includes("card") || lower.includes("credit card") || lower.includes("debit card")) {
      entities.recipient = "card";
    } else if (lower.includes("paypal")) {
      entities.recipient = "paypal";
    }

    // Extract currency
    if (lower.includes("usdc") || lower.includes("usd")) {
      entities.currency = "USDC";
    } else if (lower.includes("eurc") || lower.includes("eur")) {
      entities.currency = "EURC";
    }

    return entities;
  }

  /**
   * Check if command contains location sharing
   */
  private static matchesLocation(original: string, lower: string): boolean {
    // Check for location emoji
    if (original.includes("📍") || original.includes("🗺️") || original.includes("🌍")) {
      return true;
    }

    // Check for "my location" or "location"
    if (lower.includes("my location") || lower.includes("📍")) {
      return true;
    }

    // Check for coordinates pattern (latitude, longitude)
    const coordPattern = /-?\d+\.?\d*,\s*-?\d+\.?\d*/;
    if (coordPattern.test(original)) {
      return true;
    }

    // Check for Google Maps URL
    if (original.includes("google.com/maps") || original.includes("maps.google.com")) {
      return true;
    }

    // Check for location-related keywords
    const locationKeywords = ["location", "coordinates", "where i am", "my position", "gps"];
    if (locationKeywords.some(keyword => lower.includes(keyword))) {
      return true;
    }

    return false;
  }

  /**
   * Extract location entities from command
   */
  private static extractLocationEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};

    // Extract coordinates (latitude, longitude)
    const coordMatch = original.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
    if (coordMatch) {
      entities.address = `${coordMatch[1]},${coordMatch[2]}`; // Store coordinates in address field
    }

    // Extract Google Maps URL
    const mapsMatch = original.match(/maps\.google\.com\/\?q=([^&\s]+)|google\.com\/maps\?q=([^&\s]+)/);
    if (mapsMatch) {
      entities.address = mapsMatch[1] || mapsMatch[2];
    }

    // Check for delivery context
    if (lower.includes("delivery") || lower.includes("order") || lower.includes("track")) {
      entities.recipient = "delivery"; // Store context in recipient field
    }

    return entities;
  }
}

