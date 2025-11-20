import { NextRequest, NextResponse } from "next/server";
// Groq AI route (Llama 3.3 70B)
import Groq from "groq-sdk";
import { getAgentConfig, buildContextString, type AgentContext, type AgentConfig } from "@/lib/ai/agent-prompts";
import { getConversationContext, addMessageToHistory, getConversationSummary } from "@/lib/ai/conversation-context";

/**
 * Enhanced system prompt with few-shot examples and conversation memory
 */
function buildSystemPrompt(context: AgentContext, conversationHistory?: string): string {
  const config = getAgentConfig("guardian");
  const contextString = buildContextString(context);
  
  // Build prompt with few-shot examples
  let prompt = config.systemPrompt.replace("{{context}}", contextString);
  
  // Add conversation history if available
  if (conversationHistory) {
    prompt += `\n\n📝 RECENT CONVERSATION HISTORY:\n${conversationHistory}\n`;
    prompt += `\nIMPORTANT: Remember the context from previous messages. Reference past conversations when relevant. If the user mentions "it", "that", "them", etc., refer back to what they were talking about earlier.`;
  }
  
  // Add few-shot examples
  if (config.fewShotExamples && config.fewShotExamples.length > 0) {
    prompt += "\n\n💡 RESPONSE EXAMPLES (use these as guidance for style and structure):\n";
    config.fewShotExamples.slice(0, 6).forEach((example: { input: string; output: string }, i: number) => {
      prompt += `\n${i + 1}. User: "${example.input}"\n   Assistant: ${example.output}\n`;
    });
  }
  
  prompt += `\n\n⚠️ CRITICAL: Always return valid JSON matching this schema:\n`;
  prompt += `{\n`;
  prompt += `  "reply": string (your conversational response with emojis, structure, cost comparisons, and confirmation buttons as shown in examples),\n`;
  prompt += `  "tool": {\n`;
  prompt += `    "name": "send|balance|address|history|scan|schedule|subscription|faucet|bridge|null",\n`;
  prompt += `    "arguments": { "to": string?, "amount": string?, "address": string?, "date": string?, "time": string?, "frequency": string?, "merchant": string?, "chain": string? }\n`;
  prompt += `  }\n`;
  prompt += `}\n\n`;
  prompt += `Remember: Your "reply" should be HIGHLY STRUCTURED with emojis, sections, cost comparisons, and confirmation buttons like the examples above!`;
  
  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { message, context, sessionId } = await req.json();
    const groqApiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!groqApiKey) {
      return NextResponse.json(
        { success: false, error: "GROQ_API_KEY is not set. Please configure it in your environment." },
        { status: 500 }
      );
    }

    // Get or create session ID
    const currentSessionId = sessionId || `session_${Date.now()}`;
    
    // Get conversation history for context
    const conversationHistory = getConversationSummary(currentSessionId, 5); // Last 5 messages
    
    // Add user message to history
    addMessageToHistory(currentSessionId, "user", message);

    // Build agent context
    const agentContext: AgentContext = {
      hasWallet: context?.hasWallet,
      balance: context?.balance,
      walletAddress: context?.walletAddress,
      walletId: context?.walletId,
    };

    const userMsg = String(message || "").slice(0, 5000);
    const systemPrompt = buildSystemPrompt(agentContext, conversationHistory);

    // Use Groq SDK
    const groq = new Groq({
      apiKey: groqApiKey,
    });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Use the 70B model for better quality
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userMsg,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { success: false, error: "Model returned non-JSON output" },
        { status: 502 }
      );
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid AI response shape" },
        { status: 502 }
      );
    }

    // Add AI response to conversation history
    if (parsed.reply) {
      addMessageToHistory(currentSessionId, "assistant", parsed.reply);
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ success: false, error: error.message || "AI error" }, { status: 500 });
  }
}
