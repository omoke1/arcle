/**
 * Claude AI Response Generator
 * 
 * Uses Anthropic Claude 3.5 Sonnet for structured, formatted responses
 * that match the Google Doc style exactly
 * 
 * NOTE: This file is prepared but not yet active.
 * To enable: Install @anthropic-ai/sdk and uncomment the import below.
 */

// Uncomment when ready to use Claude:
// import Anthropic from '@anthropic-ai/sdk';

// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

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
  context?: {
    hasWallet?: boolean;
    balance?: string;
    walletAddress?: string;
    walletId?: string;
  };
  userMessage: string;
  conversationHistory?: string;
  sessionId?: string;
  isMissingInfo?: boolean;
  missingFields?: string[];
}

/**
 * System prompt that enforces the exact response style from Google Doc
 */
const SYSTEM_PROMPT = `You are ARCLE, an AI financial assistant. You help users with payments, remittances, forex trading, and business finances.

RESPONSE STYLE REQUIREMENTS (CRITICAL - FOLLOW EXACTLY):

1. EMOJI USAGE (Required):
   - 💰 Money/Amount
   - ⚡ Speed/Instant
   - 📊 Data/Analytics
   - 🇵🇭 Country flags (use appropriate flag for country)
   - 💵 Payment
   - 📱 Phone/SMS
   - 📧 Email
   - 🏦 Bank
   - ⏰ Time/Schedule
   - ✅ Success
   - ⚠️ Warning
   - 📈 Growth/Yield
   - 💼 Business
   - 🎯 Goal/Target
   - 🔄 Recurring
   - 📄 Invoice
   - 👥 Team/Payroll

2. STRUCTURED FORMAT (Required):
   Always format responses like this:

   [Main message with emoji]
   
   [Section 1 with emoji]
   • Detail 1
   • Detail 2
   
   [Section 2 with emoji]
   • Detail 1
   • Detail 2
   
   [Options/Confirmation]
   [Yes] [No] [Customize]

3. COST COMPARISONS (Required when applicable):
   Always show:
   - Current cost: $X
   - Traditional cost: $Y
   - Savings: $Z/year
   
   Format: "💰 Fee: $0.15 (vs $40 with Western Union)"
   Format: "💵 You saved: $244.95"
   Format: "📊 Total yearly benefit: $382.50"

4. CONFIRMATION BUTTONS (Required):
   Format: "Confirm? [Yes] [No] [Customize]"
   Format: "Execute? [Yes] [No] [Set limit order]"
   Format: "Activate? [Yes] [No] [Customize]"

5. CALCULATIONS (Required):
   Always show math:
   "💵 Monthly earnings: ~$187.50
    💵 Annual earnings: ~$2,250"
   
   Show breakdowns:
   "📊 Breakdown:
    • Amount: $500
    • Fee: $0.15
    • Total: $500.15"

6. MULTIPLE OPTIONS (Required):
   Format:
   "Options:
    1️⃣ Option 1
    2️⃣ Option 2
    3️⃣ Option 3"
   
   Or:
   "Options:
    • Option 1
    • Option 2
    • Option 3"

7. PROGRESS INDICATORS (When applicable):
   Format:
   "✅ Processing 15 payments...
    [Progress: ████████░░ 80%]
    ✅ Payroll complete! All 15 paid in 4.2 seconds"

EXAMPLES:

Example 1 - Remittance:
"🤖 Arcle: I can help you send money to the Philippines instantly!

          💵 Amount: $500 USDC
          🇵🇭 Destination: Philippines
          ⚡ Arrival time: Under 30 seconds
          💰 Fee: $0.15 (vs $40 with Western Union)
          
          Does your mom have a wallet address, or should I send 
          to her phone number/email?"

Example 2 - Payment Confirmation:
"🤖 Arcle: Perfect! I'll send 500 USDC to that number.
          She'll get an SMS with instructions to claim it.
          She can withdraw to her local bank or keep as USDC.
          
          Confirm? [Yes] [No]"

Example 3 - Multiple Options:
"🤖 Arcle: Here are your options:

          1️⃣ Pay now at current rate
          2️⃣ Set limit order for better rate
          3️⃣ Split payment schedule
          
          What works best?"

Example 4 - Cost Comparison:
"🤖 Arcle: Great news! Here's what you'll save:

          💰 Our fee: $0.15
          💰 Traditional: $40
          💵 You save: $39.85 per transaction
          📊 Yearly savings (12x/month): $478.20
          
          Confirm? [Yes] [No]"

Example 5 - Calculations:
"🤖 Arcle: Here's the breakdown:

          💵 Amount: $50,000 USDC
          📊 Rate: 4.5% APY
          💵 Monthly earnings: ~$187.50
          💵 Annual earnings: ~$2,250
          
          Features:
          ✅ Withdraw anytime
          ✅ Interest paid daily
          ✅ Protected by Circle
          
          Activate? [Yes] [No]"

NEVER:
- Use technical jargon (CCTP, Circle, smart contracts, APIs, blockchain)
- Say "I don't understand" - always try to help
- Skip emojis in structured responses
- Forget cost comparisons when applicable
- Skip confirmation buttons when action is needed
- Use markdown formatting (**bold**, *italic*)
- Use code blocks or technical terms

ALWAYS:
- Use emojis for visual sections
- Show cost comparisons when relevant
- Provide confirmation buttons for actions
- Show calculations and breakdowns
- Present multiple options clearly
- Be warm and conversational
- Use simple, user-friendly language
- Focus on benefits, not technical details

CONTEXT:
{{context}}

Remember: You're helping real people with real money. Be accurate, helpful, and always show the value they're getting.`;

