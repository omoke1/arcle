import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { groq } from "@ai-sdk/groq";
import { getAgentConfig, buildContextString, type AgentContext } from "@/lib/ai/agent-prompts";
import { getConversationSummary, addMessageToHistory } from "@/lib/ai/conversation-context";
import { rateLimit } from "@/lib/api/rate-limit";

/**
 * Streaming Chat API Route for Vercel AI SDK
 * 
 * This route provides a streaming-compatible endpoint that works with useChat hook.
 * It wraps the existing AI logic but returns streaming responses.
 */
export async function POST(req: NextRequest) {
  try {
    // Basic IP-based rate limiting to protect /api/chat
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const rl = await rateLimit(`chat:${ip}`, 60, 60); // 60 requests per minute per IP
    if (!rl.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "Rate limit exceeded. Please slow down and try again shortly.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
      );
    }

    const { messages, context, sessionId, userId, tier = "basic" } = await req.json();
    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!groqApiKey) {
      return new Response(
        JSON.stringify({ error: "GROQ_API_KEY is not set" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create session ID
    const currentSessionId = sessionId || `session_${Date.now()}`;

    // Get conversation history for context
    const conversationHistory = await getConversationSummary(currentSessionId, 5, userId);

    // Build agent context
    const agentContext: AgentContext = {
      hasWallet: context?.hasWallet,
      balance: context?.balance,
      walletAddress: context?.walletAddress,
      walletId: context?.walletId,
    };

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    const userMsg = String(lastMessage?.content || "").slice(0, 5000);

    // Add user message to history
    if (userMsg) {
      await addMessageToHistory(currentSessionId, "user", userMsg, userId);
    }

    // Build system prompt with tier
    const config = getAgentConfig("guardian", undefined, tier as "basic" | "advance" | "pro");
    const contextString = buildContextString(agentContext);
    let systemPrompt = config.systemPrompt.replace("{{context}}", contextString);

    if (conversationHistory) {
      systemPrompt += `\n\n📝 RECENT CONVERSATION HISTORY:\n${conversationHistory}\n`;
      systemPrompt += `\nIMPORTANT: Remember the context from previous messages. Reference past conversations when relevant.`;
    }

    // Format messages for Groq (convert from Vercel AI SDK format)
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Use Vercel AI SDK's streamText with Groq
    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: formattedMessages,
      temperature: 0.3,
      maxTokens: 1000,
      onFinish: async (event) => {
        try {
          if (event.text) {
            await addMessageToHistory(currentSessionId, "assistant", event.text, userId);
          }
        } catch (err) {
          console.error("[Chat API] Failed to save assistant message:", err);
        }
      },
    } as any); // Type assertion needed due to Groq provider type differences

    // Return streaming response
    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("[Chat API] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "AI error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

