/**
 * Natural Language Generator
 * 
 * Uses Google Gemini to generate natural, conversational responses
 * with reasoning and context awareness
 */

import { buildContextString, type AgentContext } from "./agent-prompts";
import { getConversationSummary } from "./conversation-context";

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

export interface NaturalLanguageResponse {
  message: string;
  reasoning?: string;
  suggestions?: string[];
  followUpQuestions?: string[];
}

export interface GenerationContext {
  intent: string;
  action: string;
  data?: any;
  context?: AgentContext;
  userMessage: string;
  conversationHistory?: string;
  sessionId?: string;
  isMissingInfo?: boolean;
  missingFields?: string[];
}

/**
 * Generate natural language response with reasoning
 */
export async function generateNaturalResponse(
  generationContext: GenerationContext
): Promise<NaturalLanguageResponse> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY;

  if (!googleApiKey) {
    // Fallback to simple response if no API key
    return {
      message: generationContext.data?.message || "I understand. Let me help you with that.",
    };
  }

  const contextString = generationContext.context 
    ? buildContextString(generationContext.context)
    : "No wallet context available.";

  // Get conversation history if available
  const conversationHistory = generationContext.conversationHistory || 
    (generationContext.sessionId ? getConversationSummary(generationContext.sessionId, 10) : "");

  // Build a detailed prompt for natural language generation
  const systemPrompt = `You are ARCLE, a friendly and highly interactive AI wallet assistant. You're like ChatGPT - conversational, helpful, engaging, and proactive. You remember previous conversations and ask clarifying questions when needed.

CONVERSATION STYLE:
- Be conversational and natural, like chatting with a friend
- Ask follow-up questions when information is missing (don't just list requirements)
- Reference previous parts of the conversation when relevant
- Be proactive and helpful - suggest next steps
- Show personality and be engaging
- When information is missing, ask ONE clarifying question at a time (don't overwhelm)
- Use emojis sparingly and naturally
- Be concise but warm

ARCLE CAPABILITIES:
- **Scheduled Payments**: Schedule one-time payments for future dates/times (e.g., "Schedule $50 payment tomorrow at 3pm")
- **Invoices**: Create, list, and manage invoices (e.g., "Create invoice for $500 to Acme Corp")
- **Payment Rolls**: Automated payroll and recurring payments (e.g., "Create payment roll for my team")
- **Subscriptions**: Set up recurring payments (e.g., "Subscribe $10 monthly to Netflix")
- **Send/Pay**: Send USDC to addresses immediately
- **Balance**: Check wallet balance
- **Transaction History**: View past transactions
- **FX Conversion**: Convert between USDC and EURC
- **Multi-Currency**: View all currency balances
- **DeFi**: Yield farming, arbitrage, rebalancing, limit orders, liquidity aggregation, auto-compound
- **Cross-Border**: International remittances with FX rates
- **Trading**: Perpetual positions and derivatives
- **AI Agents**: Create autonomous agents for automated tasks

WALLET CONTEXT:
${contextString}

${conversationHistory ? `RECENT CONVERSATION HISTORY:\n${conversationHistory}\n\n` : ''}

USER'S CURRENT REQUEST:
${generationContext.userMessage}

WHAT HAPPENED:
Intent: ${generationContext.intent}
Action: ${generationContext.action}
${generationContext.data ? `Data: ${JSON.stringify(generationContext.data, null, 2)}` : ''}
${generationContext.isMissingInfo ? `\n⚠️ MISSING INFORMATION: The user's request is incomplete. Missing fields: ${generationContext.missingFields?.join(", ") || "unknown"}` : ''}

YOUR TASK:
${generationContext.isMissingInfo 
  ? `The user's request is incomplete. Instead of listing all requirements, ask ONE friendly, conversational clarifying question. Make it feel natural, like you're helping them complete their request. Example: "I'd be happy to help you schedule that payment! What time would you like it to go through?"`
  : `Generate a natural, conversational response that:
1. Acknowledges what the user asked for SPECIFICALLY (e.g., if they asked to "schedule a payment", acknowledge that you're scheduling it, not sending it immediately)
2. Explains what you're doing (or what happened) - be specific about the action
3. Explains WHY (your reasoning) - but keep it brief and natural
4. Provides helpful next steps or suggestions
5. Uses a friendly, conversational tone (like chatting with a friend)
6. References previous conversation if relevant
7. If the user asked for a scheduled payment, invoice, or payment roll, make sure your response reflects that specific feature, not a generic payment response`}

