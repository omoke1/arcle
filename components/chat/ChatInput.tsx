"use client";

import { useState } from "react";
import { Send, Mic } from "lucide-react";
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
  placeholder = "Type a message...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 bg-onyx border-t border-dark-grey/50 p-4 backdrop-blur-sm"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
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
              "w-full bg-dark-grey border border-casper rounded-xl px-4 py-3",
              "text-white placeholder:text-casper",
              "resize-none focus:outline-none focus:ring-2 focus:ring-rich-blue focus:border-transparent",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "max-h-32 overflow-y-auto"
            )}
            style={{
              minHeight: "48px",
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={disabled || !message.trim()}
          size="icon"
          className="bg-rich-blue hover:bg-[#001FCC] rounded-xl h-12 w-12 flex-shrink-0"
        >
          <Send className="w-5 h-5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="rounded-xl h-12 w-12 flex-shrink-0 text-casper hover:text-white hover:bg-dark-grey"
          onClick={() => {
            // TODO: Implement voice input
            alert("Voice input coming soon!");
          }}
        >
          <Mic className="w-5 h-5" />
        </Button>
      </div>
    </form>
  );
}

