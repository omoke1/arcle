/**
 * Conversation Context Manager
 *
 * Maintains conversation history and pending actions for context-aware responses
 */

import {
  createSession,
  loadMessages,
  loadSession,
  saveMessage,
  updateSession,
} from "@/lib/supabase-data";

export interface PendingAction {
  type:
    | "convert"
    | "send"
    | "pay"
    | "bridge"
    | "trade"
    | "invoice"
    | "remittance"
    | "perpetual"
    | "agent"
    | "schedule"
    | "subscription";
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

const MAX_HISTORY = 50;

// Store conversation contexts in memory for quick access while persisting in Supabase.
const conversationContexts = new Map<string, ConversationContext>();

async function hydrateFromSupabase(sessionId: string, userId?: string): Promise<ConversationContext | null> {
  if (!userId) return null;

  let session = await loadSession(sessionId);
  if (!session) {
    session = await createSession({ id: sessionId, userId, agentState: {} });
  }

  const messages = await loadMessages(sessionId, { limit: MAX_HISTORY });
  const conversationHistory = messages.map((msg) => ({
    role: (msg.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    message: msg.content,
    timestamp: new Date(msg.createdAt).getTime(),
  }));

  const agentState = session.agentState || {};

  return {
    sessionId: session.id,
    pendingAction: agentState.pendingAction,
    lastIntent: agentState.lastIntent,
    conversationHistory,
  };
}

async function persistContext(sessionId: string, context: ConversationContext, userId?: string) {
  if (!userId) return;

  try {
    await updateSession(sessionId, {
      pendingAction: context.pendingAction,
      lastIntent: context.lastIntent,
    });
  } catch (error) {
    console.warn("[Conversation Context] Failed to persist session state:", error);
  }
}

export async function getConversationContext(sessionId: string, userId?: string): Promise<ConversationContext> {
  if (conversationContexts.has(sessionId)) {
    return conversationContexts.get(sessionId)!;
  }

  const hydrated = await hydrateFromSupabase(sessionId, userId);
  if (hydrated) {
    conversationContexts.set(sessionId, hydrated);
    return hydrated;
  }

  const fallback: ConversationContext = {
    sessionId,
    conversationHistory: [],
  };
  conversationContexts.set(sessionId, fallback);
  return fallback;
}

export async function updateConversationContext(
  sessionId: string,
  updates: Partial<ConversationContext>,
  userId?: string
): Promise<ConversationContext> {
  const context = await getConversationContext(sessionId, userId);
  const updated = { ...context, ...updates };
  conversationContexts.set(sessionId, updated);
  await persistContext(sessionId, updated, userId);
  return updated;
}

export async function addMessageToHistory(
  sessionId: string,
  role: "user" | "assistant",
  message: string,
  userId?: string
): Promise<void> {
  const context = await getConversationContext(sessionId, userId);
  context.conversationHistory.push({
    role,
    message,
    timestamp: Date.now(),
  });

  if (context.conversationHistory.length > MAX_HISTORY) {
    context.conversationHistory = context.conversationHistory.slice(-MAX_HISTORY);
  }

  conversationContexts.set(sessionId, context);

  if (userId) {
    try {
      await saveMessage({ sessionId, role, content: message });
    } catch (error) {
      console.warn("[Conversation Context] Failed to save message:", error);
    }
  }
}

export async function setPendingAction(sessionId: string, action: PendingAction, userId?: string): Promise<void> {
  const context = await getConversationContext(sessionId, userId);
  context.pendingAction = action;
  conversationContexts.set(sessionId, context);
  await persistContext(sessionId, context, userId);
  console.log("[Conversation Context] Pending action set:", action.type, action.data);
}

export async function clearPendingAction(sessionId: string, userId?: string): Promise<void> {
  const context = await getConversationContext(sessionId, userId);
  context.pendingAction = undefined;
  conversationContexts.set(sessionId, context);
  await persistContext(sessionId, context, userId);
  console.log("[Conversation Context] Pending action cleared");
}

export async function getConversationSummary(sessionId: string, maxMessages: number = 5, userId?: string): Promise<string> {
  const context = await getConversationContext(sessionId, userId);
  const recent = context.conversationHistory.slice(-maxMessages);

  if (recent.length === 0) {
    return "";
  }

  return recent.map((msg) => `${msg.role === "user" ? "User" : "ARCLE"}: ${msg.message}`).join("\n");
}

export async function getMessageHistory(
  sessionId: string,
  userId?: string
): Promise<Array<{ role: "user" | "assistant"; content: string; timestamp: number }>> {
  const context = await getConversationContext(sessionId, userId);
  return context.conversationHistory.map((msg) => ({
    role: msg.role,
    content: msg.message,
    timestamp: msg.timestamp,
  }));
}

