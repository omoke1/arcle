/**
 * Training Data for AI Agents
 * 
 * Contains examples for fine-tuning and prompt engineering
 */

export interface TrainingExample {
  input: string;
  output: string;
  intent: string;
  context?: Record<string, any>;
}

/**
 * Guardian Agent Training Examples
 */
export const GUARDIAN_TRAINING_EXAMPLES: TrainingExample[] = [
  // Send transactions
  {
    input: "Send 50 USDC to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    output: JSON.stringify({
      reply: "I'll send 50 USDC to that address. Let me check the security first...",
      tool: { name: "send", arguments: { amount: "50", to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" } },
    }),
    intent: "send",
  },
  {
    input: "I want to pay my friend 100 dollars",
    output: JSON.stringify({
      reply: "I'd be happy to send 100 USDC! What's your friend's wallet address?",
      tool: { name: "send", arguments: { amount: "100", to: null } },
    }),
    intent: "send",
  },
  {
    input: "Transfer 25 bucks to 0x123...",
    output: JSON.stringify({
      reply: "I'll transfer 25 USDC. Verifying the address...",
      tool: { name: "send", arguments: { amount: "25", to: "0x123..." } },
    }),
    intent: "send",
  },

  // Balance queries
  {
    input: "How much do I have?",
    output: JSON.stringify({
      reply: "Your current balance is 1,234.56 USDC on Arc.",
      tool: { name: "balance", arguments: {} },
    }),
    intent: "balance",
  },
  {
    input: "What's my wallet balance?",
    output: JSON.stringify({
      reply: "You have 1,234.56 USDC in your Arc wallet.",
      tool: { name: "balance", arguments: {} },
    }),
    intent: "balance",
  },
  {
    input: "Check my balance",
    output: JSON.stringify({
      reply: "Your Arc wallet balance is 1,234.56 USDC.",
      tool: { name: "balance", arguments: {} },
    }),
    intent: "balance",
  },

  // Address requests
  {
    input: "What's my address?",
    output: JSON.stringify({
      reply: "Here's your wallet address: 0x...",
      tool: { name: "address", arguments: {} },
    }),
    intent: "address",
  },
  {
    input: "Show me my wallet address",
    output: JSON.stringify({
      reply: "Your wallet address is: 0x...",
      tool: { name: "address", arguments: {} },
    }),
    intent: "address",
  },

  // Scam detection
  {
    input: "Is 0x123... safe?",
    output: JSON.stringify({
      reply: "Let me analyze that address for security risks...",
      tool: { name: "scan", arguments: { address: "0x123..." } },
    }),
    intent: "scan",
  },
  {
    input: "Check if this address is a scam: 0xabc...",
    output: JSON.stringify({
      reply: "I'll perform a security analysis on that address...",
      tool: { name: "scan", arguments: { address: "0xabc..." } },
    }),
    intent: "scan",
  },

  // Scheduling
  {
    input: "Schedule a payment of 50 USDC every month",
    output: JSON.stringify({
      reply: "I'll set up a monthly payment of 50 USDC. What date should it run?",
      tool: { name: "schedule", arguments: { amount: "50", frequency: "monthly" } },
    }),
    intent: "schedule",
  },
  {
    input: "Pay my rent $1200 on the 1st",
    output: JSON.stringify({
      reply: "I'll schedule a payment of 1,200 USDC on the 1st of each month. What's the recipient address?",
      tool: { name: "schedule", arguments: { amount: "1200", date: "1", frequency: "monthly" } },
    }),
    intent: "schedule",
  },

  // Subscriptions
  {
    input: "Set up a subscription for Netflix, 15 dollars monthly",
    output: JSON.stringify({
      reply: "I'll create a monthly subscription for Netflix at $15 USDC. Should I enable auto-renew?",
      tool: { name: "subscription", arguments: { merchant: "Netflix", amount: "15", frequency: "monthly" } },
    }),
    intent: "subscription",
  },

  // Greetings
  {
    input: "Hello",
    output: JSON.stringify({
      reply: "Hello! I'm ARCLE, your AI wallet assistant. How can I help you today?",
      tool: { name: "null", arguments: {} },
    }),
    intent: "greeting",
  },
  {
    input: "Hi there",
    output: JSON.stringify({
      reply: "Hi! I'm here to help you manage your Arc wallet. What would you like to do?",
      tool: { name: "null", arguments: {} },
    }),
    intent: "greeting",
  },

  // Help
  {
    input: "What can you do?",
    output: JSON.stringify({
      reply: "I can help you:\n• Send and receive USDC\n• Check your balance\n• View transaction history\n• Bridge assets across chains\n• Schedule payments\n• Detect scams\n• Manage subscriptions\n\nJust ask me what you'd like to do!",
      tool: { name: "null", arguments: {} },
    }),
    intent: "help",
  },
];

/**
 * Scam Detection Training Examples
 */
export const SCAM_DETECTION_EXAMPLES: TrainingExample[] = [
  {
    input: "Analyze 0x0000000000000000000000000000000000000000",
    output: JSON.stringify({
      riskScore: 100,
      level: "high",
      reasons: ["Invalid zero address"],
      blocked: true,
      recommendation: "Do not proceed with this transaction.",
    }),
    intent: "scan",
  },
  {
    input: "Check 0xNewContract123...",
    output: JSON.stringify({
      riskScore: 75,
      level: "high",
      reasons: ["New contract (2 days old)", "Contract not verified"],
      blocked: false,
      recommendation: "Proceed with extreme caution. This contract is very new and unverified.",
    }),
    intent: "scan",
  },
];

/**
 * Get training examples for a specific intent
 */
export function getTrainingExamples(intent: string): TrainingExample[] {
  switch (intent) {
    case "guardian":
      return GUARDIAN_TRAINING_EXAMPLES;
    case "scam-detection":
      return SCAM_DETECTION_EXAMPLES;
    default:
      return [];
  }
}

/**
 * Format examples for prompt injection
 */
export function formatExamplesForPrompt(examples: TrainingExample[], maxExamples: number = 5): string {
  let formatted = "\n\nFew-shot Examples:\n";
  examples.slice(0, maxExamples).forEach((example, i) => {
    formatted += `\nExample ${i + 1}:\n`;
    formatted += `Input: ${example.input}\n`;
    formatted += `Output: ${example.output}\n`;
  });
  return formatted;
}


