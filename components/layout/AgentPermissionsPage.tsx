"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Shield, ToggleLeft, ToggleRight, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentPermissionModal } from "@/components/modals/AgentPermissionModal";
import { 
  AGENT_DISPLAY_NAMES, 
  getAgentDisplayName, 
  getAgentDescription,
  getAgentDefaultSpendingLimit,
  AGENT_PERMISSIONS 
} from "@/core/permissions/agentPermissions";
import { getAgentSessionKey, createAgentSessionKey, revokeAgentSessionKey } from "@/core/sessionKeys/agentSessionKeys";
import { isSessionExpired } from "@/lib/wallet/sessionKeys/sessionPermissions";
import type { CircleSessionKey } from "@/lib/wallet/sessionKeys/sessionPermissions";

interface AgentPermissionsPageProps {
  onBack: () => void;
  walletId?: string | null;
  userId?: string | null;
  userToken?: string | null;
  onComplete?: () => void; // Callback to complete wallet creation flow
}

interface AgentPermissionStatus {
  agentId: string;
  enabled: boolean;
  sessionKey?: CircleSessionKey;
  loading: boolean;
}

export function AgentPermissionsPage({ 
  onBack, 
  walletId: walletIdProp, 
  userId: userIdProp, 
  userToken: userTokenProp,
  onComplete
}: AgentPermissionsPageProps) {
  const [walletId, setWalletId] = useState(walletIdProp);
  const [userId, setUserId] = useState(userIdProp);
  const [userToken, setUserToken] = useState(userTokenProp);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentPermissionStatus>>({});
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load credentials from localStorage if not provided
useEffect(() => {
  if (typeof window === 'undefined') return;

  setUserId((prev) => {
    if (userIdProp && userIdProp !== prev) {
      return userIdProp;
    }
    if (!prev) {
      const storedUserId = localStorage.getItem('arcle_user_id');
      if (storedUserId) {
        return storedUserId;
      }
    }
    return prev;
  });

  setUserToken((prev) => {
    if (userTokenProp && userTokenProp !== prev) {
      return userTokenProp;
    }
    if (!prev) {
      const storedUserToken = localStorage.getItem('arcle_user_token');
      if (storedUserToken) {
        return storedUserToken;
      }
    }
    return prev;
  });

  setWalletId((prev) => {
    if (walletIdProp && walletIdProp !== prev) {
      return walletIdProp;
    }
    if (!prev) {
      const storedWalletId = localStorage.getItem('arcle_wallet_id');
      if (storedWalletId) {
        return storedWalletId;
      }
    }
    return prev;
  });
}, [userIdProp, userTokenProp, walletIdProp]);

  const loadAgentStatuses = useCallback(async () => {
    if (!walletId || !userId || !userToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const statuses: Record<string, AgentPermissionStatus> = {};

    // Use API route to get all session keys for the wallet (more efficient)
    try {
      const response = await fetch(
        `/api/session-keys/wallet?walletId=${encodeURIComponent(walletId)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const sessionKeys = data.sessionKeys || [];
        
        // Create a map of agentId -> sessionKey for quick lookup
        const sessionKeyMap = new Map<string, CircleSessionKey>();
        for (const sessionKey of sessionKeys) {
          if (sessionKey.agentId && !isSessionExpired(sessionKey)) {
            sessionKeyMap.set(sessionKey.agentId, sessionKey);
          }
        }

        // Check each agent
        for (const agentId of Object.keys(AGENT_DISPLAY_NAMES)) {
          const sessionKey = sessionKeyMap.get(agentId);
          statuses[agentId] = {
            agentId,
            enabled: !!sessionKey,
            sessionKey: sessionKey || undefined,
            loading: false,
          };
        }
      } else {
        // Fallback: check each agent individually
        for (const agentId of Object.keys(AGENT_DISPLAY_NAMES)) {
          try {
            const sessionKey = await getAgentSessionKey(walletId, userId, userToken, agentId);
            statuses[agentId] = {
              agentId,
              enabled: !!sessionKey && !isSessionExpired(sessionKey),
              sessionKey: sessionKey || undefined,
              loading: false,
            };
          } catch (error) {
            console.error(`[Agent Permissions] Error loading status for ${agentId}:`, error);
            statuses[agentId] = {
              agentId,
              enabled: false,
              loading: false,
            };
          }
        }
      }
    } catch (error) {
      console.error('[Agent Permissions] Error loading agent statuses:', error);
      // Set all to disabled on error
      for (const agentId of Object.keys(AGENT_DISPLAY_NAMES)) {
        statuses[agentId] = {
          agentId,
          enabled: false,
          loading: false,
        };
      }
    }

    setAgentStatuses(statuses);
    setLoading(false);
  }, [walletId, userId, userToken]);

  useEffect(() => {
    if (walletId && userId && userToken) {
      loadAgentStatuses();
    }
  }, [walletId, userId, userToken, loadAgentStatuses]);

  const handleToggleAgent = async (agentId: string) => {
    if (!walletId || !userId || !userToken) return;

    const currentStatus = agentStatuses[agentId];
    
    if (currentStatus.enabled) {
      // Disable agent (revoke session key)
      if (currentStatus.sessionKey) {
        setAgentStatuses(prev => ({
          ...prev,
          [agentId]: { ...prev[agentId], loading: true },
        }));

        try {
          const result = await revokeAgentSessionKey(
            agentId,
            currentStatus.sessionKey.sessionKeyId,
            walletId,
            userId,
            userToken
          );

          if (result) {
            await loadAgentStatuses();
          }
        } catch (error) {
          console.error(`[Agent Permissions] Error revoking session for ${agentId}:`, error);
        }
      }
    } else {
      // Enable agent (show permission modal)
      setSelectedAgentId(agentId);
      setShowPermissionModal(true);
    }
  };

  const handleAllowAgent = async () => {
    if (!selectedAgentId || !walletId || !userId || !userToken) return;

    setAgentStatuses(prev => ({
      ...prev,
      [selectedAgentId]: { ...prev[selectedAgentId], loading: true },
    }));

    try {
      // Use API route for session key creation (Circle SDK requires server-side)
      const response = await fetch('/api/session-keys/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          userId,
          userToken,
          agent: selectedAgentId,
          duration: 7 * 24 * 60 * 60, // 7 days
          autoRenew: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        await loadAgentStatuses();
        
        // If challengeId is returned, user needs to complete PIN challenge
        if (result.challengeId) {
          // TODO: Show PIN widget for challenge completion
          console.log(`[Agent Permissions] Session key created, challenge required: ${result.challengeId}`);
        }
      } else {
        console.error(`[Agent Permissions] Failed to create session for ${selectedAgentId}:`, result.error);
        // Show error to user (could add toast notification here)
      }
    } catch (error) {
      console.error(`[Agent Permissions] Error creating session for ${selectedAgentId}:`, error);
    }

    setShowPermissionModal(false);
    setSelectedAgentId(null);
  };

  const handleDenyAgent = () => {
    setShowPermissionModal(false);
    setSelectedAgentId(null);
  };

  const formatSpendingLimit = (agentId: string): string => {
    const limit = getAgentDefaultSpendingLimit(agentId);
    const limitInUSDC = (parseFloat(limit) / 1000000).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
    return `$${limitInUSDC}`;
  };

  const formatSpendingUsed = (sessionKey?: CircleSessionKey): string => {
    if (!sessionKey) return '$0';
    const used = parseFloat(sessionKey.permissions.spendingUsed || '0') / 1000000;
    return `$${used.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  const formatTimeRemaining = (sessionKey?: CircleSessionKey): string => {
    if (!sessionKey) return '';
    const now = Date.now();
    const expires = sessionKey.expiresAt * 1000;
    const remaining = expires - now;
    
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return 'Less than 1 hour';
  };

  if (!walletId || !userId || !userToken) {
    return (
      <div className="flex flex-col h-full bg-dark-grey">
        <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-casper hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Security & Permissions</h1>
          <div className="w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60 text-sm text-center px-4">
            Please create a wallet first to manage agent permissions.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-dark-grey">
        <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-casper hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Security & Permissions</h1>
          <div className="w-5" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60 text-sm">Loading permissions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={() => {
            // If onComplete is provided, call it to complete wallet creation flow
            if (onComplete) {
              onComplete();
            }
            onBack();
          }}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Security & Permissions</h1>
        <div className="w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-hide">
        <div className="text-white/60 text-sm mb-4">
          Manage which assistants can manage your finances. You can turn any of these off anytime.
        </div>

        {/* Agent Permissions List */}
        {Object.keys(AGENT_DISPLAY_NAMES).map((agentId) => {
          const status = agentStatuses[agentId];
          const agentName = getAgentDisplayName(agentId);
          const agentDescription = getAgentDescription(agentId);
          const isEnabled = status?.enabled || false;
          const sessionKey = status?.sessionKey;

          return (
            <div
              key={agentId}
              className="bg-onyx border border-white/20 rounded-xl p-4 space-y-3"
            >
              {/* Header Row */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className={`w-4 h-4 ${isEnabled ? 'text-white' : 'text-white/40'}`} />
                    <h3 className="text-white font-medium">{agentName}</h3>
                    {isEnabled && (
                      <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                        Enabled
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-xs">{agentDescription}</p>
                </div>
                <button
                  onClick={() => handleToggleAgent(agentId)}
                  disabled={status?.loading}
                  className="ml-4"
                >
                  {isEnabled ? (
                    <ToggleRight className="w-8 h-8 text-white" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-white/40" />
                  )}
                </button>
              </div>

              {/* Status Details (only show if enabled) */}
              {isEnabled && sessionKey && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-white/60">
                      <DollarSign className="w-4 h-4" />
                      <span>Spending</span>
                    </div>
                    <span className="text-white">
                      {formatSpendingUsed(sessionKey)} / {formatSpendingLimit(agentId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-white/60">
                      <Clock className="w-4 h-4" />
                      <span>Expires</span>
                    </div>
                    <span className="text-white">{formatTimeRemaining(sessionKey)}</span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {status?.loading && (
                <div className="text-white/60 text-xs">Processing...</div>
              )}
            </div>
          );
        })}

        {/* Info Box */}
        <div className="bg-white/5 border border-white/20 rounded-lg p-4 mt-4">
          <div className="text-white/60 text-sm">
            <strong className="text-white/80">Note:</strong> When you enable an assistant, it can automatically execute transactions within its spending limit. You can revoke access at any time.
          </div>
        </div>
      </div>

      {/* Permission Modal */}
      {selectedAgentId && (
        <AgentPermissionModal
          isOpen={showPermissionModal}
          onClose={() => {
            setShowPermissionModal(false);
            setSelectedAgentId(null);
          }}
          agentId={selectedAgentId}
          onAllow={handleAllowAgent}
          onDeny={handleDenyAgent}
          duration={7}
        />
      )}
    </div>
  );
}

