import { getMessageHistory } from "@/lib/ai/conversation-context";
import type { ChatMessage } from "@/types";

export interface ChatHistoryQuery {
  sessionId: string;
  userId?: string;
  limit?: number;
}

export class ChatHistoryManager {
  private readonly defaultLimit = 50;

  async getHistory(input: ChatHistoryQuery): Promise<ChatMessage[]> {
    const { sessionId, userId, limit } = input;
    if (!sessionId) {
      throw new Error("[ChatHistoryManager] sessionId is required");
    }

    // If we do not have a userId yet, there is no persisted history to load.
    if (!userId) {
      return [];
    }

    const history = await getMessageHistory(sessionId, userId);
    const max = limit ?? this.defaultLimit;
    const recent = history.slice(-max);

    return recent.map((msg) => ({
      id: `${sessionId}-${msg.timestamp}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));
  }
}



