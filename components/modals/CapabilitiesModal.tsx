"use client";

import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CapabilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  capabilities: {
    voiceCommands: boolean;
    crossChainBridging: boolean;
    defiOperations: boolean;
    yieldFarming: boolean;
    savingsGoals: boolean;
    multiTokenSupport: boolean;
  };
  onToggleCapability: (capability: keyof CapabilitiesModalProps['capabilities']) => void;
}

export function CapabilitiesModal({
  isOpen,
  onClose,
  capabilities,
  onToggleCapability,
}: CapabilitiesModalProps) {
  if (!isOpen) return null;

  const capabilityList = [
    {
      key: 'voiceCommands' as const,
      name: 'Voice Commands',
      description: 'Send payments and check balance using voice',
    },
    {
      key: 'crossChainBridging' as const,
      name: 'Cross-Chain Bridging',
      description: 'Transfer assets between different blockchains',
    },
    {
      key: 'defiOperations' as const,
      name: 'DeFi Operations',
      description: 'Access trading, swaps, and other DeFi features',
    },
    {
      key: 'yieldFarming' as const,
      name: 'Yield Farming',
      description: 'Earn passive income on your USDC holdings',
    },
    {
      key: 'savingsGoals' as const,
      name: 'Savings Goals',
      description: 'Create and manage savings goals with penalties',
    },
    {
      key: 'multiTokenSupport' as const,
      name: 'Multi-Token Support',
      description: 'View and manage multiple token types',
    },
  ];

  const enabledCount = Object.values(capabilities).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-onyx border border-white/20 rounded-2xl p-6 max-w-md w-full relative max-h-[80vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-extralight tracking-wider text-white mb-2">Capabilities</h2>
        <p className="text-white/60 text-sm mb-6">{enabledCount} of {capabilityList.length} features enabled</p>

        {/* Capabilities List */}
        <div className="space-y-3">
          {capabilityList.map((capability) => (
            <div
              key={capability.key}
              onClick={() => onToggleCapability(capability.key)}
              className="bg-dark-grey border border-white/20 rounded-lg p-4 cursor-pointer hover:border-white/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-white font-medium mb-1">{capability.name}</div>
                  <div className="text-white/60 text-sm">{capability.description}</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  capabilities[capability.key]
                    ? 'bg-white border-white'
                    : 'border-white/20'
                }`}>
                  {capabilities[capability.key] && <Check className="w-4 h-4 text-onyx" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Close Button */}
        <Button onClick={onClose} className="w-full mt-6 bg-white text-onyx hover:bg-white/90 border border-white/20">
          Done
        </Button>
      </div>
    </div>
  );
}

