"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentTier = "basic" | "advance" | "pro";

interface TierOption {
  id: AgentTier;
  name: string;
  description: string;
}

const tierOptions: TierOption[] = [
  {
    id: "basic",
    name: "Basic",
    description: "Web2 interactions & everyday tasks",
  },
  {
    id: "advance",
    name: "Advance",
    description: "Web3 DeFi trading & limited blockchain",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Full DeFi & blockchain capabilities",
  },
];

interface TierSelectorProps {
  selectedTier: AgentTier;
  onTierChange: (tier: AgentTier) => void;
}

export function TierSelector({ selectedTier, onTierChange }: TierSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = tierOptions.find((opt) => opt.id === selectedTier) || tierOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative flex items-center h-full" ref={dropdownRef}>
      {/* Header Button - ChatGPT-style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm md:text-base font-medium text-signal-white hover:bg-graphite/50 transition-colors h-full"
      >
        <span>{selectedOption.name}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-graphite border border-graphite/60 rounded-xl shadow-lg overflow-hidden z-50">
          {tierOptions.map((option) => {
            const isSelected = option.id === selectedTier;

            return (
              <button
                key={option.id}
                onClick={() => {
                  onTierChange(option.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-graphite/70 transition-colors",
                  isSelected && "bg-graphite/50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium text-signal-white">
                      {option.name}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-signal-white flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-soft-mist/70 leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

