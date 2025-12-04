"use client";

import { SpeechBubbleIcon } from "@/components/ui/SpeechBubbleIcon";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cn } from "@/lib/utils";

export function TypingIndicator() {
  return (
    <div className="flex w-full mb-5 justify-start">
      <div className="flex flex-col items-start w-full">
        {/* Typing Bubble with Tail */}
        <div className="relative">
          {/* Bubble */}
          <div
            className={cn(
              "px-4 py-3 inline-block min-w-[120px] sm:min-w-[140px] max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] break-words",
              "bg-[#2A2A2A] text-signal-white border border-graphite/60 rounded-3xl rounded-bl-sm",
              "shadow-[0_0_16px_rgba(53,53,53,0.6)]"
            )}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <SpeechBubbleIcon size={16} className="text-aurora" />
              <span className="text-sm font-medium text-signal-white">ARCLE</span>
              <VerifiedBadge size={14} variant="light" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[15px] text-signal-white">Typing</span>
              <div className="flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 bg-signal-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-signal-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-signal-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>

          {/* Tail - triangular extension */}
          <div className="absolute bottom-0 left-0 -ml-1 border-r-[8px] border-r-[#2A2A2A] border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent" />
        </div>
      </div>
    </div>
  );
}

