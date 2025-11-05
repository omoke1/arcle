/**
 * Enhanced AI Agent Service
 * 
 * Implements multi-agent architecture with:
 * - Guardian Agent (main assistant)
 * - Specialized agents (scam detection, routing, chain-specific)
 * - Context management
 * - Function calling
 */

import { getAgentConfig, buildContextString, AgentContext, AgentConfig } from "./agent-prompts";
import { AIService } from "./ai-service";

export interface AgentResponse {
  message: string;
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  riskScore?: number;
  requiresConfirmation?: boolean;
  metadata?: Record<string, any>;
}

export class AgentService {
  private static contextHistory: Map<string, AgentContext> = new Map();

  /**
   * Process message with Guardian Agent
   */
  static async processWithGuardian(
    message: string,
    context: AgentContext,
    sessionId?: string
  ): Promise<AgentResponse> {
    // Store context for session
    if (sessionId) {
      this.contextHistory.set(sessionId, context);
    }

    // Get agent config
    const config = getAgentConfig("guardian");
    const contextString = buildContextString(context);

    // Build enhanced prompt with context
    const enhancedPrompt = config.systemPrompt.replace("{{context}}", contextString);

    // Use existing AI service with enhanced prompt
    // For now, we'll enhance the existing service
    // In production, this would call the LLM with the specialized prompt

    const aiResponse = await AIService.processMessage(message, {
      hasWallet: context.hasWallet,
      balance: context.balance,
      walletAddress: context.walletAddress,
    });

    return {
      message: aiResponse.message,
      requiresConfirmation: aiResponse.requiresConfirmation,
      riskScore: aiResponse.transactionPreview?.riskScore,
      metadata: {
        intent: aiResponse.intent.intent,
        confidence: aiResponse.intent.confidence,
      },
    };
  }

  /**
   * Analyze address with Scam Detection Agent
   */
  static async analyzeWithScamDetector(
    address: string,
    amount?: string
  ): Promise<AgentResponse> {
    const config = getAgentConfig("scam-detector");
    
    // Import risk scoring
    const { calculateRiskScore } = await import("@/lib/security/risk-scoring");
    const riskResult = await calculateRiskScore(address, amount);

    // Format response in agent style
    let message = `🔍 **Security Analysis**\n\n`;
    message += `Risk Score: **${riskResult.score}/100** (${riskResult.level.toUpperCase()})\n\n`;

    if (riskResult.reasons.length > 0) {
      message += `**Risk Factors:**\n`;
      riskResult.reasons.forEach((reason) => {
        message += `• ${reason}\n`;
      });
    }

    if (riskResult.blocked) {
      message += `\n⚠️ **BLOCKED**: This transaction has been blocked due to high risk.`;
    } else if (riskResult.score >= 40) {
      message += `\n⚠️ **WARNING**: Proceed with caution.`;
    } else {
      message += `\n✅ **SAFE**: Address appears safe to transact with.`;
    }

    return {
      message,
      riskScore: riskResult.score,
      requiresConfirmation: riskResult.score >= 40,
      metadata: {
        level: riskResult.level,
        blocked: riskResult.blocked,
        reasons: riskResult.reasons,
      },
    };
  }

  /**
   * Route transaction with Router Agent
   */
  static async routeTransaction(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    const config = getAgentConfig("router");
    
    // Use intent classifier to determine routing
    const { IntentClassifier } = await import("./intent-classifier");
    const intent = IntentClassifier.classify(message);

    // Determine handler based on intent
    let handler = "unknown";
    let requiresApproval = false;
    let subAccount = null;

    switch (intent.intent) {
      case "send":
      case "pay":
        handler = "send";
        // Check if amount is small enough for sub-account
        const amount = intent.entities.amount;
        if (amount && parseFloat(amount) <= 100) {
          subAccount = "auto"; // Auto-select sub-account if available
        }
        requiresApproval = amount ? parseFloat(amount) > 1000 : false;
        break;
      case "bridge":
        handler = "bridge";
        requiresApproval = true; // Always require approval for bridges
        break;
      case "schedule":
        handler = "schedule";
        requiresApproval = false;
        break;
      case "subscription":
        handler = "subscription";
        requiresApproval = true;
        break;
      default:
        handler = "unknown";
    }

    return {
      message: `Routing to ${handler} handler...`,
      toolCall: {
        name: handler,
        arguments: intent.entities,
      },
      requiresConfirmation: requiresApproval,
      metadata: {
        handler,
        subAccount,
        intent: intent.intent,
      },
    };
  }

  /**
   * Process with Chain Agent
   */
  static async processWithChainAgent(
    message: string,
    chain: "base" | "solana" | "arbitrum",
    context: AgentContext
  ): Promise<AgentResponse> {
    const config = getAgentConfig("chain-agent", chain);
    const contextString = buildContextString(context);

    // For MVP, return a placeholder response
    // In production, this would call the LLM with chain-specific prompt
    return {
      message: `${chain.charAt(0).toUpperCase() + chain.slice(1)} Agent: Feature coming soon. This agent will handle ${chain}-specific operations.`,
      metadata: {
        chain,
        status: "coming-soon",
      },
    };
  }

  /**
   * Get context for session
   */
  static getContext(sessionId: string): AgentContext | undefined {
    return this.contextHistory.get(sessionId);
  }

  /**
   * Update context for session
   */
  static updateContext(sessionId: string, updates: Partial<AgentContext>): void {
    const existing = this.contextHistory.get(sessionId) || {};
    this.contextHistory.set(sessionId, { ...existing, ...updates });
  }

  /**
   * Clear context for session
   */
  static clearContext(sessionId: string): void {
    this.contextHistory.delete(sessionId);
  }
}


