"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, Plus, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Chat with ARCLE...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      onSendMessage(message.trim());
      setMessage("");
      // Reset height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "48px";
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-0 left-0 right-0 bg-onyx border-t border-dark-grey/30 p-3 sm:p-4 backdrop-blur-sm z-50 pb-safe"
    >
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
          disabled={disabled}
          className="rounded-xl h-10 w-10 flex-shrink-0 text-casper hover:text-white hover:bg-dark-grey/50 flex items-center justify-center"
          onClick={() => {
            // TODO: Implement voice input
            alert("Voice input coming soon!");
          }}
        >
          <Mic className="w-5 h-5" />
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
      
      {/* Bottom gesture bar indicator */}
      <div className="w-full h-0.5 bg-white/10 rounded-full mt-2 max-w-[134px] mx-auto" />
    </form>
  );
}

