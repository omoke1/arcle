import { NextRequest, NextResponse } from "next/server";
import { loadMessages } from "@/lib/supabase-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId"); // currently used only for logging / future auth

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
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    // In the current v1, we trust the provided sessionId. In a future iteration,
    // we should bind sessionId to userId and enforce access control here.
    const supabaseMessages = await loadMessages(targetSessionId, { limit: 50 });

    const messages = supabaseMessages.map((msg) => ({
      id: msg.id,
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
      // Return ISO timestamp; client can convert to Date.
      timestamp: msg.createdAt,
    }));

    return NextResponse.json({
      success: true,
      sessionId: targetSessionId,
      userId: userId || null,
      messages,
    });
  } catch (error: any) {
    console.error("[ChatHistory] Error loading history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load chat history" },
      { status: 500 }
    );
  }
}

