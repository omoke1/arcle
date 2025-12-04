"use client";

import { X, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAgentDisplayName, getAgentDescription, getAgentDefaultSpendingLimit } from "@/core/permissions/agentPermissions";

interface AgentPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  onAllow: () => void;
  onDeny: () => void;
  spendingLimit?: string;
  duration?: number; // Duration in days
}

export function AgentPermissionModal({
  isOpen,
  onClose,
  agentId,
  onAllow,
  onDeny,
  spendingLimit,
  duration = 7,
}: AgentPermissionModalProps) {
  if (!isOpen) return null;

  const agentName = getAgentDisplayName(agentId);
  const agentDescription = getAgentDescription(agentId);
  const defaultSpendingLimit = getAgentDefaultSpendingLimit(agentId);
  const limit = spendingLimit || defaultSpendingLimit;
  
  // Convert from smallest unit (1 USDC = 1000000) to readable format
  const limitInUSDC = (parseFloat(limit) / 1000000).toLocaleString('en-US', {
    maximumFractionDigits: 0,
  });

  // Format capabilities based on agent
  const getCapabilities = () => {
    switch (agentId) {
      case 'inera':
        return ['Send money when you ask', 'Convert currency', 'Move funds across networks', 'Handle payments'];
      case 'payments':
        return ['Send payments', 'Process recurring payments', 'Handle payment links'];
      case 'invoice':
        return ['Create invoices', 'Generate payment links', 'Track payments'];
      case 'remittance':
        return ['Send cross-border payments', 'Convert currency'];
      case 'defi':
        return ['Make trades', 'Manage yield', 'Handle swaps'];
      case 'fx':
        return ['Convert currency', 'Manage exchange rates'];
      case 'commerce':
        return ['Place orders', 'Track deliveries', 'Manage marketplace'];
      case 'insights':
        return ['View spending reports', 'Access analytics'];
      case 'merchant':
        return ['Process payments', 'Handle settlements'];
      case 'compliance':
        return ['Monitor transactions', 'Detect security issues'];
      default:
        return ['Manage your finances'];
    }
  };

  const capabilities = getCapabilities();

  const handleAllow = () => {
    onAllow();
    onClose();
  };

  const handleDeny = () => {
    onDeny();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-onyx border border-white/20 rounded-2xl p-6 max-w-md w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-extralight tracking-wider text-white mb-2 text-center">
          Allow {agentName}?
        </h2>
        <p className="text-white/60 text-sm mb-6 text-center">
          {agentDescription}
        </p>

        {/* Capabilities */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-4">
          <div className="text-white font-medium mb-3">It will:</div>
          <ul className="space-y-2">
            {capabilities.map((capability, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
                <span className="text-white/80 text-sm">{capability}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Limits */}
        <div className="bg-dark-grey border border-white/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-sm">Spending Limit</span>
            <span className="text-white font-medium">${limitInUSDC} USDC</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Duration</span>
            <span className="text-white font-medium">{duration} days</span>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-white/5 border border-white/20 rounded-lg p-4 mb-6">
          <div className="text-white/60 text-sm">
            You can turn this off anytime in Settings.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleDeny}
            className="flex-1 bg-white/10 text-white hover:bg-white/20 border border-white/20"
          >
            Not Now
          </Button>
          <Button
            onClick={handleAllow}
            className="flex-1 bg-white text-onyx hover:bg-white/90 border border-white/20"
          >
            Allow
          </Button>
        </div>
      </div>
    </div>
  );
}

