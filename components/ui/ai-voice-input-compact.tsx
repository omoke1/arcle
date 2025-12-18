"use client";

import { Mic } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { startVoiceRecognition, isVoiceRecognitionSupported, type VoiceRecognitionResult } from "@/lib/voice/voice-recognition";

interface AIVoiceInputCompactProps {
  onStart?: () => void;
  onStop?: (duration: number, text?: string) => void;
  onResult?: (text: string) => void;
  visualizerBars?: number;
  className?: string;
  disabled?: boolean;
  showVisualizer?: boolean;
}

export function AIVoiceInputCompact({
  onStart,
  onStop,
  onResult,
  visualizerBars = 12,
  className,
  disabled = false,
  showVisualizer = true,
}: AIVoiceInputCompactProps) {
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRecognitionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setIsClient(true);
    setVoiceSupported(isVoiceRecognitionSupported());
  }, []);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (submitted) {
      onStart?.();
      intervalId = setInterval(() => {
        setTime((t) => t + 1);
      }, 1000);
    } else {
      onStop?.(time);
      setTime(0);
    }

    return () => clearInterval(intervalId);
  }, [submitted, time, onStart, onStop]);

  const handleClick = () => {
    if (disabled || !voiceSupported) return;
    
    // Clear any previous errors when starting new recording
    setError(null);

    if (submitted) {
      // Stop recording
      if (stopRecognitionRef.current) {
        stopRecognitionRef.current();
        stopRecognitionRef.current = null;
      }
      setSubmitted(false);
    } else {
      // Start recording
      setSubmitted(true);
      const stop = startVoiceRecognition(
        (result: VoiceRecognitionResult) => {
          if (result.text) {
            onResult?.(result.text);
          }
          setSubmitted(false);
          if (stopRecognitionRef.current) {
            stopRecognitionRef.current();
            stopRecognitionRef.current = null;
          }
        },
        (error: string) => {
          console.error("Voice recognition error:", error);
          setError(error);
          setSubmitted(false);
          if (stopRecognitionRef.current) {
            stopRecognitionRef.current();
            stopRecognitionRef.current = null;
          }
          // Clear error after 5 seconds
          setTimeout(() => setError(null), 5000);
        }
      );
      stopRecognitionRef.current = stop;
    }
  };

  return (
    <div className={cn("flex items-center gap-2 relative", className)}>
      <button
        className={cn(
          "flex-shrink-0 text-signal-white hover:text-aurora transition-colors disabled:opacity-50 relative",
          submitted && "text-aurora"
        )}
        type="button"
        onClick={handleClick}
        disabled={disabled || !voiceSupported}
        aria-label={submitted ? "Stop voice recording" : "Start voice recording"}
      >
        {submitted ? (
          <div className="relative">
            <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-aurora animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-aurora rounded-full animate-ping" />
            </div>
          </div>
        ) : (
          <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
      </button>

      {showVisualizer && submitted && !error && (
        <div className="h-4 flex items-center justify-center gap-0.5">
          {[...Array(visualizerBars)].map((_, i) => (
            <div
              key={i}
              className="w-0.5 rounded-full bg-aurora/50 transition-all duration-300 animate-pulse"
              style={
                isClient
                  ? {
                      height: `${30 + Math.random() * 70}%`,
                      animationDelay: `${i * 0.08}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
      
      {error && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-graphite/90 border border-graphite/60 rounded-lg text-xs text-signal-white/90 max-w-xs z-50 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