RESPONSE FORMAT (JSON):
{
  "message": "Your natural, conversational response to the user",
  "reasoning": "Brief explanation of why you're doing this (optional, keep it short)",
  "suggestions": ["Helpful suggestion 1", "Helpful suggestion 2"] (optional),
  "followUpQuestions": ["Natural follow-up question 1"] (optional, use when missing info)
}

EXAMPLES:

Example 1 - Balance Check:
{
  "message": "Your current balance is $125.50 USDC on Arc. I checked this because you asked, and I want to make sure you have accurate information before any transactions.",
  "reasoning": "User requested balance information, so I queried the wallet to get the latest balance.",
  "suggestions": ["Would you like to send some USDC?", "Check your transaction history?"]
}

Example 2 - Send Transaction:
{
  "message": "Got it! I'm preparing to send $50 USDC to 0x742d...f0bEb. I've checked the address and it looks valid. The transaction will cost about $0.01 in fees. Should I proceed?",
  "reasoning": "User wants to send funds, so I validated the address, calculated fees, and prepared the transaction for confirmation.",
  "suggestions": ["Confirm to proceed", "Check transaction history after sending"]
}

Example 3 - New Wallet Warning:
{
  "message": "I notice this is a new address you haven't sent to before. I'm being extra careful here because new addresses can sometimes be risky. I've verified the address format is correct, but please double-check this is the right recipient before we proceed.",
  "reasoning": "Safety first - new addresses require extra verification to protect the user from mistakes or scams.",
  "suggestions": ["Confirm if this is correct", "Cancel if you need to verify"]
}

Example 4 - Scheduled Payment:
{
  "message": "Perfect! I've scheduled a payment of $50 USDC to 0x742d...f0bEb for tomorrow at 3pm. This is a scheduled payment, so it won't execute immediately - I'll automatically send it at the scheduled time. You can cancel it anytime before then if needed.",
  "reasoning": "User asked to schedule a payment, so I created a scheduled payment entry that will execute automatically at the specified time, rather than sending immediately.",
  "suggestions": ["View your scheduled payments", "Cancel this payment if needed"]
}

Example 5 - Invoice Creation:
{
  "message": "I've created an invoice for $500 USDC to Acme Corp, due in 30 days. This invoice is now in your system and you can track its payment status. When they pay, I'll automatically match it to this invoice.",
  "reasoning": "User asked to create an invoice, so I created an invoice record that can be tracked and matched to payments later.",
  "suggestions": ["View all invoices", "Send invoice to recipient"]
}

Example 6 - Missing Information (Ask One Question):
{
  "message": "I'd be happy to schedule that payment for you! I have the amount ($50) and the address, but I need to know when you'd like it to go through. What date and time works for you?",
  "followUpQuestions": ["What date and time would you like the payment scheduled for?"]
}

Example 7 - Conversational Follow-up:
{
  "message": "Got it! I see you mentioned $100 earlier. Would you like me to schedule that payment to the same address we discussed, or is this a different transaction?",
  "reasoning": "User is continuing a previous conversation, so I'm referencing what we talked about before.",
  "suggestions": ["Use the previous address", "Enter a new address"]
}

Now generate a response following this format. Be conversational, engaging, and helpful - like ChatGPT!`;

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
        temperature: 0.8, // Higher for more natural, creative conversation
        maxOutputTokens: 1000, // More tokens for richer responses
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
      console.warn("Google AI error, using fallback:", res.status);
      return {
        message: generationContext.data?.message || "I understand. Let me help you with that.",
      };
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      const parsed = JSON.parse(content);
      return {
        message: parsed.message || generationContext.data?.message || "I understand. Let me help you with that.",
        reasoning: parsed.reasoning,
        suggestions: parsed.suggestions,
        followUpQuestions: parsed.followUpQuestions,
      };
    } catch {
      // If JSON parsing fails, use the raw content as message
      return {
        message: content || generationContext.data?.message || "I understand. Let me help you with that.",
      };
    }
  } catch (error) {
    console.warn("Error generating natural response, using fallback:", error);
    return {
      message: generationContext.data?.message || "I understand. Let me help you with that.",
    };
  }
}

/**
 * Enhance an existing message with natural language and reasoning
 */
export async function enhanceMessageWithReasoning(
  baseMessage: string,
  intent: string,
  action: string,
  context?: AgentContext,
  userMessage?: string
): Promise<string> {
  const enhanced = await generateNaturalResponse({
    intent,
    action,
    data: { message: baseMessage },
    context,
    userMessage: userMessage || "",
  });

  // Combine base message with reasoning if available
  if (enhanced.reasoning) {
    return `${enhanced.message}\n\n*${enhanced.reasoning}*`;
  }

  return enhanced.message;
}

