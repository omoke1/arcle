"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";

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
        "max-w-[85%] md:max-w-[75%]"
      )}>
        {/* Message Bubble with Tail */}
        <div className="relative">
          {/* Bubble */}
          <div
            className={cn(
              "px-4 py-3",
              isUser
                ? "bg-dark-grey text-white"
                : "bg-white text-onyx",
              isPending && "opacity-60"
            )}
            style={{
              borderRadius: isUser 
                ? "1rem 1rem 0.25rem 1rem" // Top-left, top-right, bottom-left (small), bottom-right (large)
                : "1rem 1rem 1rem 0.25rem", // Top-left, top-right, bottom-right (large), bottom-left (small)
            }}
          >
            {isAI && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-medium text-onyx">ARCLE</span>
                <VerifiedBadge size={14} variant="dark" />
              </div>
            )}
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
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
          />
        </div>

        {/* Timestamp and Read Receipt - Outside bubble */}
        <div className={cn(
          "flex items-center gap-1.5 mt-1",
          isUser ? "flex-row-reverse" : "flex-row"
        )}>
          {timestamp && (
            <span className="text-xs text-casper/70">
              {formatTime(timestamp)}
            </span>
          )}
          {isUser && !isPending && (
            <div className="flex items-center">
              <CheckCheck className="w-3.5 h-3.5 text-casper/70" />
            </div>
          )}
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
