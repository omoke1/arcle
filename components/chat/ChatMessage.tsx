"use client";

import { cn } from "@/lib/utils";
import { Bot } from "lucide-react";

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

  return (
    <div
      className={cn(
        "flex w-full gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {isAI && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rich-blue flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div className="flex flex-col max-w-[85%] md:max-w-[75%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-dark-grey text-white rounded-br-sm"
              : "bg-rich-blue text-white rounded-bl-sm",
            isPending && "opacity-60"
          )}
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{content}</p>
          {timestamp && (
            <span className="text-xs opacity-70 mt-1 block">
              {timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Children (transaction previews, QR codes, etc.) */}
        {children && (
          <div className="mt-2">
            {children}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-dark-grey border border-casper/30 flex items-center justify-center">
          <span className="text-xs text-casper font-medium">You</span>
        </div>
      )}
    </div>
  );
}
