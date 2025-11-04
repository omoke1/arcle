"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModelSelector } from "./ModelSelector";
import { Button } from "@/components/ui/button";

interface ChatHeaderProps {
  onUpgrade?: () => void;
}

export function ChatHeader({ onUpgrade }: ChatHeaderProps) {
  const router = useRouter();

  return (
    <div className="sticky top-0 z-40 bg-onyx border-b border-dark-grey/50">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: Back Button */}
        <button
          onClick={() => router.back()}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center: Model Selector */}
        <div className="flex-1 flex justify-center">
          <ModelSelector />
        </div>

        {/* Right: Ghost Icon & Upgrade Button */}
        <div className="flex items-center gap-3">
          <button
            className="text-casper hover:text-white transition-colors"
            onClick={() => {
              // TODO: Open profile/settings
            }}
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </button>
          {onUpgrade && (
            <Button
              onClick={onUpgrade}
              variant="ghost"
              size="sm"
              className="text-white hover:text-white/80 hover:bg-dark-grey/50"
            >
              Upgrade
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

