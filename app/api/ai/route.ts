import { NextRequest, NextResponse } from "next/server";
// Google-only AI route (Gemini)
import { getAgentConfig, buildContextString, type AgentContext, type AgentConfig } from "@/lib/ai/agent-prompts";

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

/**
 * Enhanced system prompt with few-shot examples
 */
function buildSystemPrompt(context: AgentContext): string {
  const config = getAgentConfig("guardian");
  const contextString = buildContextString(context);
  
  // Build prompt with few-shot examples
  let prompt = config.systemPrompt.replace("{{context}}", contextString);
  
  // Add few-shot examples
  if (config.fewShotExamples && config.fewShotExamples.length > 0) {
    prompt += "\n\nEXAMPLES:\n";
    config.fewShotExamples.slice(0, 3).forEach((example: { input: string; output: string }, i: number) => {
      prompt += `\nExample ${i + 1}:\n`;
      prompt += `User: ${example.input}\n`;
      prompt += `Assistant: ${example.output}\n`;
    });
  }
  
  prompt += `\n\nIMPORTANT: Always return valid JSON matching this schema:\n`;
  prompt += `{\n`;
  prompt += `  "reply": string (user-facing message),\n`;
  prompt += `  "tool": {\n`;
  prompt += `    "name": "send|balance|address|history|scan|schedule|subscription|faucet|null",\n`;
  prompt += `    "arguments": { "to": string?, "amount": string?, "address": string?, "date": string?, "time": string?, "frequency": string?, "merchant": string? }\n`;
  prompt += `  }\n`;
  prompt += `}`;
  
  return prompt;
}

export async function POST(req: NextRequest) {
  try {
    const { message, context, sessionId } = await req.json();
    const googleApiKey = process.env.GOOGLE_AI_API_KEY;

    if (!googleApiKey) {
      return NextResponse.json(
        { success: false, error: "GOOGLE_AI_API_KEY is not set. Please configure it in your environment." },
        { status: 500 }
      );
    }

    // Build agent context
    const agentContext: AgentContext = {
      hasWallet: context?.hasWallet,
      balance: context?.balance,
      walletAddress: context?.walletAddress,
      walletId: context?.walletId,
    };

    const userMsg = String(message || "").slice(0, 5000);
    const systemPrompt = buildSystemPrompt(agentContext);

    const geminiBody = {
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\nUser: ${userMsg}\n\nAssistant:`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${GOOGLE_AI_URL}?key=${googleApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Google AI error:", res.status, txt);
      return NextResponse.json(
        { success: false, error: `Google AI error ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

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

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ success: false, error: error.message || "AI error" }, { status: 500 });
  }
}
