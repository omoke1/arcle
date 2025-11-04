"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { QRCodeDisplay } from "@/components/wallet/QRCodeDisplay";
import { TransactionPreviewMessage } from "./TransactionPreviewMessage";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatInterfaceProps {
  messages?: ChatMessageType[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
  walletAddress?: string | null;
  walletId?: string | null;
  onConfirmTransaction?: () => void;
  onCancelTransaction?: () => void;
}

export function ChatInterface({
  messages = [],
  onSendMessage,
  isLoading = false,
  walletAddress,
  walletId,
  onConfirmTransaction,
  onCancelTransaction,
}: ChatInterfaceProps) {
  const [localMessages, setLocalMessages] = useState<ChatMessageType[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSendMessage = (content: string) => {
    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setLocalMessages((prev) => [...prev, userMessage]);

    if (onSendMessage) {
      onSendMessage(content);
    }
  };

  // Welcome message per ui-plans.md - Chat-first interface
  const welcomeMessage: ChatMessageType = {
    id: "welcome",
    role: "assistant",
    content: "Hello! I'm your AI wallet assistant on ARCLE. I can help you manage your wallet on Arc network.\n\nTry asking:\n• \"What's my balance?\"\n• \"Show my address\"\n• \"Send $50 to 0x...\"",
    timestamp: new Date(),
  };

  const displayMessages = localMessages.length === 0 
    ? [welcomeMessage] 
    : localMessages;

  return (
    <div className="flex flex-col h-full bg-onyx">
      {/* Chat Messages Area - Chat-first: 90% of screen per ui-plans.md */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto w-full">
          {displayMessages.map((message) => {
            // Check if message is about address/QR code - only show when explicitly requested
            // The AI service returns "Here's your wallet address:" when user asks for address
            const showQR = message.role === "assistant" && 
                         walletAddress &&
                         (message.content.includes("Here's your wallet address") ||
                          message.content.includes("Here is your wallet address"));
            
            // Check if message is about transaction history
            const showHistory = message.role === "assistant" && 
                              (message.content.includes("transaction history") ||
                               message.content.includes("Fetching your transaction history")) &&
                              walletId;
            
            // Check if message has transaction preview
            const hasTransactionPreview = message.transactionPreview;

            return (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
              >
                {showQR && walletAddress && (
                  <div className="mt-3 max-w-xs">
                    <QRCodeDisplay address={walletAddress} />
                  </div>
                )}
                {showHistory && walletId && (
                  <div className="mt-3 max-w-2xl">
                    <TransactionHistory walletId={walletId} limit={5} />
                  </div>
                )}
                {hasTransactionPreview && (
                  <div className="mt-3">
                    <TransactionPreviewMessage
                      amount={message.transactionPreview!.amount}
                      to={message.transactionPreview!.to}
                      from={walletAddress || undefined}
                      fee={message.transactionPreview!.fee}
                      riskScore={message.transactionPreview!.riskScore}
                      riskReasons={message.transactionPreview!.riskReasons}
                      blocked={message.transactionPreview!.blocked}
                      onConfirm={onConfirmTransaction}
                      onCancel={onCancelTransaction}
                    />
                  </div>
                )}
              </ChatMessage>
            );
          })}

          {isLoading && (
            <ChatMessage
              role="assistant"
              content="Thinking..."
              isPending={true}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Chat Input - Always visible at bottom */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder="Type a message..."
      />
    </div>
  );
}