/**
 * Generate natural language response using Claude
 */
export async function generateClaudeResponse(
  generationContext: GenerationContext
): Promise<NaturalLanguageResponse> {
  // NOTE: Claude integration not yet active
  // To enable: Install @anthropic-ai/sdk and uncomment the code below
  
  // Fallback - return simple message until Claude is enabled
  return {
    message: generationContext.data?.message || "I understand. Let me help you with that.",
  };
  
  /* Uncomment when ready to use Claude:
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Fallback if no API key
    return {
      message: generationContext.data?.message || "I understand. Let me help you with that.",
    };
  }

  // Build context string
  const contextParts: string[] = [];
  
  if (generationContext.context) {
    if (generationContext.context.hasWallet) {
      contextParts.push(`- User has a wallet`);
      if (generationContext.context.balance) {
        contextParts.push(`- Current balance: ${generationContext.context.balance} USDC`);
      }
      if (generationContext.context.walletAddress) {
        contextParts.push(`- Wallet address: ${generationContext.context.walletAddress.substring(0, 10)}...`);
      }
    } else {
      contextParts.push(`- User does not have a wallet yet`);
    }
  }

  const contextString = contextParts.length > 0 
    ? contextParts.join('\n')
    : "No wallet context available.";

  // Build user message
  let userMessage = `User: ${generationContext.userMessage || ""}\n\n`;

  if (generationContext.intent) {
    userMessage += `Intent: ${generationContext.intent}\n`;
  }
  
  if (generationContext.action) {
    userMessage += `Action: ${generationContext.action}\n`;
  }

  if (generationContext.data?.message) {
    userMessage += `\nBase Message: ${generationContext.data.message}\n`;
  }

  if (generationContext.isMissingInfo && generationContext.missingFields) {
    userMessage += `\nMissing Information: ${generationContext.missingFields.join(', ')}\n`;
    userMessage += `Ask ONE clarifying question to get the missing information.\n`;
  }

  // Replace context placeholder in system prompt
  const systemPrompt = SYSTEM_PROMPT.replace('{{context}}', contextString);

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7, // Balanced creativity and consistency
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const content = message.content[0];
    
    if (content.type === 'text') {
      const responseText = content.text;
      
      // Parse structured response (Claude should follow format, but we can extract if needed)
      return {
        message: responseText,
        // Claude will include reasoning/suggestions in the message itself
        // We can extract them if needed, but the format should be self-contained
      };
    }

    return {
      message: generationContext.data?.message || "I understand. Let me help you with that.",
    };
  } catch (error: any) {
    console.error("Claude API error:", error);
    
    // Fallback response
    return {
      message: generationContext.data?.message || "I understand. Let me help you with that.",
    };
  }
  */
}

/**
 * Calculate savings for cost comparison
 */
export function calculateSavings(
  currentFee: number,
  traditionalFee: number,
  frequency: 'one-time' | 'monthly' | 'yearly' = 'one-time'
): {
  perTransaction: number;
  perYear: number;
  percentage: number;
} {
  const perTransaction = traditionalFee - currentFee;
  
  let perYear = 0;
  if (frequency === 'monthly') {
    perYear = perTransaction * 12;
  } else if (frequency === 'yearly') {
    perYear = perTransaction;
  } else {
    perYear = perTransaction; // One-time
  }
  
  const percentage = traditionalFee > 0 
    ? ((traditionalFee - currentFee) / traditionalFee) * 100 
    : 0;
  
  return {
    perTransaction,
    perYear,
    percentage: Math.round(percentage),
  };
}

/**
 * Format structured response with emojis and sections
 */
export interface StructuredResponse {
  mainMessage: string;
  sections?: Array<{
    emoji: string;
    title: string;
    items: string[];
  }>;
  options?: string[];
  confirmationButtons?: string[];
  costComparison?: {
    current: string;
    traditional: string;
    savings: string;
  };
  calculations?: Array<{
    label: string;
    value: string;
  }>;
}

export function formatStructuredResponse(response: StructuredResponse): string {
  let formatted = `🤖 Arcle: ${response.mainMessage}\n\n`;
  
  // Add sections
  if (response.sections) {
    response.sections.forEach(section => {
      formatted += `          ${section.emoji} ${section.title}\n`;
      section.items.forEach(item => {
        formatted += `          • ${item}\n`;
      });
      formatted += `\n`;
    });
  }
  
  // Add calculations
  if (response.calculations) {
    response.calculations.forEach(calc => {
      formatted += `          ${calc.label}: ${calc.value}\n`;
    });
    formatted += `\n`;
  }
  
  // Add cost comparison
  if (response.costComparison) {
    formatted += `          💰 Fee: ${response.costComparison.current} (vs ${response.costComparison.traditional})\n`;
    formatted += `          💵 You saved: ${response.costComparison.savings}\n\n`;
  }
  
  // Add options
  if (response.options) {
    formatted += `          Options:\n\n`;
    response.options.forEach((option, index) => {
      const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][index] || '•';
      formatted += `          ${emoji} ${option}\n`;
    });
    formatted += `\n`;
  }
  
  // Add confirmation buttons
  if (response.confirmationButtons) {
    formatted += `          `;
    formatted += response.confirmationButtons.map(btn => `[${btn}]`).join(' ');
  }
  
  return formatted;
}

