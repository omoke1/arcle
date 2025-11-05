"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { SpeechBubbleIcon } from "@/components/ui/SpeechBubbleIcon";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isPending?: boolean;
  children?: React.ReactNode; // For transaction previews, QR codes, etc.
}

export function ChatMessage({
  role,
  content,
  timestamp,
  isPending = false,
  children,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isAI = role === "assistant";

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
  };

  return (
    <div
      className={cn(
        "flex w-full mb-5",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn(
        "flex flex-col",
        isUser ? "items-end" : "items-start",
        // Allow container to fit content
        "w-full"
      )}>
        {/* Message Bubble with Tail */}
        <div className="relative">
          {/* Bubble */}
          <div
            className={cn(
              "px-4 py-3 shadow-sm",
              isUser
                ? "bg-dark-grey text-white border border-casper/20"
                : "bg-white text-onyx border border-dark-grey/20",
              isPending && "opacity-60",
              // Force rectangular shape - minimum width ensures wider than tall
              "inline-block",
              "min-w-[120px] sm:min-w-[140px]",
              // Max width to prevent overly wide messages
              "max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]",
              // Ensure text wraps properly to maintain rectangle
              "break-words"
            )}
            style={{
              borderRadius: isUser
                ? "10px 10px 2px 10px" // Sharp rectangle with minimal rounding, tail on bottom-right
                : "10px 10px 10px 2px", // Sharp rectangle with minimal rounding, tail on bottom-left
            }}
          >
            {isAI && (
              <div className="flex items-center gap-1.5 mb-2">
                <SpeechBubbleIcon size={16} className="text-onyx" />
                <span className="text-sm font-medium text-onyx">ARCLE</span>
                <VerifiedBadge size={14} variant="dark" />
              </div>
            )}
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>

            {/* In-bubble timestamp (and ticks for user) */}
            <div className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              isUser ? "justify-end text-casper/70" : "justify-end text-casper/60"
            )}>
              <span>{timestamp ? (
                timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase()
              ) : null}</span>
              {isUser && !isPending && (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
            </div>
          </div>

          {/* Tail - triangular extension */}
          <div
            className={cn(
              "absolute bottom-0 w-0 h-0",
              isUser
                ? "right-0 -mr-1 border-l-[8px] border-l-dark-grey"
                : "left-0 -ml-1 border-r-[8px] border-r-white",
              "border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent"
            )}
            style={{
              // Position tail at the corner where it's less rounded
              bottom: "-1px",
            }}
          />
        </div>

        {/* Children (transaction previews, QR codes, etc.) */}
        {children && (
          <div className="mt-3 w-full">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
