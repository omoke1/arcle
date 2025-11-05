/**
 * Voice Transcription API
 * 
 * Uses Whisper API (OpenAI) or falls back to Web Speech API
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Check if OpenAI API key is available
    const openAIApiKey = process.env.OPENAI_API_KEY;

    if (!openAIApiKey) {
      // Fallback: Return error message (client should use Web Speech API)
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured. Using browser speech recognition instead.',
          fallback: true 
        },
        { status: 400 }
      );
    }

    // Convert File to format expected by OpenAI
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    // Call OpenAI Whisper API
    const formDataForOpenAI = new FormData();
    formDataForOpenAI.append('file', blob, file.name);
    formDataForOpenAI.append('model', 'whisper-1');

    const openAIResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formDataForOpenAI,
    });

    if (!openAIResponse.ok) {
      const errorData = await openAIResponse.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    const data = await openAIResponse.json();

    return NextResponse.json({
      text: data.text || '',
      confidence: 0.95, // Whisper doesn't provide confidence, but it's generally high
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to transcribe audio',
        fallback: true,
      },
      { status: 500 }
    );
  }
}


