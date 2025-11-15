"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, Plus, List, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startVoiceRecognition, isVoiceRecognitionSupported } from "@/lib/voice/voice-recognition";

interface ChatInputProps {
  onSendMessage: (message: string, replyTo?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: {
    id: string;
    content: string;
    role: "user" | "assistant";
  } | null; // Message being replied to
  onCancelReply?: () => void; // Cancel reply
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Chat with ARCLE...",
  replyTo,
  onCancelReply,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stopRecognitionRef = useRef<(() => void) | null>(null);
  
  // Update placeholder when replying
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  // Determine voice support on client only to avoid SSR/CSR mismatch
  useEffect(() => {
    setVoiceSupported(isVoiceRecognitionSupported());
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    
    // Set height based on scrollHeight, with min and max constraints
    const scrollHeight = textarea.scrollHeight;
    const minHeight = 48; // 48px minimum
    const maxHeight = 128; // ~8 lines max (128px)
    
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), replyTo?.id);
      setMessage("");
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }
      // Clear reply after sending
      if (onCancelReply) {
        onCancelReply();
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-0 left-0 right-0 bg-onyx border-t border-dark-grey/30 backdrop-blur-sm z-50 pb-safe"
    >
      {/* Reply Preview */}
      {replyTo && (
        <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-dark-grey/30">
          <div className="flex items-start gap-2 max-w-full">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-casper">
                  Replying to {replyTo.role === "assistant" ? "ARCLE" : "you"}
                </span>
              </div>
              <p className="text-xs text-casper/70 line-clamp-2 truncate">
                {replyTo.content.length > 100
                  ? replyTo.content.substring(0, 100) + "..."
                  : replyTo.content}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCancelReply}
              className="h-6 w-6 rounded-full text-casper hover:text-white hover:bg-dark-grey/50 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 max-w-full">
        {/* Left Icons */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="rounded-xl h-10 w-10 flex-shrink-0 text-casper hover:text-white hover:bg-dark-grey/50 flex items-center justify-center"
          onClick={() => {
            // TODO: Implement attachment
            alert("Attachments coming soon!");
          }}
        >
          <Plus className="w-5 h-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="rounded-xl h-10 w-10 flex-shrink-0 text-casper hover:text-white hover:bg-dark-grey/50 flex items-center justify-center"
          onClick={() => {
            // TODO: Implement filters/options
            alert("Options coming soon!");
          }}
        >
          <List className="w-5 h-5" />
        </Button>

        {/* Input Field */}
        <div className="flex-1 relative flex items-center min-h-[48px]">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full bg-dark-grey/50 border border-dark-grey rounded-2xl",
              "text-white placeholder:text-casper/70",
              "resize-none focus:outline-none focus:ring-1 focus:ring-white/50 focus:border-white/30",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "overflow-y-auto text-[15px] scrollbar-hide",
              "px-4"
            )}
            style={{
              minHeight: "48px",
              maxHeight: "128px",
              lineHeight: "24px", // Adjusted for better center alignment
              paddingTop: "12px",
              paddingBottom: "12px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Right Icons */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !voiceSupported}
          className={cn(
            "rounded-xl h-10 w-10 flex-shrink-0 flex items-center justify-center",
            isListening 
              ? "bg-danger/20 text-danger animate-pulse" 
              : "text-casper hover:text-white hover:bg-dark-grey/50"
          )}
          onClick={() => {
            if (isListening && stopRecognitionRef.current) {
              // Stop listening
              stopRecognitionRef.current();
              setIsListening(false);
              stopRecognitionRef.current = null;
            } else {
              // Start listening
              setIsListening(true);
              const stop = startVoiceRecognition(
                (result) => {
                  if (result.text) {
                    setMessage(result.text);
                    // Auto-submit if confidence is high
                    if (result.confidence && result.confidence > 0.7) {
                      setTimeout(() => {
                        onSendMessage(result.text);
                        setMessage("");
                      }, 300);
                    }
                  }
                  setIsListening(false);
                  stopRecognitionRef.current = null;
                },
                (error) => {
                  console.error("Voice recognition error:", error);
                  setIsListening(false);
                  stopRecognitionRef.current = null;
                }
              );
              stopRecognitionRef.current = stop;
            }
          }}
        >
          {isListening ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </Button>

        <Button
          type="submit"
          disabled={disabled || !message.trim()}
          size="icon"
          className="bg-white hover:bg-white/80 text-onyx rounded-xl h-10 w-10 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </Button>
        </div>
      </div>
      
      {/* Bottom gesture bar indicator */}
      <div className="w-full h-0.5 bg-white/10 rounded-full mt-2 max-w-[134px] mx-auto" />
    </form>
  );
}

