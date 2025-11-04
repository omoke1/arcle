"use client";

import { SpeechBubbleIcon } from "@/components/ui/SpeechBubbleIcon";

export function EmptyChatState() {
  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "How can I help you this morning?";
    if (hour < 17) return "How can I help you this afternoon?";
    if (hour < 21) return "How can I help you this evening?";
    return "How can I help you tonight?";
  };

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
      {/* Central Icon - Speech Bubble */}
      <div className="mb-8 relative">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500/25 via-orange-500/15 to-orange-600/5 flex items-center justify-center backdrop-blur-sm">
          <SpeechBubbleIcon 
            size={48}
            className="text-orange-500"
          />
        </div>
      </div>
      
      {/* Welcome Message */}
      <h2 className="text-2xl text-white font-medium text-center mb-3 tracking-tight">
        {getGreeting()}
      </h2>
      
      {/* Subtle hint */}
      <p className="text-sm text-casper/60 text-center max-w-sm leading-relaxed">
        I&apos;m your AI wallet assistant. Ask me anything about your wallet.
      </p>
    </div>
  );
}

