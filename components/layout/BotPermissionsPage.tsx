"use client";

import { useState } from "react";
import { ArrowLeft, Check, Shield, DollarSign, CreditCard, ArrowLeftRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BotPermissionsPageProps {
  onBack: () => void;
  onComplete: () => void;
  walletId: string;
  walletAddress: string;
}

type PermissionType = "send" | "receive" | "bridge" | "pay" | "yield";

interface Permission {
  id: PermissionType;
  name: string;
  description: string;
  icon: React.ReactNode;
  defaultEnabled?: boolean;
}

const PERMISSIONS: Permission[] = [
  {
    id: "send",
    name: "Send Transactions",
    description: "Allow AI to send USDC on your behalf",
    icon: <DollarSign className="w-5 h-5" />,
    defaultEnabled: true,
  },
  {
    id: "receive",
    name: "Receive Funds",
    description: "Allow AI to show your address and receive funds",
    icon: <Shield className="w-5 h-5" />,
    defaultEnabled: true,
  },
  {
    id: "bridge",
    name: "Cross-Chain Bridge",
    description: "Allow AI to bridge USDC across chains",
    icon: <ArrowLeftRight className="w-5 h-5" />,
    defaultEnabled: false,
  },
  {
    id: "pay",
    name: "Make Payments",
    description: "Allow AI to process payments and subscriptions",
    icon: <CreditCard className="w-5 h-5" />,
    defaultEnabled: false,
  },
  {
    id: "yield",
    name: "Yield Farming",
    description: "Allow AI to manage yield positions",
    icon: <TrendingUp className="w-5 h-5" />,
    defaultEnabled: false,
  },
];

export function BotPermissionsPage({ onBack, onComplete, walletId, walletAddress }: BotPermissionsPageProps) {
  const [permissions, setPermissions] = useState<Record<PermissionType, boolean>>(
    PERMISSIONS.reduce((acc, perm) => {
      acc[perm.id] = perm.defaultEnabled ?? false;
      return acc;
    }, {} as Record<PermissionType, boolean>)
  );

  const togglePermission = (id: PermissionType) => {
    setPermissions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleComplete = () => {
    // Save permissions to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(`arcle_permissions_${walletId}`, JSON.stringify(permissions));
    }
    onComplete();
  };

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Bot Permissions</h1>
        <div className="w-5 h-5" /> {/* Spacer */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar-hide">
        {/* Info Card */}
        <div className="bg-onyx rounded-xl px-4 py-4">
          <h3 className="text-base font-semibold text-white mb-2">Set AI Permissions</h3>
          <p className="text-sm text-casper/70">
            Configure what actions the AI assistant can perform on your wallet. You can change these later.
          </p>
        </div>

        {/* Permissions List */}
        <div className="space-y-2">
          {PERMISSIONS.map((permission) => (
            <button
              key={permission.id}
              onClick={() => togglePermission(permission.id)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-colors ${
                permissions[permission.id]
                  ? "bg-onyx border border-white/20"
                  : "bg-onyx/50 border border-dark-grey/50"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 text-left">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  permissions[permission.id]
                    ? "bg-white/10 text-white"
                    : "bg-dark-grey text-casper"
                }`}>
                  {permission.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{permission.name}</div>
                  <div className="text-xs text-casper/70 mt-0.5">{permission.description}</div>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full relative transition-colors ${
                permissions[permission.id] ? "bg-white" : "bg-dark-grey"
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  permissions[permission.id] ? "right-0.5" : "left-0.5"
                }`} />
              </div>
            </button>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-onyx rounded-xl px-4 py-4">
          <p className="text-xs text-casper/70">
            {Object.values(permissions).filter(Boolean).length} of {PERMISSIONS.length} permissions enabled
          </p>
        </div>

        {/* Complete Button */}
        <Button
          onClick={handleComplete}
          className="w-full bg-white hover:bg-white/80 text-onyx font-medium py-3 rounded-xl"
        >
          <Check className="w-4 h-4 mr-2" />
          Complete Setup
        </Button>
      </div>
    </div>
  );
}

