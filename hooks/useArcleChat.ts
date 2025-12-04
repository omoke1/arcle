"use client";

import { useState, useCallback } from "react";
import type { ChatMessage } from "@/types";

interface UseArcleChatOptions {
  sessionId?: string | null;
  userId?: string | null;
  context?: {
    hasWallet?: boolean;
    balance?: string;
    walletAddress?: string | null;
    walletId?: string | null;
  };
  onToolCall?: (tool: { name: string; arguments: any }) => void;
}

/**
 * Custom hook for Arcle chat that provides a useChat-like API
 * 
 * This hook:
 * - Provides input management
 * - Handles message state
 * - Can be extended to use Vercel AI SDK streaming in the future
 * - Works with existing /api/ai route for now
 */
export function useArcleChat({
  sessionId,
  userId,
  context,
  onToolCall,
}: UseArcleChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Input change handler
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // Submit handler - can be extended to use streaming API
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: input.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setError(undefined);

      try {
        // For now, use existing /api/ai route
        // TODO: Migrate to streaming /api/chat route when ready
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input.trim(),
            context,
            sessionId,
            userId,
          }),
        });

        const data = await response.json();

        if (data.success && data.data?.reply) {
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.data.reply,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Handle tool calls if present
          if (data.data.tool && onToolCall) {
            onToolCall(data.data.tool);
          }
        } else {
          throw new Error(data.error || "Failed to get AI response");
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        console.error("[useArcleChat] Error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, context, sessionId, userId, onToolCall]
  );

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
  };
}
