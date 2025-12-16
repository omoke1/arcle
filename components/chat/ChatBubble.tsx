"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ReactNode, useRef, useState, useEffect } from "react";
import { Reply, Copy } from "lucide-react";

type ChatBubbleRole = "user" | "assistant";

interface ChatBubbleProps {
  role: ChatBubbleRole;
  children: ReactNode;
  timestamp?: Date;
  isPending?: boolean;
  showAvatar?: boolean;
  groupedWithPrevious?: boolean;
  messageId?: string;
  onReply?: (messageId: string) => void;
}

const formatTime = (date?: Date) => {
  if (!date) return "";
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

export function ChatBubble({
  role,
  children,
  timestamp,
  isPending,
  showAvatar = false,
  groupedWithPrevious = false,
  messageId,
  onReply,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
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

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!navigator.clipboard) return;

    let textToCopy = "";
    if (typeof children === "string") {
      textToCopy = children;
    } else if (bubbleRef.current) {
      textToCopy = bubbleRef.current.innerText || "";
    }

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("[ChatBubble] Failed to copy message:", error);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full relative",
        isUser ? "justify-end" : "justify-start",
        groupedWithPrevious ? "mt-1 mb-2" : "mt-2 mb-3"
      )}
    >
      {!isUser && showAvatar && (
        <div className="mr-2 mt-auto">
          <Avatar className="h-8 w-8 bg-aurora text-carbon shadow-md">
            <AvatarFallback className="text-xs font-semibold">A</AvatarFallback>
          </Avatar>
        </div>
      )}

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
          <div className="bg-aurora/90 text-carbon rounded-full p-2 shadow-lg">
            <Reply className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Main Bubble container */}
      <div
        ref={bubbleRef}
        className={cn(
          // width & layout
          "max-w-[90%] md:max-w-[75%] flex flex-col relative ",
          isUser ? "items-end" : "items-start",
          !isMobile && "touch-none select-none",
          isDragging && "transition-none"
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
        onMouseLeave={handleMouseUp}
        onClick={() => {
          if (isMobile && onReply && messageId) {
            onReply(messageId);
            return;
          }
        }}
      >
        {/* Bubble itself */}
        <div
          className={cn(
            "py-2.5 px-4 shadow-md transition-all duration-150 break-words relative whitespace-pre-wrap",
            isUser
              ? "bg-aurora text-carbon rounded-[22px] rounded-br-[5px] ml-auto"
              : "bg-[#242424] border border-graphite/60 text-signal-white rounded-[22px] rounded-bl-[5px] mr-auto",
            isPending && "opacity-70"
          )}
          style={{
            minWidth: "60px",
            boxShadow: isUser
              ? "0px 2px 16px 0px rgba(233,242,142,0.08)"
              : "0px 2px 16px 0px rgba(53,53,53,0.3)",
          }}
        >
          {/* Copy button (shows on hover) */}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              "absolute -top-3 -right-3 h-7 w-7 rounded-full border border-graphite/60 bg-carbon/80",
              "flex items-center justify-center text-soft-mist/70 hover:text-signal-white hover:bg-graphite/80",
              "opacity-80 transition-opacity duration-150"
            )}
            aria-label={copied ? "Copied" : "Copy message"}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <div className="whitespace-pre-wrap">
            {children}
          </div>
          {timestamp && (
            <span
              className={cn(
                "absolute bottom-2 right-3 text-xs font-normal opacity-70 select-none",
                isUser ? "text-carbon/60" : "text-soft-mist/60"
              )}
            >
              {formatTime(timestamp)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


