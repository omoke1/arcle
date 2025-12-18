/**
 * Voice Recognition
 * 
 * Handles speech-to-text conversion using Web Speech API or Whisper API
 */

export interface VoiceRecognitionResult {
  text: string;
  confidence?: number;
  error?: string;
}

/**
 * Check if browser supports Web Speech API
 */
export function isVoiceRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Convert speech to text using Web Speech API (browser-native)
 */
export function startVoiceRecognition(
  onResult: (result: VoiceRecognitionResult) => void,
  onError?: (error: string) => void
): () => void {
  if (typeof window === 'undefined') {
    onError?.('Voice recognition not available in server environment');
    return () => {};
  }

  const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  
  if (!SpeechRecognition) {
    onError?.('Voice recognition not supported in this browser');
    return () => {};
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    const confidence = event.results[0][0].confidence || 0.8;
    
    onResult({
      text: transcript.trim(),
      confidence,
    });
  };

  recognition.onerror = (event: any) => {
    const error = event.error || 'Unknown error';
    
    // Map error codes to user-friendly messages
    let errorMessage = error;
    if (error === 'not-allowed' || error === 'NotAllowedError') {
      errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
    } else if (error === 'no-speech' || error === 'NoSpeechError') {
      errorMessage = 'No speech detected. Please try again.';
    } else if (error === 'aborted' || error === 'AbortError') {
      errorMessage = 'Voice recognition was aborted.';
    } else if (error === 'network' || error === 'NetworkError') {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error === 'service-not-allowed' || error === 'ServiceNotAllowedError') {
      errorMessage = 'Speech recognition service is not allowed.';
    }
    
    onError?.(errorMessage);
  };

  recognition.onend = () => {
    // Recognition ended
  };

  recognition.start();

  // Return stop function
  return () => {
    recognition.stop();
  };
}

/**
 * Convert speech to text using Whisper API (OpenAI)
 * Falls back to Web Speech API if Whisper API key is not available
 */
export async function transcribeWithWhisper(audioBlob: Blob): Promise<VoiceRecognitionResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Transcription failed');
    }

    const data = await response.json();
    return {
      text: data.text || '',
      confidence: data.confidence,
    };
  } catch (error: any) {
    return {
      text: '',
      error: error.message || 'Failed to transcribe audio',
    };
  }
}


