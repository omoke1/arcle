"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { EmptyChatState } from "./EmptyChatState";
import { TypingIndicator } from "./TypingIndicator";
import { QRCodeDisplay } from "@/components/wallet/QRCodeDisplay";
import { TransactionPreviewMessage } from "./TransactionPreviewMessage";
import { DeliveryTrackingMap } from "@/components/maps/DeliveryTrackingMap";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatInterfaceProps {
  messages?: ChatMessageType[];
  onSendMessage?: (message: string, replyTo?: string) => void;
  isLoading?: boolean;
  walletAddress?: string | null;
  walletId?: string | null;
  onConfirmTransaction?: () => void;
  onCancelTransaction?: () => void;
  replyToMessageId?: string | null; // Currently selected message to reply to
  onReplyToMessage?: (messageId: string | null) => void; // Callback to set reply target
}

export function ChatInterface({
  messages = [],
  onSendMessage,
  isLoading = false,
  walletAddress,
  walletId,
  onConfirmTransaction,
  onCancelTransaction,
  replyToMessageId,
  onReplyToMessage,
}: ChatInterfaceProps) {
  const [localMessages, setLocalMessages] = useState<ChatMessageType[]>(messages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Handle reply to a message
  const handleReply = (messageId: string) => {
    if (onReplyToMessage) {
      onReplyToMessage(messageId);
    }
  };
  
  // Find the message being replied to
  const getRepliedMessage = (replyToId?: string) => {
    if (!replyToId) return undefined;
    return localMessages.find(m => m.id === replyToId);
  };

  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (localMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  const hasMessages = localMessages.length > 0;

  return (
    <div className="flex flex-col h-full bg-carbon">
      {/* Chat Messages Area - Chat-first: 90% of screen per ui-plans.md */}
      <div className="flex-1 overflow-y-auto pb-24 touch-pan-y">
        {!hasMessages ? (
          <EmptyChatState />
        ) : (
          <div className="px-4 py-6">
            <div className="max-w-4xl mx-auto w-full">
              {localMessages.map((message) => {
            // Check if message is about address/QR code - only show when explicitly requested
            // The AI service returns "Here's your wallet address:" when user asks for address
            const showQR = message.role === "assistant" && 
                         walletAddress &&
                         (message.content.includes("Here's your wallet address") ||
                          message.content.includes("Here is your wallet address"));
            
            // Check if message has transaction preview
            const hasTransactionPreview = message.transactionPreview;
            
            // Check if message has delivery tracking data
            const deliveryData = (message as any).agentData?.data;
            const hasDeliveryTracking = deliveryData?.hasLocationData && 
                                      deliveryData?.deliveryLatitude && 
                                      deliveryData?.deliveryLongitude &&
                                      deliveryData?.action === 'track-delivery';

            const repliedMessage = getRepliedMessage(message.replyTo);
            
            return (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                messageId={message.id}
                replyTo={message.replyTo}
                image={message.image}
                repliedMessage={repliedMessage ? {
                  id: repliedMessage.id,
                  content: repliedMessage.content,
                  role: repliedMessage.role,
                } : undefined}
                onReply={handleReply}
              >
                {showQR && walletAddress && (
                  <div className="mt-3 max-w-xs">
                    <QRCodeDisplay address={walletAddress} />
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
                {hasDeliveryTracking && deliveryData && (
                  <div className="mt-3 max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]">
                    <DeliveryTrackingMap
                      pickupLatitude={parseFloat(deliveryData.order?.vendor?.latitude || '0')}
                      pickupLongitude={parseFloat(deliveryData.order?.vendor?.longitude || '0')}
                      deliveryLatitude={parseFloat(deliveryData.deliveryLatitude)}
                      deliveryLongitude={parseFloat(deliveryData.deliveryLongitude)}
                      currentLatitude={deliveryData.currentLatitude ? parseFloat(deliveryData.currentLatitude) : undefined}
                      currentLongitude={deliveryData.currentLongitude ? parseFloat(deliveryData.currentLongitude) : undefined}
                      dispatcherName={deliveryData.order?.dispatcher?.name}
                      estimatedArrival={deliveryData.order?.estimated_delivery_time}
                      height="350px"
                    />
                  </div>
                )}
              </ChatMessage>
            );
          })}

            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
