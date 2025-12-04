import { NextRequest, NextResponse } from "next/server";
import { ChatHistoryManager } from "@/lib/chat/chat-history-manager";

const historyManager = new ChatHistoryManager();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId") || undefined;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const messages = await historyManager.getHistory({
      sessionId,
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



