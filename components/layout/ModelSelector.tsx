"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

interface AIModel {
  id: string;
  name: string;
  description: string;
  isPro?: boolean;
}

const AI_MODELS: AIModel[] = [
  {
    id: "op4.1",
    name: "Opus 4.1",
    description: "Deep brainstorming model. Consumes usage faster.",
    isPro: true,
  },
  {
    id: "sn4.5",
    name: "Sonnet 4.5",
    description: "Smartest for everyday tasks.",
    isPro: false,
  },
  {
    id: "hk4.5",
    name: "Haiku 4.5",
    description: "Fastest for quick answers.",
    isPro: false,
  },
];

const MORE_MODELS: AIModel[] = [
  { id: "op4", name: "Opus 4", description: "Previous generation Opus model.", isPro: true },
  { id: "sn4", name: "Sonnet 4", description: "Previous generation Sonnet model.", isPro: true },
  { id: "sn3.7", name: "Sonnet 3.7", description: "Legacy Sonnet model.", isPro: true },
  { id: "op3", name: "Opus 3", description: "Legacy Opus model.", isPro: true },
  { id: "hk3.5", name: "Haiku 3.5", description: "Legacy Haiku model.", isPro: true },
];

interface ModelSelectorProps {
  currentModel?: string;
  onModelSelect?: (modelId: string) => void;
}

export function ModelSelector({ currentModel = "sn4.5", onModelSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(currentModel);

  const currentModelData = [...AI_MODELS, ...MORE_MODELS].find((m) => m.id === selectedModel) || AI_MODELS[1];

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    onModelSelect?.(modelId);
    setIsOpen(false);
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "How can I help you this morning?";
    if (hour < 17) return "How can I help you this afternoon?";
    if (hour < 21) return "How can I help you this evening?";
    return "How can I help you tonight?";
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
      >
        <span className="text-base font-medium">{currentModelData.name}</span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Bottom Sheet */}
      <BottomSheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        {/* Greeting */}
        <div className="text-center mb-6">
          <h3 className="text-lg text-white font-medium">{getGreeting()}</h3>
        </div>

        {/* Model List */}
        <div className="space-y-1">
          {AI_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model.id)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl transition-colors",
                "hover:bg-dark-grey/50",
                selectedModel === model.id && "bg-dark-grey/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{model.name}</span>
                    {model.isPro && (
                      <span className="px-2 py-0.5 bg-white text-onyx text-xs font-medium rounded">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-casper/70">{model.description}</p>
                </div>
                {selectedModel === model.id && (
                  <Check className="w-5 h-5 text-white flex-shrink-0 ml-4" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="my-4 border-t border-dark-grey/50" />

        {/* More Models Section */}
        <div className="mb-2">
          <p className="text-xs text-casper/70 uppercase tracking-wide mb-3 px-4">
            More models
          </p>
          <div className="space-y-1">
            {MORE_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl transition-colors",
                  "hover:bg-dark-grey/50",
                  selectedModel === model.id && "bg-dark-grey/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{model.name}</span>
                    {model.isPro && (
                      <span className="px-2 py-0.5 bg-white text-onyx text-xs font-medium rounded">
                        PRO
                      </span>
                    )}
                  </div>
                  {selectedModel === model.id && (
                    <Check className="w-5 h-5 text-white flex-shrink-0 ml-4" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </BottomSheet>
    </>
  );
}

