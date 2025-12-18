"use client";

import { Mic } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { startVoiceRecognition, isVoiceRecognitionSupported, type VoiceRecognitionResult } from "@/lib/voice/voice-recognition";

interface AIVoiceInputProps {
  onStart?: () => void;
  onStop?: (duration: number, text?: string) => void;
  onResult?: (text: string) => void;
  visualizerBars?: number;
  className?: string;
  disabled?: boolean;
}

export function AIVoiceInput({
  onStart,
  onStop,
  onResult,
  visualizerBars = 48,
  className,
  disabled = false,
}: AIVoiceInputProps) {
  const [submitted, setSubmitted] = useState(false);
  const [time, setTime] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = () => {
    if (disabled || !voiceSupported) return;

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
          setSubmitted(false);
          if (stopRecognitionRef.current) {
            stopRecognitionRef.current();
            stopRecognitionRef.current = null;
          }
        }
      );
      stopRecognitionRef.current = stop;
    }
  };

  return (
    <div className={cn("w-full py-4", className)}>
      <div className="relative max-w-xl w-full mx-auto flex items-center flex-col gap-2">
        <button
          className={cn(
            "group w-16 h-16 rounded-xl flex items-center justify-center transition-colors",
            submitted
              ? "bg-none"
              : "bg-none hover:bg-graphite/20",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          type="button"
          onClick={handleClick}
          disabled={disabled || !voiceSupported}
        >
          {submitted ? (
            <div
              className="w-6 h-6 rounded-sm animate-spin bg-aurora cursor-pointer pointer-events-auto"
              style={{ animationDuration: "3s" }}
            />
          ) : (
            <Mic className="w-6 h-6 text-signal-white/70 group-hover:text-aurora transition-colors" />
          )}
        </button>

        <span
          className={cn(
            "font-mono text-sm transition-opacity duration-300",
            submitted
              ? "text-signal-white/70"
              : "text-soft-mist/30"
          )}
        >
          {formatTime(time)}
        </span>

        <div className="h-4 w-64 flex items-center justify-center gap-0.5">
          {[...Array(visualizerBars)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-0.5 rounded-full transition-all duration-300",
                submitted
                  ? "bg-aurora/50 animate-pulse"
                  : "bg-graphite/20 h-1"
              )}
              style={
                submitted && isClient
                  ? {
                      height: `${20 + Math.random() * 80}%`,
                      animationDelay: `${i * 0.05}s`,
                    }
                  : undefined
              }
            />
          ))}
        </div>

        <p className="h-4 text-xs text-soft-mist/70">
          {submitted ? "Listening..." : voiceSupported ? "Click to speak" : "Voice not supported"}
        </p>
      </div>
    </div>
  );
}

