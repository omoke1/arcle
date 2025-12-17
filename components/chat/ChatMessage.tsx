"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck, Reply } from "lucide-react";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { SpeechBubbleIcon } from "@/components/ui/SpeechBubbleIcon";
import { LocationMap } from "@/components/maps/LocationMap";
import { parseLocationFromMessage } from "@/lib/utils/locationParser";
import React, { useRef, useState, useEffect } from "react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  isPending?: boolean;
  replyTo?: string; // ID of the message this is replying to
  repliedMessage?: {
    id: string;
    content: string;
    role: "user" | "assistant";
  }; // The message being replied to (for display)
  onReply?: (messageId: string) => void; // Callback when message is clicked to reply
  messageId?: string; // ID of this message (needed for reply functionality)
  children?: React.ReactNode; // For transaction previews, QR codes, etc.
}

export function ChatMessage({
  role,
  content,
  timestamp,
  isPending = false,
  replyTo,
  repliedMessage,
  onReply,
  messageId,
  children,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isAI = role === "assistant";
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const SWIPE_THRESHOLD = 50; // Minimum pixels to trigger reply
  const MAX_SWIPE = 80; // Maximum swipe distance
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () =>
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Reset swipe on message change
  useEffect(() => {
    setSwipeOffset(0);
    setIsDragging(false);
  }, [messageId]);

  const handleStart = (clientX: number, clientY: number) => {
    if (isMobile) return; // disable swipe on mobile to allow normal scroll
    if (isPending || !onReply || !messageId) return;
    startXRef.current = clientX;
    startYRef.current = clientY;
    setIsDragging(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || !bubbleRef.current) return;

    const deltaX = clientX - startXRef.current;
    
    // Only allow swiping left (negative delta) for user messages
    // Only allow swiping right (positive delta) for assistant messages
    const isSwipeDirectionValid = isUser ? deltaX < 0 : deltaX > 0;
    
    if (isSwipeDirectionValid) {
      const absDelta = Math.abs(deltaX);
      const clampedDelta = Math.min(absDelta, MAX_SWIPE);
      setSwipeOffset(isUser ? -clampedDelta : clampedDelta);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    
    const absOffset = Math.abs(swipeOffset);
    if (absOffset >= SWIPE_THRESHOLD && onReply && messageId) {
      // Trigger reply
      onReply(messageId);
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
    
    // Reset
    setSwipeOffset(0);
    setIsDragging(false);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isMobile) return;
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isMobile) return;
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling while swiping
    const touch = e.touches[0];
    handleMove(touch.clientX);
  };

  const handleTouchEnd = () => {
    if (isMobile) return;
    handleEnd();
  };

  // Mouse handlers (for desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Global mouse handlers for drag
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!bubbleRef.current) return;
      const deltaX = e.clientX - startXRef.current;
      const isSwipeDirectionValid = isUser ? deltaX < 0 : deltaX > 0;
      if (isSwipeDirectionValid) {
        const absDelta = Math.abs(deltaX);
        const clampedDelta = Math.min(absDelta, MAX_SWIPE);
        setSwipeOffset(isUser ? -clampedDelta : clampedDelta);
      } else {
        setSwipeOffset(0);
      }
    };

    const handleGlobalMouseUp = () => {
      const absOffset = Math.abs(swipeOffset);
      if (absOffset >= SWIPE_THRESHOLD && onReply && messageId) {
        onReply(messageId);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }
      setSwipeOffset(0);
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, swipeOffset, isUser, onReply, messageId]);

  const showReplyIcon = Math.abs(swipeOffset) >= SWIPE_THRESHOLD / 2;
  const replyIconOpacity = Math.min(Math.abs(swipeOffset) / SWIPE_THRESHOLD, 1);

  const formatTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const isToday = 
      messageDate.getDate() === now.getDate() &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getFullYear() === now.getFullYear();
    
    const isYesterday = 
      messageDate.getDate() === now.getDate() - 1 &&
      messageDate.getMonth() === now.getMonth() &&
      messageDate.getFullYear() === now.getFullYear();
    
    const timeStr = messageDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).toLowerCase();
    
    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Yesterday ${timeStr}`;
    } else {
      const dateStr = messageDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      return `${dateStr} ${timeStr}`;
    }
  };

  // Parse markdown links and convert them to clickable links
  const parseMessageContent = (text: string): React.ReactNode => {
    // Match markdown links: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add the link
      const linkText = match[1];
      const linkUrl = match[2];
      parts.push(
        <a
          key={key++}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "underline font-medium hover:opacity-80 transition-opacity",
            isUser ? "text-white" : "text-blue-600"
          )}
        >
          {linkText}
        </a>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last link
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    // If no links were found, return the original text
    return parts.length > 0 ? parts : text;
  };

  // Check if message contains location data
  const locationData = parseLocationFromMessage(content);

  return (
    <div
      className={cn(
        "flex w-full mb-5 relative",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {/* Reply Icon (shows during swipe) */}
      {showReplyIcon && (
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 z-10 transition-opacity duration-200",
            isUser ? "right-4" : "left-4",
            "flex items-center justify-center"
          )}
          style={{ opacity: replyIconOpacity }}
        >
          <div className="bg-[#E9F28E]/90 text-[#0D0D0C] rounded-full p-2 shadow-lg">
            <Reply className="w-4 h-4" />
          </div>
        </div>
      )}

      <div
        ref={bubbleRef}
        className={cn(
          "flex flex-col relative",
          isUser ? "items-end" : "items-start",
          // Allow container to fit content
          "w-full",
          !isMobile && "touch-none select-none", // allow scrolling on mobile
          isDragging && "transition-none" // Disable transitions during drag
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} // Cancel drag if mouse leaves
        onClick={() => {
          // On mobile, tap to reply instead of swipe
          if (isMobile && onReply && messageId) {
            onReply(messageId);
          }
        }}
      >
        {/* Reply indicator - show the message being replied to */}
        {replyTo && repliedMessage && (
          <div
            className={cn(
              "mb-2 px-3 py-2 rounded-lg border text-sm max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]",
              isUser
                ? "bg-[#151515] border-[#E9F28E40] text-white/80"
                : "bg-[#1C1C1C] border-[#E9F28E26] text-white/70",
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">
                {repliedMessage.role === "assistant" ? "ARCLE" : "You"}
              </span>
              <span className="text-xs">→</span>
            </div>
            <p className="text-xs line-clamp-2 truncate">
              {repliedMessage.content.length > 100
                ? repliedMessage.content.substring(0, 100) + "..."
                : repliedMessage.content}
            </p>
          </div>
        )}
        
        {/* Message Bubble with Tail */}
        <div className="relative">
          {/* Bubble */}
          <div
            className={cn(
              "px-4 py-3 shadow-sm",
              isUser
                ? "bg-[#151515] text-white border border-[#E9F28E40]"
                : "bg-[#242424] text-white border border-[#FFFFFF1A]",
              isPending && "opacity-60",
              // Visual feedback during swipe
              isDragging && "scale-[0.98]",
              showReplyIcon && "ring-2 ring-[#E9F28E]/50",
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
                ? "14px 14px 4px 14px"
                : "14px 14px 14px 4px",
            }}
          >
            {isAI && (
              <div className="flex items-center gap-1.5 mb-2">
                <SpeechBubbleIcon size={16} className="text-[#E9F28E]" />
                <span className="text-sm font-medium text-white">ARCLE</span>
                <VerifiedBadge size={14} variant="light" />
              </div>
            )}
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
              {parseMessageContent(content)}
            </p>

            {/* In-bubble timestamp (and ticks for user) */}
            {timestamp && (
              <div className={cn(
                "mt-2 flex items-center gap-1.5 text-[11px] font-medium",
                isUser ? "justify-end text-carbon/70" : "justify-end text-signal-white/60"
              )}>
                <span>{formatTime(timestamp)}</span>
                {isUser && !isPending && (
                  <CheckCheck className="w-3.5 h-3.5 text-carbon/70" />
                )}
              </div>
            )}
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

        {/* Location Map - Show if location data is detected */}
        {locationData && locationData.isValid && (
          <div className="mt-3 w-full max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]">
            <LocationMap
              latitude={locationData.latitude}
              longitude={locationData.longitude}
              address={locationData.address}
              height="250px"
            />
          </div>
        )}

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
