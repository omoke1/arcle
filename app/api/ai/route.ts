import { NextRequest, NextResponse } from "next/server";
import { AIService } from "@/lib/ai/ai-service";
import { AgentService } from "@/lib/ai/agent-service";
import { getAgentConfig, buildContextString, type AgentContext, type AgentConfig } from "@/lib/ai/agent-prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
    const apiKey = process.env.OPENROUTER_API_KEY;

    // Build agent context
    const agentContext: AgentContext = {
      hasWallet: context?.hasWallet,
      balance: context?.balance,
      walletAddress: context?.walletAddress,
      walletId: context?.walletId,
    };

    // Fallback to rule-based service if no key
    if (!apiKey) {
      const ai = await AIService.processMessage(message, context);
      return NextResponse.json({ success: true, data: ai });
    }

    const userMsg = String(message || "").slice(0, 5000);
    const systemPrompt = buildSystemPrompt(agentContext);

    // Use better model for improved understanding
    // Options: meta-llama/Meta-Llama-3.1-70B-Instruct, anthropic/claude-3-opus, openai/gpt-4
    const model = process.env.AI_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct";

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3, // Slightly higher for more natural responses
      max_tokens: 500,
      response_format: { type: "json_object" },
    } as any;

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("OpenRouter error:", res.status, txt);
      // Fallback to rule-based
      const ai = await AIService.processMessage(message, context);
      return NextResponse.json({ success: true, data: ai });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback to rule-based if model failed JSON
      const ai = await AIService.processMessage(message, context);
      return NextResponse.json({ success: true, data: ai });
    }

    // Minimal safety: ensure shape
    if (!parsed || typeof parsed !== "object") {
      const ai = await AIService.processMessage(message, context);
      return NextResponse.json({ success: true, data: ai });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ success: false, error: error.message || "AI error" }, { status: 500 });
  }
}
