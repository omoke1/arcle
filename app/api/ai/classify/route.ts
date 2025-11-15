/**
 * AI Intent Classification API
 * 
 * Uses Google Gemini to classify user intent with conversation context
 * This provides much better understanding than rule-based classification
 */

import { NextRequest, NextResponse } from "next/server";
import { classifyIntentWithContext } from "@/lib/ai/context-aware-classifier";

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const intent = await classifyIntentWithContext(message, context);

    return NextResponse.json({
      success: true,
      intent,
    });
  } catch (error: any) {
    console.error("Error classifying intent:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to classify intent",
      },
      { status: 500 }
    );
  }
}



