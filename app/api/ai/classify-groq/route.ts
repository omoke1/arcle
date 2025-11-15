/**
 * Groq Intent Classification API
 * 
 * Uses Groq API for fast, reliable intent classification
 */

import { NextRequest, NextResponse } from "next/server";
import { classifyIntentWithGroq } from "@/lib/ai/groq-classifier";

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const intent = await classifyIntentWithGroq(message, context);

    return NextResponse.json({
      success: true,
      intent,
    });
  } catch (error: any) {
    console.error("Error classifying intent with Groq:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to classify intent",
      },
      { status: 500 }
    );
  }
}



