/**
 * Context-Aware Intent Classifier
 * 
 * Uses Google Gemini to understand user intent with conversation context
 * This provides much better understanding than rule-based classification
 */

import { ParsedIntent } from "./intent-classifier";
import { PendingAction } from "./conversation-context";

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

export interface ClassificationContext {
  pendingAction?: PendingAction;
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  hasWallet?: boolean;
}

/**
 * Classify intent with context using Gemini
 * This provides much better understanding than rule-based classification
 */
export async function classifyIntentWithContext(
  message: string,
  context?: ClassificationContext
): Promise<ParsedIntent> {
  // Get API key - server-side only (client should use API route)
  const googleApiKey = process.env.GOOGLE_AI_API_KEY;

  // If no API key, fallback to rule-based
  if (!googleApiKey) {
    const { IntentClassifier } = await import("./intent-classifier");
    return IntentClassifier.classify(message);
  }
  
  // If client-side, use API route instead of direct API call
  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, context }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.intent) {
          return data.intent;
        }
      }
    } catch (error) {
      console.warn("API route classification failed, using fallback:", error);
    }
    
    // Fallback to rule-based if API route fails
    const { IntentClassifier } = await import("./intent-classifier");
    return IntentClassifier.classify(message);
  }

  // Build context string
  let contextString = "";
  if (context?.pendingAction) {
    contextString += `\n\nIMPORTANT CONTEXT: There is a PENDING ACTION:\n`;
    contextString += `- Type: ${context.pendingAction.type}\n`;
    contextString += `- Data: ${JSON.stringify(context.pendingAction.data, null, 2)}\n`;
    contextString += `- User just said: "${message}"\n`;
    contextString += `- If the user says "proceed", "yes", "confirm", "go ahead", etc., they are CONFIRMING this pending action.\n`;
  }

  if (context?.recentMessages && context.recentMessages.length > 0) {
    contextString += `\n\nRECENT CONVERSATION:\n`;
    context.recentMessages.slice(-5).forEach((msg, i) => {
      contextString += `${msg.role === "user" ? "User" : "ARCLE"}: ${msg.content}\n`;
    });
  }

  const systemPrompt = `You are an intent classifier for ARCLE, an AI wallet assistant. Your job is to understand what the user wants to do.

AVAILABLE INTENTS:
- "confirm": User is confirming/approving a pending action (e.g., "yes", "proceed", "confirm", "go ahead", "do it")
- "cancel": User is canceling a pending action (e.g., "no", "cancel", "stop", "abort")
- "send": Send USDC to an address
- "pay": Make a payment
- "phone": Send payment to phone number
- "email": Send payment to email address
- "bridge": Bridge USDC to another chain
- "remittance": Cross-border payment
- "balance": Check balance
- "transaction_history": View transaction history
- "convert": Convert between currencies (USDC/EURC)
- "fx_rate": Get exchange rate
- "schedule": Schedule a payment
- "subscription": Create/manage subscription
- "invoice": Create/manage invoices
- "payment_roll": Payment roll/payroll
- "yield": Start yield farming
- "savings": Create savings goal
- "safelock": Create fixed deposit
- "trade": Execute trade/swap
- "liquidity": Find best liquidity
- "arbitrage": Find arbitrage opportunities
- "rebalance": Rebalance portfolio
- "order": Place order (commerce)
- "purchase": Make purchase
- "buy": Buy something
- "merchant": Merchant operations
- "pos": Point of sale
- "settlement": Merchant settlement
- "compliance": Compliance check
- "kyc": KYC verification
- "risk": Risk analysis
- "fraud": Fraud detection
- "analytics": Analytics/insights
- "report": Generate report
- "dashboard": Show dashboard
- "summary": Show summary
- "bill_payment": Pay bill
- "help": User needs help
- "greeting": Greeting message
- "unknown": Can't determine intent

${contextString}

CRITICAL RULES:
1. If there's a PENDING ACTION and user says "proceed", "yes", "confirm", "go ahead", "do it", "execute", "continue", etc., the intent MUST be "confirm"
2. If there's a PENDING ACTION and user says "no", "cancel", "stop", "abort", "nevermind", etc., the intent MUST be "cancel"
3. Be context-aware - understand what the user is responding to based on recent conversation
4. If the user is clearly confirming something (even without explicit words), classify as "confirm"

Return ONLY a JSON object with this exact format:
{
  "intent": "confirm" | "cancel" | "send" | "pay" | "phone" | "email" | "bridge" | "remittance" | "balance" | "transaction_history" | "convert" | "fx_rate" | "schedule" | "subscription" | "invoice" | "payment_roll" | "yield" | "savings" | "safelock" | "trade" | "liquidity" | "arbitrage" | "rebalance" | "order" | "purchase" | "buy" | "merchant" | "pos" | "settlement" | "compliance" | "kyc" | "risk" | "fraud" | "analytics" | "report" | "dashboard" | "summary" | "bill_payment" | "help" | "greeting" | "unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "amount": "string or null",
    "address": "string or null",
    "recipient": "string or null",
    "currency": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "merchant": "string or null"
  }
}

User message: "${message}"

Response (JSON only):`;

  try {
    const geminiBody = {
      contents: [
        {
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent classification
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${GOOGLE_AI_URL}?key=${googleApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      console.warn("Gemini classification failed, using fallback");
      const { IntentClassifier } = await import("./intent-classifier");
      return IntentClassifier.classify(message);
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      const parsed = JSON.parse(content);
      
      // Validate and return
      return {
        intent: parsed.intent || "unknown",
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        rawCommand: message,
      } as ParsedIntent;
    } catch {
      // If JSON parsing fails, use fallback
      const { IntentClassifier } = await import("./intent-classifier");
      return IntentClassifier.classify(message);
    }
  } catch (error) {
    console.warn("Error in context-aware classification, using fallback:", error);
    const { IntentClassifier } = await import("./intent-classifier");
    return IntentClassifier.classify(message);
  }
}

