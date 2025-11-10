/**
 * Conversation Context Manager
 * 
 * Maintains conversation history and pending actions for context-aware responses
 */

export interface PendingAction {
  type: "convert" | "send" | "pay" | "bridge" | "trade" | "invoice" | "remittance" | "perpetual" | "agent";
  data: any;
  timestamp: number;
  messageId?: string;
}

export interface ConversationContext {
  sessionId: string;
  pendingAction?: PendingAction;
  lastIntent?: string;
  conversationHistory: Array<{
    role: "user" | "assistant";
    message: string;
    timestamp: number;
  }>;
}

// Store conversation contexts in memory (in production, use Redis or database)
const conversationContexts = new Map<string, ConversationContext>();

/**
 * Get or create conversation context
 */
export function getConversationContext(sessionId: string): ConversationContext {
  if (!conversationContexts.has(sessionId)) {
    conversationContexts.set(sessionId, {
      sessionId,
      conversationHistory: [],
    });
  }
  return conversationContexts.get(sessionId)!;
}

/**
 * Update conversation context
 */
export function updateConversationContext(
  sessionId: string,
  updates: Partial<ConversationContext>
): ConversationContext {
  const context = getConversationContext(sessionId);
  const updated = { ...context, ...updates };
  conversationContexts.set(sessionId, updated);
  return updated;
}

/**
 * Add message to conversation history
 */
export function addMessageToHistory(
  sessionId: string,
  role: "user" | "assistant",
  message: string
): void {
  const context = getConversationContext(sessionId);
  context.conversationHistory.push({
    role,
    message,
    timestamp: Date.now(),
  });
  
  // Keep only last 20 messages to avoid memory issues
  if (context.conversationHistory.length > 20) {
    context.conversationHistory = context.conversationHistory.slice(-20);
  }
  
  conversationContexts.set(sessionId, context);
}

/**
 * Set pending action
 */
export function setPendingAction(
  sessionId: string,
  action: PendingAction
): void {
  const context = getConversationContext(sessionId);
  context.pendingAction = action;
  conversationContexts.set(sessionId, context);
}

/**
 * Clear pending action
 */
export function clearPendingAction(sessionId: string): void {
  const context = getConversationContext(sessionId);
  context.pendingAction = undefined;
  conversationContexts.set(sessionId, context);
}

/**
 * Get recent conversation summary for context
 */
export function getConversationSummary(sessionId: string, maxMessages: number = 5): string {
  const context = getConversationContext(sessionId);
  const recent = context.conversationHistory.slice(-maxMessages);
  
  if (recent.length === 0) {
    return "";
  }
  
  return recent.map(msg => `${msg.role === "user" ? "User" : "ARCLE"}: ${msg.message}`).join("\n");
}

