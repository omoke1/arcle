import { NextRequest, NextResponse } from "next/server";
import { ChatHistoryManager } from "@/lib/chat/chat-history-manager";

const historyManager = new ChatHistoryManager();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId") || undefined;

    let targetSessionId = sessionId;

    // Use userId to find latest session if sessionId is missing
    if (!targetSessionId && userId) {
      const { getLastSessionForUser } = await import("@/lib/supabase-data");
      const lastSession = await getLastSessionForUser(userId);
      if (lastSession) {
        targetSessionId = lastSession.id;
        console.log(`[ChatHistory] Found last session for user ${userId}: ${targetSessionId}`);
      }
    }

    if (!targetSessionId) {
      // If we still don't have a session ID, we can't load history
      // But for new users this is expected (empty history)
      if (userId) {
        return NextResponse.json({ messages: [] });
      }
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const messages = await historyManager.getHistory({
      sessionId: targetSessionId,
      userId,
    });

    return NextResponse.json({ messages });
  } catch (error: any) {
    console.error("[ChatHistory] Failed to load history:", error);
    return NextResponse.json(
      { error: "Failed to load chat history" },
      { status: 500 }
    );
  }
}



