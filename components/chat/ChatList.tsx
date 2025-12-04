"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessage as ChatMessageType } from "@/types";
import { TypingIndicator } from "./TypingIndicator";

interface ChatListProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
  onReplyToMessage?: (messageId: string) => void;
}

export function ChatList({ messages, isLoading, onReplyToMessage }: ChatListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length, isLoading]);

  const items = messages.map((msg, index) => {
    const previous = messages[index - 1];
    const groupedWithPrevious =
      !!previous &&
      previous.role === msg.role &&
      previous.timestamp &&
      msg.timestamp &&
      Math.abs(
        new Date(msg.timestamp).getTime() -
          new Date(previous.timestamp).getTime()
      ) <
        5 * 60 * 1000; // 5-minute grouping, Telegram-style

    return (
      <ChatBubble
        key={msg.id}
        role={msg.role === "assistant" ? "assistant" : "user"}
        timestamp={msg.timestamp}
        showAvatar={msg.role === "assistant" && !groupedWithPrevious}
        groupedWithPrevious={groupedWithPrevious}
        messageId={msg.id}
        onReply={onReplyToMessage}
      >
        {msg.content}
      </ChatBubble>
    );
  });

  return (
    <div className="flex-1 bg-carbon">
      <ScrollArea className="h-full px-3 sm:px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {items}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}


