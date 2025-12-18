import { NextRequest, NextResponse } from "next/server";
import { loadMessages } from "@/lib/supabase-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId"); // currently used only for logging / future auth

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    // In the current v1, we trust the provided sessionId. In a future iteration,
    // we should bind sessionId to userId and enforce access control here.

    const supabaseMessages = await loadMessages(sessionId, { limit: 50 });

    const messages = supabaseMessages.map((msg) => ({
      id: msg.id,
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
      // Return ISO timestamp; client can convert to Date.
      timestamp: msg.createdAt,
    }));

    return NextResponse.json({
      success: true,
      sessionId,
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

