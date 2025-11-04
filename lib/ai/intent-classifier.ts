/**
 * Intent Classification System
 * 
 * Classifies user commands into wallet operation intents
 * and extracts entities (amounts, addresses, etc.)
 */

export type IntentType = 
  | "greeting"
  | "send"
  | "receive"
  | "balance"
  | "address"
  | "transaction_history"
  | "bridge"
  | "pay"
  | "yield"
  | "withdraw"
  | "faucet"
  | "help"
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
    
    // Balance intent
    if (this.matchesBalance(lowerCommand)) {
      return {
        intent: "balance",
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
    
    // Transaction history intent
    if (this.matchesHistory(lowerCommand)) {
      return {
        intent: "transaction_history",
        confidence: 0.85,
        entities: this.extractHistoryEntities(command, lowerCommand),
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
    
    // Unknown intent
    return {
      intent: "unknown",
      confidence: 0.1,
      entities: {},
      rawCommand: command,
    };
  }
  
  private static matchesSend(command: string): boolean {
    const sendKeywords = ["send", "transfer", "give", "move"];
    return sendKeywords.some(keyword => command.includes(keyword));
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
  
  private static matchesReceive(command: string): boolean {
    const receiveKeywords = ["receive", "get", "show address", "qr", "qr code", "my address"];
    return receiveKeywords.some(keyword => command.includes(keyword));
  }
  
  private static matchesBalance(command: string): boolean {
    const balanceKeywords = ["balance", "how much", "what's my balance", "check balance", "funds"];
    return balanceKeywords.some(keyword => command.includes(keyword));
  }
  
  private static matchesAddress(command: string): boolean {
    const addressKeywords = ["address", "wallet address", "my address", "show address", "qr"];
    return addressKeywords.some(keyword => command.includes(keyword));
  }
  
  private static matchesHistory(command: string): boolean {
    const historyKeywords = ["history", "transactions", "recent", "past", "list transactions"];
    return historyKeywords.some(keyword => command.includes(keyword));
  }
  
  private static matchesHelp(command: string): boolean {
    const helpKeywords = ["help", "what can you do", "how", "commands", "what do you do"];
    return helpKeywords.some(keyword => command.includes(keyword));
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
   */
  private static extractSendEntities(original: string, lower: string): ParsedIntent["entities"] {
    const entities: ParsedIntent["entities"] = {};
    
    // Extract amount (supports $50, 50 USDC, 50.5, etc.)
    const amountPatterns = [
      /\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i,
      /(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)/i,
      /send\s+\$?(\d+(?:\.\d+)?)/i,
      /transfer\s+\$?(\d+(?:\.\d+)?)/i,
      /pay\s+\$?(\d+(?:\.\d+)?)/i,
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
    
    // Extract address (0x followed by 40 hex chars)
    const addressMatch = original.match(/0x[a-fA-F0-9]{40}/);
    if (addressMatch) {
      entities.address = addressMatch[0];
    }
    
    // Extract recipient name (if mentioned)
    const recipientPatterns = [
      /to\s+([a-zA-Z]+)/i,
      /send\s+\$?\d+(?:\s+\w+)?\s+to\s+([a-zA-Z]+)/i,
    ];
    
    for (const pattern of recipientPatterns) {
      const match = original.match(pattern);
      if (match && match[1] && !match[1].match(/0x|usdc|dollar/i)) {
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
}

