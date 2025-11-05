"use client";

import { SpeechBubbleIcon } from "@/components/ui/SpeechBubbleIcon";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";

export function TypingIndicator() {
  return (
    <div className="flex w-full mb-5 justify-start">
      <div className="flex flex-col items-start w-full">
        {/* Typing Bubble with Tail */}
        <div className="relative">
          {/* Bubble */}
          <div
            className="px-4 py-3 bg-white text-onyx inline-block min-w-[120px] sm:min-w-[140px] max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] break-words"
            style={{
              borderRadius: "10px 10px 10px 2px", // Same as AI message bubble - sharp rectangle
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <SpeechBubbleIcon size={16} className="text-onyx" />
              <span className="text-sm font-medium text-onyx">ARCLE</span>
              <VerifiedBadge size={14} variant="dark" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[15px] text-onyx">Typing</span>
              <div className="flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 bg-onyx rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-onyx rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-onyx rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>

          {/* Tail - triangular extension */}
          <div
            className="absolute bottom-0 left-0 -ml-1 border-r-[8px] border-r-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent"
          />
        </div>
      </div>
    </div>
  );
}

