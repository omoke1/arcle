"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { MainLayout } from "@/components/layout/MainLayout";
import { WelcomeScreen } from "@/components/layout/WelcomeScreen";
import { useSettings } from "@/lib/settings/use-settings";
import { TransactionPreviewMessage } from "@/components/chat/TransactionPreviewMessage";
import { CirclePinWidget } from "@/components/wallet/CirclePinWidget";
import { SessionApprovalModal } from "@/components/wallet/SessionApprovalModal";
import { SessionStatus } from "@/components/wallet/SessionStatus";
import { AutoExecutionBadge } from "@/components/wallet/AutoExecutionBadge";
import { SessionManagement } from "@/components/wallet/SessionManagement";
import { isSessionKeysEnabled } from "@/lib/config/featureFlags";
// Note: checkSessionKeyStatus is dynamically imported to avoid SSR issues with Circle SDK
import { useCircle } from "@/hooks/useCircle";
import { AIService } from "@/lib/ai/ai-service";
import { processMessageWithAgents, shouldUseAgentRouter } from "@/lib/ai/agentIntegration";
import { isAgentRouterEnabled } from "@/lib/config/featureFlags";
import { AgentTier } from "@/components/ui/TierSelector";
import { updateAddressHistory, calculateRiskScore } from "@/lib/security/risk-scoring";
import { validateAddress } from "@/lib/security/address-validation";
import type { ChatMessage, Transaction } from "@/types";
import { findDueReminders, findDueCharges, scheduleNext, updateSubscription } from "@/lib/subscriptions";
import { monitorTransaction } from "@/lib/notifications/transaction-monitor";
import { startBalanceMonitoring, stopBalanceMonitoring } from "@/lib/notifications/balance-monitor";
import { startIncomingTransactionMonitoring, stopIncomingTransactionMonitoring } from "@/lib/notifications/incoming-transaction-monitor";
// notifications imports removed as they were unused
import { hasValidAccess } from "@/lib/auth/invite-codes";
import { refreshUserToken, checkTokenExpiry } from "@/lib/circle/token-refresh";
import {
  getOrCreateSessionId,
  saveUserCredentials,
  loadUserCredentials,
  clearUserCredentials,
  saveWalletData,
  loadWalletData,
  clearWalletData,
} from "@/lib/supabase-data";

export default function ChatPage() {
  const router = useRouter();
  const { createUser, createWallet, listWallets, sendTransaction, getBalance, getTransactionStatus, requestTestnetTokens, bridgeTransaction, getBridgeStatus } = useCircle();

  // Check invite code verification on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAccess = async () => {
        const hasAccess = await hasValidAccess();
        if (!hasAccess) {
          // User doesn't have valid access, redirect to landing page
          router.push('/');
        }
      };
      checkAccess();
    }
  }, [router]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.00");
  const [userId, setUserId] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<AgentTier>("basic");

  // Get user settings for display name
  const { settings } = useSettings(userId || undefined);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPinWidget, setShowPinWidget] = useState(false);
  const [showSessionApproval, setShowSessionApproval] = useState(false);
  const [sessionKeyStatus, setSessionKeyStatus] = useState<{
    hasActiveSession: boolean;
    canAutoExecute: boolean;
    sessionKeyId?: string;
  } | null>(null);
  const [challengeData, setChallengeData] = useState<{
    challengeId: string;
    userId: string;
    userToken: string;
    encryptionKey?: string;
    // Transaction challenge details (if this is a transaction challenge, not wallet creation)
    transactionChallenge?: {
      walletId: string;
      destinationAddress: string;
      amount: string;
      messageId: string;
    };
    // Gateway deposit challenge details
    gatewayDeposit?: {
      walletId: string;
      fromChain: string;
      toChain: string;
      amount: string;
      destinationAddress: string;
      messageId: string;
    };
    // Gateway transfer signing challenge details
    gatewayTransfer?: {
      walletId: string;
      burnIntent: any;
      fromChain: string;
      toChain: string;
      amount: string;
      destinationAddress: string;
      messageId: string;
    };
  } | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<{
    messageId: string;
    amount: string;
    to: string;
  } | null>(null);
  const [pendingUSYC, setPendingUSYC] = useState<{
    messageId: string;
    action: 'subscribe' | 'redeem';
    amount: string;
    blockchain?: string;
    step?: 'approve' | 'complete';
  } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const hasHydratedMessagesRef = useRef(false);

  // Initialize session ID from Supabase
  useEffect(() => {
    const initSessionId = async () => {
      if (typeof window !== "undefined" && userId) {
        try {
          const id = await getOrCreateSessionId(userId);
          setSessionId(id);
        } catch (error) {
          console.error("[ChatPage] Failed to get/create session ID:", error);
          // Fallback to local UUID if Supabase fails
          const fallbackId = crypto.randomUUID();
          setSessionId(fallbackId);
        }
      } else if (typeof window !== "undefined" && !userId) {
        // Temporary session ID until userId is available
        const tempId = crypto.randomUUID();
        setSessionId(tempId);
      }
    };
    initSessionId();
  }, [userId]);

  const creatingRef = useRef(false);
  const processingChallengeRef = useRef(false);

  const pushAssistant = (text: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  };

  // Wallets are now created ONLY when the user explicitly requests it

  // Save user credentials to Supabase whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && userId && userToken) {
      saveUserCredentials(userId, { userToken, encryptionKey: encryptionKey || undefined }, walletAddress || undefined)
        .catch(error => console.error("[ChatPage] Failed to save credentials:", error));
    }
  }, [userId, userToken, encryptionKey, walletAddress]);

  // Load credentials from Supabase (with migration from localStorage)
  useEffect(() => {
    const loadCredentials = async () => {
      if (typeof window === 'undefined') return;

      // Migration: Check localStorage first, then migrate to Supabase
      const legacyUserId = localStorage.getItem('arcle_user_id');
      const legacyUserToken = localStorage.getItem('arcle_user_token');
      const legacyEncryptionKey = localStorage.getItem('arcle_encryption_key');

      if (legacyUserId && legacyUserToken) {
        // Migrate from localStorage to Supabase
        try {
          // Try to get wallet address if available
          const legacyWalletAddress = localStorage.getItem('arcle_wallet_address');
          await saveUserCredentials(legacyUserId, {
            userToken: legacyUserToken,
            encryptionKey: legacyEncryptionKey || undefined
          }, legacyWalletAddress || undefined);
          // Clear localStorage after successful migration
          localStorage.removeItem('arcle_user_id');
          localStorage.removeItem('arcle_user_token');
          localStorage.removeItem('arcle_encryption_key');
          console.log("[ChatPage] ✅ Migrated credentials from localStorage to Supabase");
        } catch (error) {
          console.error("[ChatPage] Failed to migrate credentials:", error);
        }

        // Update state with migrated credentials
        if (!userId || !userToken || userToken !== legacyUserToken) {
          console.log("[ChatPage] Reloading credentials (migrated from localStorage)", {
            hadUserId: !!userId,
            hadUserToken: !!userToken,
            tokenChanged: userToken !== legacyUserToken,
          });
        }
        setUserId(legacyUserId);
        setUserToken(legacyUserToken);
        if (legacyEncryptionKey) {
          setEncryptionKey(legacyEncryptionKey);
        }
        return;
      }

      // If we have userId in state, try to load credentials from Supabase
      if (userId && (!userToken || !encryptionKey)) {
        try {
          const credentials = await loadUserCredentials(userId);
          if (credentials.userToken) {
            setUserToken(credentials.userToken);
            if (credentials.encryptionKey) {
              setEncryptionKey(credentials.encryptionKey);
            }
            console.log("[ChatPage] ✅ Loaded credentials from Supabase");
          } else if (userId && !credentials.userToken) {
            // If we have userId but no token, try to refresh/create token
            console.log("[ChatPage] 🔄 userId found but userToken missing, attempting to refresh token...");
            refreshUserToken().then((newToken) => {
              if (newToken) {
                console.log("[ChatPage] ✅ Token created/refreshed successfully");
                setUserToken(newToken.userToken);
                if (newToken.encryptionKey) {
                  setEncryptionKey(newToken.encryptionKey);
                }
              } else {
                console.warn("[ChatPage] ⚠️ Failed to refresh token. User may need to create a new wallet.");
              }
            }).catch((error) => {
              console.error("[ChatPage] Error refreshing token:", error);
            });
          }
        } catch (error) {
          console.error("[ChatPage] Failed to load credentials from Supabase:", error);
        }
      }
    };

    loadCredentials();
  }, [userId, userToken, encryptionKey]); // Re-check when state changes

  // Proactive token refresh - refresh tokens before they expire
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (typeof window === 'undefined' || !userToken) return;

      try {
        const expiry = checkTokenExpiry(userToken, 5); // Check if expiring in < 5 minutes

        if (expiry.isExpiringSoon && !expiry.isExpired) {
          console.log('[ChatPage] 🔄 Token expiring soon, refreshing proactively...');
          const newToken = await refreshUserToken();

          if (newToken) {
            console.log('[ChatPage] ✅ Token refreshed proactively');
            // Update state with new token
            setUserToken(newToken.userToken);
            if (newToken.encryptionKey) {
              setEncryptionKey(newToken.encryptionKey);
            }
          } else {
            console.warn('[ChatPage] ⚠️ Proactive token refresh failed');
          }
        }
      } catch (error) {
        console.error('[ChatPage] Error in proactive token refresh:', error);
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Check every 5 minutes
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userToken]);

  // Hydrate chat history from Supabase once we have a stable userId and sessionId
  useEffect(() => {
    const hydrateHistory = async () => {
      if (hasHydratedMessagesRef.current) return;
      if (!userId || !sessionId) return;
      if (typeof window === "undefined") return;

      try {
        const response = await fetch(
          `/api/chat/history?sessionId=${encodeURIComponent(
            sessionId
          )}&userId=${encodeURIComponent(userId)}`
        );

        if (!response.ok) {
          console.warn(
            "[ChatPage] Failed to load chat history:",
            await response.text()
          );
          return;
        }

        const data = await response.json();
        const history = (data.messages || []) as ChatMessage[];

        if (!Array.isArray(history) || history.length === 0) {
          hasHydratedMessagesRef.current = true;
          return;
        }

        // Only hydrate if we don't already have messages to avoid flicker/duplication.
        setMessages((prev) => {
          if (prev.length === 0) {
            return history;
          }

          const existingIds = new Set(prev.map((m) => m.id));
          const merged = [...prev];

          for (const msg of history) {
            if (!existingIds.has(msg.id)) {
              merged.push(msg);
            }
          }

          return merged;
        });

        hasHydratedMessagesRef.current = true;
      } catch (error) {
        console.warn("[ChatPage] Error hydrating chat history:", error);
      }
    };

    hydrateHistory();
  }, [userId, sessionId]);

  // Debug: Log PIN widget state changes
  useEffect(() => {
    console.log("[PIN Widget State] showPinWidget changed:", showPinWidget);
    console.log("[PIN Widget State] challengeData:", challengeData ? {
      challengeId: challengeData.challengeId,
      hasUserId: !!challengeData.userId,
      hasUserToken: !!challengeData.userToken,
      hasEncryptionKey: !!challengeData.encryptionKey,
    } : null);
    if (showPinWidget && challengeData) {
      console.log("[PIN Widget State] ✅✅✅ PIN widget should be visible now!");
    }
  }, [showPinWidget, challengeData]);

  // Load wallet from Supabase on mount and fetch real balance
  useEffect(() => {
    const loadWallet = async () => {
      if (typeof window === 'undefined' || !userId) return;

      // Migration: Check localStorage first, then migrate to Supabase
      const legacyWalletId = localStorage.getItem('arcle_wallet_id');
      const legacyWalletAddress = localStorage.getItem('arcle_wallet_address');

      if (legacyWalletId && legacyWalletAddress) {
        // Migrate from localStorage to Supabase
        try {
          await saveWalletData(userId, { walletId: legacyWalletId, walletAddress: legacyWalletAddress });
          // Clear localStorage after successful migration
          localStorage.removeItem('arcle_wallet_id');
          localStorage.removeItem('arcle_wallet_address');
          console.log("[ChatPage] ✅ Migrated wallet data from localStorage to Supabase");
        } catch (error) {
          console.error("[ChatPage] Failed to migrate wallet data:", error);
        }

        setWalletId(legacyWalletId);
        setWalletAddress(legacyWalletAddress);
        setHasWallet(true);
      } else {
        // Load from Supabase
        try {
          const walletData = await loadWalletData(userId);
          if (walletData.walletId && walletData.walletAddress) {
            setWalletId(walletData.walletId);
            setWalletAddress(walletData.walletAddress);
            setHasWallet(true);
          } else {
            setHasWallet(false);
            setBalance("0.00");
            return;
          }
        } catch (error) {
          console.error("[ChatPage] Failed to load wallet data from Supabase:", error);
          setHasWallet(false);
          setBalance("0.00");
          return;
        }
      }

      // Fetch real balance from API/blockchain (no mock data)
      const currentWalletId = walletId || (legacyWalletId ?? null);
      const currentWalletAddress = walletAddress || (legacyWalletAddress ?? null);

      if (currentWalletId && currentWalletAddress) {
        const balance = await getBalance(currentWalletId, currentWalletAddress, userId, userToken || undefined);
        if (balance) {
          setBalance(balance);
        } else {
          // If balance fetch fails, set to 0 (not a mock, just fallback)
          setBalance("0.00");
        }

        // Start balance monitoring for state updates (not notifications)
        // Balance notifications are handled by transaction completion handlers
        startBalanceMonitoring({
          walletId: currentWalletId,
          walletAddress: currentWalletAddress,
          pollInterval: 15000, // Check every 15 seconds
          enabled: true,
          onBalanceChange: (oldBalance, newBalance, change) => {
            // Only update balance state silently - don't show chat notifications
            // Notifications are handled by transaction completion handlers
            setBalance(newBalance);
          },
        });

        // Start incoming transaction monitoring for scam token detection
        startIncomingTransactionMonitoring({
          walletId: currentWalletId,
          walletAddress: currentWalletAddress,
          pollInterval: 8000, // Check every 8 seconds (faster for better UX)
          enabled: true,
          onIncomingToken: async (transfer) => {
            // Refresh balance when incoming transaction is detected
            // Don't add chat messages - transactions appear in transaction history panel
            if (currentWalletId && currentWalletAddress) {
              const updatedBalance = await getBalance(
                currentWalletId,
                currentWalletAddress,
                userId,
                userToken || undefined
              );
              if (updatedBalance) {
                setBalance(updatedBalance);
              }
            }

            // Trigger transaction history refresh instead of adding chat message
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
            }
          },
          onSuspiciousToken: (transfer) => {
            // Suspicious/scam token - requires approval (keep this as it's a security alert)
            const analysis = transfer.analysis!;
            const notificationMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `🚨 SUSPICIOUS TOKEN DETECTED\n\nToken: ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\nAmount: ${transfer.amount}\nFrom: ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\nRisk Score: ${analysis.riskScore}/100 (${analysis.riskLevel.toUpperCase()})\n\nRisk Reasons:\n${analysis.riskReasons.map(r => `• ${r}`).join('\n')}\n\n⚠️ This token has been blocked for your safety.\n\nTo approve it, say: "Approve token" or "Accept token"\nTo reject it, say: "Reject token" or "Block token"`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, notificationMsg]);
          },
        });
      }
    };

    loadWallet();

    // Cleanup: stop balance monitoring on unmount
    return () => {
      if (walletId && walletAddress) {
        stopBalanceMonitoring(walletId, walletAddress);
        if (walletAddress) {
          stopIncomingTransactionMonitoring(walletId, walletAddress);
        }
      }
    };
  }, [router, getBalance, walletId, walletAddress, userId, userToken]);

  // Removed periodic background polling for balances to honor on-demand fetching

  // Reminder loop: check subscriptions and scheduled payments every 60s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (typeof window === 'undefined' || !userId) return;
      const now = Date.now();

      try {
        const reminders = await findDueReminders(userId);
        for (const s of reminders) {
          await updateSubscription(s.id, { lastReminderShownAt: now });

          const msg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Reminder: your ${s.merchant} subscription (${s.amount} ${s.currency}) renews in 2 days (${new Date(s.nextChargeAt).toLocaleString()}). Would you like to renew?`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
        }

        const charges = await findDueCharges(userId);
        for (const s of charges) {
          await scheduleNext(s);
          const msg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Auto-renewed ${s.merchant} for ${s.amount} ${s.currency}. Next renewal scheduled.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, msg]);
        }
      } catch (error) {
        console.warn("[ChatPage] Subscription reminder loop error:", error);
      }

      if (hasWallet && walletId && walletAddress) {
        const { findDuePayments, markAsExecuted, markAsFailed } = await import("@/lib/scheduled-payments");
        const duePayments = await findDuePayments(userId, now);

        for (const payment of duePayments) {
          try {
            // Execute the payment
            const response = await sendTransaction(
              walletId!,
              payment.toAddress,
              payment.amount,
              walletAddress,
              userId || undefined,
              userToken || undefined
            );

            if (response && response.type === "transaction" && response.transaction?.id) {
              await markAsExecuted(payment.id, response.transaction.id);
              const msg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `✅ Scheduled payment executed! Sent $${payment.amount} USDC to ${payment.toAddress.substring(0, 6)}...${payment.toAddress.substring(38)}. Transaction ID: ${response.transaction.id}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, msg]);
            } else if (response && response.type === "challenge") {
              // Challenge required - skip for scheduled payments (they'll need manual approval)
              await markAsFailed(payment.id, "PIN challenge required - manual approval needed");
              console.log("[Scheduled Payment] Challenge required, skipping automatic execution");
            } else {
              await markAsFailed(payment.id, "Transaction failed");
              const msg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `❌ Scheduled payment failed: Transaction could not be completed. Please check your balance and try again.`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, msg]);
            }
          } catch (error: any) {
            await markAsFailed(payment.id, error.message || "Execution error");
            const msg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `❌ Scheduled payment failed: ${error.message || "An error occurred"}.`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, msg]);
          }
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [hasWallet, walletId, walletAddress, userId, userToken, sendTransaction]);

  const handleLogout = async () => {
    // Clear wallet data from Supabase
    if (typeof window !== 'undefined' && userId) {
      try {
        await clearWalletData(userId);
        await clearUserCredentials(userId);
      } catch (error) {
        console.error("[ChatPage] Failed to clear data from Supabase:", error);
      }
    }

    // Reset state
    setWalletId(null);
    setWalletAddress(null);
    setHasWallet(false);
    setUserId(null);
    setUserToken(null);
    setEncryptionKey(null);
    setMessages([]);

    // Redirect to home page
    router.push("/");
  };

  const handleSendMessage = async (content: string, replyTo?: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
      replyTo: replyTo || replyToMessageId || undefined,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Clear reply after sending
    if (replyToMessageId) {
      setReplyToMessageId(null);
    }

    setIsLoading(true);

    // Add 3-second delay to show typing indicator
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try agent router first if enabled and message matches agent keywords
    let aiResponse;

    if (isAgentRouterEnabled() && shouldUseAgentRouter(content) && hasWallet && walletId && userId && userToken) {
      try {
        const agentResponse = await processMessageWithAgents(content, {
          hasWallet,
          balance,
          walletAddress: walletAddress || undefined,
          walletId: walletId || undefined,
          userId,
          userToken,
        }, sessionId || undefined);

        if (agentResponse.useAgentRouter && agentResponse.agent) {
          // Handle agent response
          const agentMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: agentResponse.message,
            timestamp: new Date(),
          };

          // If agent requires confirmation, handle it
          if (agentResponse.requiresConfirmation && agentResponse.data) {
            // Store agent response data for confirmation
            // This will be handled by the existing confirmation flow
            setMessages((prev) => [...prev, agentMessage]);
            setIsLoading(false);
            return;
          }

          // If agent executed successfully, show result
          if (agentResponse.data?.success) {
            setMessages((prev) => [...prev, agentMessage]);
            setIsLoading(false);
            return;
          }

          // Otherwise, show agent message and continue
          setMessages((prev) => [...prev, agentMessage]);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('[Chat] Agent router error, falling back to AI service:', error);
        // Fall through to AI service
      }
    }

    // Use AI service for intent classification and response (fallback or default)
    aiResponse = await AIService.processMessage(content, {
      hasWallet,
      balance,
      walletAddress: walletAddress || undefined,
      walletId: walletId || undefined,
      userId: userId || undefined,
    }, sessionId || undefined);

    const lowerContent = content.toLowerCase();

    // Handle wallet creation intent - show guidance first
    if (aiResponse.intent.intent === "wallet_creation" && !hasWallet) {
      // Show the AI's guidance message (already includes PIN explanation)
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      // User needs to confirm before we proceed
      setIsLoading(false);
      return; // Wait for user confirmation before auto-creating wallet
    }

    // Handle confirmation to proceed with wallet creation
    const isConfirmingWalletCreation = !hasWallet && (
      /^(yes|yep|yeah|sure|ok|okay|let's do it|let's go|go ahead|proceed|start|begin|ready|i'm ready|im ready)$/i.test(lowerContent.trim()) ||
      lowerContent.includes("let's create") ||
      lowerContent.includes("let's set up") ||
      lowerContent.includes("create it") ||
      lowerContent.includes("set it up")
    );

    // Handle different intents
    // Auto-create wallet if user asks for balance/send but doesn't have one
    const needsWallet = !hasWallet && (
      aiResponse.intent.intent === "balance" ||
      aiResponse.intent.intent === "send" ||
      aiResponse.intent.intent === "pay"
    );

    // Allow creating wallet even if one exists (for testing multiple wallets)
    if ((isConfirmingWalletCreation || needsWallet || lowerContent.includes("create new wallet") || lowerContent.includes("create another wallet")) && !creatingRef.current) {
      creatingRef.current = true;
      try {
        // If user wants a new wallet, clear the old one first
        if (hasWallet && (lowerContent.includes("new wallet") || lowerContent.includes("another wallet"))) {
          // Clear existing wallet from Supabase to allow new wallet creation
          if (typeof window !== 'undefined' && userId) {
            try {
              await clearWalletData(userId);
            } catch (error) {
              console.error("[ChatPage] Failed to clear wallet data:", error);
            }
          }
          setWalletId(null);
          setWalletAddress(null);
          setHasWallet(false);
        }

        const creatingMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Perfect! Let's get your wallet set up. I'm creating your account now...",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, creatingMessage]);

        // Step 1: Create or get user (User-Controlled Wallets)
        const userData = await createUser();
        if (!userData) {
          throw new Error("Failed to create user account");
        }

        // Save user credentials
        setUserId(userData.userId);
        setUserToken(userData.userToken);
        if (userData.encryptionKey) {
          setEncryptionKey(userData.encryptionKey);
        } else {
          // If encryption key is missing, warn but continue
          console.warn("⚠️ Encryption key not returned from user creation. PIN setup may fail.");
          const warningMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "⚠️ Note: Encryption key not available. If PIN setup fails, please try creating your wallet again.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, warningMsg]);
        }

        // Step 2: Create wallet challenge
        const forceNew = hasWallet && (lowerContent.includes("new wallet") || lowerContent.includes("another wallet"));
        const result = await createWallet(forceNew, userData.userToken, userData.userId);
        if (!result) throw new Error("Failed to create wallet");

        // Handle challenge response
        if (result.type === "challenge") {
          // Show PIN widget for challenge completion
          // Use encryptionKey from userData, or fallback to state
          const encryptionKeyToUse = userData.encryptionKey || encryptionKey;

          if (!encryptionKeyToUse) {
            throw new Error(
              "Encryption key is required for PIN setup but was not provided. " +
              "Please try creating your wallet again."
            );
          }

          setChallengeData({
            challengeId: result.challengeId,
            userId: result.userId,
            userToken: result.userToken,
            encryptionKey: encryptionKeyToUse,
          });
          setShowPinWidget(true);

          const challengeMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "🔐 Great! Now let's set up your secure PIN. A secure widget will appear below - just enter a 6-digit PIN that you'll remember. This PIN protects your wallet, just like the PIN on your bank card protects your account.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, challengeMsg]);
          return; // Wait for PIN setup completion
        }

        // Legacy: Direct wallet creation (shouldn't happen with User-Controlled)
        if (result.type === "wallet") {
          setWalletId(result.wallet.id);
          setWalletAddress(result.wallet.address);
          setHasWallet(true);

          // Check balance (don't auto-request faucet)
          const fundedBalance = await getBalance(result.wallet.id, result.wallet.address, userId || undefined, userToken || undefined);
          if (fundedBalance) {
            setBalance(fundedBalance);
          }

          const createdMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Your wallet is ready: ${result.wallet.address.slice(0, 6)}…${result.wallet.address.slice(-4)}. Testnet tokens requested for you.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, createdMsg]);
        }
      } catch (e) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "I couldn’t create your wallet. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        creatingRef.current = false;
        setIsLoading(false);
      }
      return;
    }

    // This block is now handled above - auto-create wallet when needed
    // Keeping for backwards compatibility but should never reach here

    if ((aiResponse.intent.intent === "send" || aiResponse.intent.intent === "pay") && aiResponse.transactionPreview && walletId) {
      // Check if transaction is blocked
      const isBlocked = aiResponse.transactionPreview.blocked ||
        (aiResponse.transactionPreview.riskScore !== undefined &&
          aiResponse.transactionPreview.riskScore >= 80);

      // Check if user is confirming or canceling a new wallet transaction
      const isNewWallet = aiResponse.transactionPreview.isNewWallet;
      const isConfirming = /^(yes|confirm|proceed|ok|okay|sure|go ahead|do it)$/i.test(content.trim());
      const isCanceling = /^(no|cancel|stop|abort|don't|dont|nevermind|never mind)$/i.test(content.trim());

      // If this is a new wallet and user hasn't confirmed yet, ask for confirmation
      if (isNewWallet && !isConfirming && !isCanceling) {
        // Send transaction preview with new wallet warning
        const messageId = crypto.randomUUID();
        const aiMessage: ChatMessage = {
          id: messageId,
          role: "assistant",
          content: aiResponse.message,
          timestamp: new Date(),
          transactionPreview: aiResponse.transactionPreview,
        };

        // Always set pending transaction so the confirm button can work (even for blocked/high-risk)
        const previewAddress = aiResponse.transactionPreview.to;
        const addressValidation = validateAddress(previewAddress);
        const normalizedAddress = addressValidation.normalizedAddress || previewAddress;

        setPendingTransaction({
          messageId,
          amount: aiResponse.transactionPreview.amount,
          to: normalizedAddress,
        });

        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
        return;
      }

      // If user canceled, don't proceed
      if (isCanceling) {
        const cancelMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Transaction canceled. No funds were sent. If you'd like to send to a different address, please provide the new address.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, cancelMessage]);
        setIsLoading(false);
        return;
      }

      // Send transaction preview (only set pending if not blocked and confirmed)
      const messageId = crypto.randomUUID();
      const aiMessage: ChatMessage = {
        id: messageId,
        role: "assistant",
        content: aiResponse.message,
        timestamp: new Date(),
        transactionPreview: aiResponse.transactionPreview,
      };

      // Always set pending transaction (even for blocked/high-risk - user can still approve)
      if (!isNewWallet || isConfirming) {
        // Use normalized checksummed address from preview
        const previewAddress = aiResponse.transactionPreview.to;
        const addressValidation = validateAddress(previewAddress);
        const normalizedAddress = addressValidation.normalizedAddress || previewAddress;

        setPendingTransaction({
          messageId,
          amount: aiResponse.transactionPreview.amount,
          to: normalizedAddress, // Store normalized address
        });
      }

      setMessages((prev) => [...prev, aiMessage]);
    } else if (aiResponse.intent.intent === "yield") {
      // Handle yield/USYC operations
      const { amount } = aiResponse.intent.entities;
      const lowerCommand = content.toLowerCase();
      const isWithdraw = lowerCommand.includes("withdraw") || lowerCommand.includes("redeem");
      const isCheck = lowerCommand.includes("check") || lowerCommand.includes("balance") || lowerCommand.includes("status");

      if (isCheck) {
        // Check USYC position
        if (!walletId || !walletAddress) {
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "You need a wallet to check your USYC position.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setIsLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/circle/usyc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'position',
              walletAddress,
              walletId,
              blockchain: 'ETH',
            }),
          });

          const result = await response.json();

          if (result.success && result.data) {
            const position = result.data;
            const positionMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `💰 Your USYC Position\n\n` +
                `Balance: ${position.usycBalance} USYC\n` +
                `Value: ${position.usdcValue} USDC\n` +
                `Current Yield: ${position.currentYield} USDC (+${position.yieldPercentage}%)\n` +
                `APY: ${position.apy}%\n` +
                `Blockchain: ${position.blockchain}\n\n` +
                `Want to deposit more or withdraw?`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, positionMsg]);
          } else {
            const errorMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Couldn't fetch your USYC position. You may not have any USYC yet. Want to deposit some?",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
          }
        } catch (error: any) {
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error checking USYC position: ${error.message}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
        setIsLoading(false);
        return;
      } else if (isWithdraw) {
        // Handle withdraw/redeem
        if (!amount) {
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: aiResponse.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }

        // Check if user confirmed
        const isConfirming = /^(yes|confirm|proceed|ok|okay|sure|go ahead|do it)$/i.test(content.trim());
        if (aiResponse.requiresConfirmation && !isConfirming) {
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: aiResponse.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }

        // Execute redeem
        if (isConfirming || !aiResponse.requiresConfirmation) {
          await handleUSYCOperation('redeem', amount, 'ETH');
          return;
        }
      } else {
        // Handle subscribe/deposit
        if (!amount) {
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: aiResponse.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }

        // Check if user confirmed
        const isConfirming = /^(yes|confirm|proceed|ok|okay|sure|go ahead|do it)$/i.test(content.trim());
        if (aiResponse.requiresConfirmation && !isConfirming) {
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: aiResponse.message,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, aiMessage]);
          setIsLoading(false);
          return;
        }

        // Execute subscribe
        if (isConfirming || !aiResponse.requiresConfirmation) {
          await handleUSYCOperation('subscribe', amount, 'ETH');
          return;
        }
      }
    } else if (aiResponse.intent.intent === "receive" || aiResponse.intent.intent === "address") {
      // Handle receive/address - QR code will be shown by ChatInterface
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } else if (aiResponse.intent.intent === "balance") {
      // Refresh balance before showing
      if (walletId && walletAddress) {
        const updatedBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
        if (updatedBalance) {
          setBalance(updatedBalance);
        }
      }
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.message.replace(/\$\{balance\}/g, balance),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } else if (aiResponse.intent.intent === "transaction_history") {
      // Only fetch transactions when explicitly requested (handled elsewhere)
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Okay. I’ll fetch your transactions only when you confirm.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } else if ((lowerContent.includes("faucet") ||
      lowerContent.includes("testnet token") ||
      lowerContent.includes("request token") ||
      lowerContent.includes("get token")) &&
      walletAddress) {
      // Handle testnet token request
      const requestMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Requesting testnet tokens for your wallet. This may take a few moments...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, requestMessage]);

      const success = await requestTestnetTokens(walletAddress);

      if (success) {
        const successMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "✅ Testnet tokens requested successfully! They should arrive in your wallet shortly (usually within 1-2 minutes).\n\nYou can check your balance by asking \"What's my balance?\"",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, successMessage]);

        // Refresh balance after a short delay
        setTimeout(async () => {
          if (walletId && walletAddress) {
            const updatedBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
            if (updatedBalance) {
              setBalance(updatedBalance);
            }
          }
        }, 3000); // Wait 3 seconds before checking balance
      } else {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ Failed to request testnet tokens. This might be due to rate limiting. Please try again in a few minutes, or use the manual faucet at https://faucet.circle.com",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } else if (aiResponse.intent.intent === "bridge" && walletId && walletAddress) {
      // Handle bridge intent with conversational messaging
      const { amount, recipient: destinationChain, address } = aiResponse.intent.entities;

      // If bridgeData is provided (user has confirmed), execute the bridge
      if (aiResponse.bridgeData && aiResponse.requiresConfirmation) {
        // Show bridge confirmation message
        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: aiResponse.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Check if user is confirming
        const isConfirming = /^(yes|yeah|yup|confirm|confirmed|proceed|ok|okay|sure|absolutely|definitely|go ahead|do it|let'?s go|lets go)(\b|[!.?\s].*)?$/i.test(
          content.trim()
        );

        if (isConfirming) {
          // Show initiating message with friendly status
          const transferMode = aiResponse.bridgeData.fastTransfer
            ? "⚡ Fast Transfer mode - settling in seconds!"
            : "🐢 Standard mode - will take 13-19 minutes";
          const initMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Alright! Firing up the bridge... 🚀\n\n${aiResponse.bridgeData.amount ? `Bridging your $${aiResponse.bridgeData.amount} USDC. ` : ""}${transferMode}\n\nI'll keep you updated!`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, initMessage]);

          if (!userId || !userToken) {
            const credentialMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "I need your wallet session to run the bridge. Please reconnect your wallet or sign in again, then try confirming once more.",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, credentialMessage]);
            setIsLoading(false);
            return;
          }

          try {
            // Execute bridge with conversational status updates
            const response = await fetch("/api/circle/bridge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                walletId: aiResponse.bridgeData.walletId,
                walletAddress: aiResponse.bridgeData.walletAddress,
                amount: aiResponse.bridgeData.amount,
                fromChain: aiResponse.bridgeData.fromChain,
                toChain: aiResponse.bridgeData.toChain,
                destinationAddress: aiResponse.bridgeData.destinationAddress,
                userId,
                userToken,
                fastTransfer: aiResponse.bridgeData.fastTransfer ?? false, // Pass Fast Transfer preference
              }),
            });

            const bridgeResult = await response.json();

            if (bridgeResult.success) {
              // Check if Gateway deposit is required (first-time bridge user)
              if (bridgeResult.data?.requiresDeposit && bridgeResult.data?.challengeId) {
                // Gateway deposit required - show PIN widget
                const depositMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `🔧 Setting up instant bridging for you!\n\n` +
                    `This is your first bridge, so I need to deposit ${bridgeResult.data.depositAmount || aiResponse.bridgeData.amount} USDC to Gateway.\n\n` +
                    `Please complete the approval and deposit challenges (PIN) to continue.`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, depositMessage]);

                // Set up challenge data for Gateway deposit
                setChallengeData({
                  challengeId: bridgeResult.data.challengeId,
                  userId: userId!,
                  userToken: userToken!,
                  encryptionKey: encryptionKey || undefined,
                  gatewayDeposit: {
                    walletId: aiResponse.bridgeData.walletId,
                    fromChain: aiResponse.bridgeData.fromChain,
                    toChain: aiResponse.bridgeData.toChain,
                    amount: aiResponse.bridgeData.amount,
                    destinationAddress: aiResponse.bridgeData.destinationAddress,
                    messageId: depositMessage.id,
                  },
                });
                setShowPinWidget(true);
                return;
              }

              // Check if Gateway transfer signing is required
              if (bridgeResult.data?.requiresChallenge && bridgeResult.data?.challengeId) {
                // Gateway transfer signing required - show PIN widget
                const signingMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `✍️ Please sign the bridge transfer with your PIN.\n\n` +
                    `This authorizes the cross-chain transfer to ${aiResponse.bridgeData.toChain}.`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, signingMessage]);

                // Set up challenge data for Gateway transfer signing
                setChallengeData({
                  challengeId: bridgeResult.data.challengeId,
                  userId: userId!,
                  userToken: userToken!,
                  encryptionKey: encryptionKey || undefined,
                  gatewayTransfer: {
                    walletId: aiResponse.bridgeData.walletId,
                    burnIntent: bridgeResult.data.burnIntent,
                    fromChain: aiResponse.bridgeData.fromChain,
                    toChain: aiResponse.bridgeData.toChain,
                    amount: aiResponse.bridgeData.amount,
                    destinationAddress: aiResponse.bridgeData.destinationAddress,
                    messageId: signingMessage.id,
                  },
                });
                setShowPinWidget(true);
                return;
              }

              // Bridge initiated successfully (no challenges required)
              const successMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `🎉 Bridge initiated successfully!\n\n` +
                  `Your ${aiResponse.bridgeData.amount} USDC is on its way to ${aiResponse.bridgeData.toChain}!\n\n` +
                  `I'm monitoring the bridge - I'll let you know when it arrives (usually 10-30 seconds).`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, successMessage]);

              // Start bridge monitoring with conversational callbacks
              if (bridgeResult.data?.bridgeId) {
                const { startBridgeMonitoring } = await import("@/lib/notifications/bridge-monitor");
                startBridgeMonitoring({
                  bridgeId: bridgeResult.data.bridgeId,
                  transactionHash: bridgeResult.data.transactionHash,
                  amount: aiResponse.bridgeData.amount,
                  fromChain: aiResponse.bridgeData.fromChain,
                  toChain: aiResponse.bridgeData.toChain,
                  destinationAddress: aiResponse.bridgeData.destinationAddress,
                  onComplete: (status) => {
                    const completeMessage: ChatMessage = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: `✅ Bridge complete!\n\nYour ${aiResponse.bridgeData?.amount || amount} USDC has arrived on ${aiResponse.bridgeData?.toChain || 'the destination chain'}. All done! 🎊`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, completeMessage]);
                  },
                  onError: (error) => {
                    const errorMessage: ChatMessage = {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: `Hmm, something went wrong with the bridge: ${error}\n\nDon't worry, your funds are safe. Want me to help you try again?`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, errorMessage]);
                  },
                  onUpdate: (status) => {
                    // Optional: Show progress updates
                    if (status.progress && status.progress > 0 && status.progress < 100) {
                      console.log(`Bridge progress: ${status.progress}%`);
                    }
                  },
                });
              }
            } else {
              // Show error with helpful message
              const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `Oops, ran into an issue: ${bridgeResult.message || "Unknown error"}\n\n` +
                  `${bridgeResult.message?.includes("balance") ? "Looks like you might not have enough USDC. Want to check your balance?" : ""}` +
                  `\nWant to try again or need help troubleshooting?`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, errorMessage]);
            }
          } catch (error: any) {
            const errorMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `Uh oh, something went wrong: ${error.message}\n\nNo worries though - your funds are safe. Want me to help you retry?`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
          }
        }
        setIsLoading(false);
        return;
      }

      // If not ready to execute yet, show AI response
      if (!amount || !destinationChain) {
        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: aiResponse.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        // Show next step message
        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: aiResponse.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } else if (lowerContent.includes("logout") || lowerContent.includes("log out") || lowerContent.includes("sign out")) {
      // Handle logout
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "You've been logged out. Redirecting to home page...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      // Delay logout slightly so user sees the message
      setTimeout(() => {
        handleLogout();
      }, 1000);
    } else {
      // Default response from AI service
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.message,
        timestamp: new Date(),
        transactionPreview: aiResponse.transactionPreview,
      };
      setMessages((prev) => [...prev, aiMessage]);
    }

    setIsLoading(false);
  };

  const handleConfirmTransaction = async () => {
    if (!walletId) return;

    // Find the message with transaction preview (use pendingTransaction if available, otherwise find the latest one)
    let message = pendingTransaction
      ? messages.find(m => m.id === pendingTransaction.messageId)
      : [...messages].reverse().find(m => m.transactionPreview);

    if (!message?.transactionPreview) {
      console.error("Transaction preview not found");
      return;
    }

    // Get transaction details from message preview
    const previewAmount = message.transactionPreview.amount;
    const previewTo = message.transactionPreview.to;

    // If pendingTransaction is not set, create it from the message
    if (!pendingTransaction) {
      const addressValidation = validateAddress(previewTo);
      const normalizedAddress = addressValidation.normalizedAddress || previewTo;

      setPendingTransaction({
        messageId: message.id,
        amount: previewAmount,
        to: normalizedAddress,
      });
    }

    // Don't block - show warning but allow user to proceed if they confirm
    // User has seen the risks and can make an informed decision
    if (message.transactionPreview.blocked ||
      (message.transactionPreview.riskScore !== undefined &&
        message.transactionPreview.riskScore >= 80)) {
      // Show warning message but don't block - user can still approve
      const warningMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ HIGH RISK TRANSACTION\n\nYou're about to proceed with a high-risk transaction (Risk Score: ${message.transactionPreview.riskScore}/100).\n\nRisk Factors:\n${message.transactionPreview.riskReasons?.map(r => `• ${r}`).join('\n')}\n\nPlease verify the recipient address is correct. Proceeding with this transaction is at your own risk.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, warningMessage]);
      // Don't return - allow transaction to proceed if user confirms
    }

    // Safety Check 2: Validate and normalize address
    const addressValidation = validateAddress(previewTo);
    if (!addressValidation.isValid) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Invalid address format: ${addressValidation.error}. Transaction cancelled.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // Use normalized checksummed address
    const normalizedAddress = addressValidation.normalizedAddress || previewTo;

    // Safety Check 3: Re-validate risk score before execution (informational only)
    // User has already confirmed, so we allow the transaction to proceed
    // Only block if risk score increases significantly or if it's a zero address
    try {
      const currentRiskResult = await calculateRiskScore(normalizedAddress, previewAmount, undefined, undefined, userId || undefined);

      // Only block zero address (truly invalid)
      if (normalizedAddress === "0x0000000000000000000000000000000000000000") {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ Invalid Address\n\nCannot send to zero address. Transaction cancelled.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // If risk score increased significantly, show warning but still allow
      if (currentRiskResult.score > (message.transactionPreview.riskScore || 0) + 20) {
        const warningMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ Risk Score Updated\n\nRisk score has increased to ${currentRiskResult.score}/100. Proceeding with transaction as you've confirmed.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, warningMessage]);
        // Don't return - allow transaction to proceed
      }
    } catch (error) {
      console.error("Error re-validating risk score:", error);
      // Continue with transaction if risk check fails (fail open, but log the error)
    }

    setIsLoading(true);

    // Check balance and warn if insufficient (but don't auto-request faucet)
    try {
      if (walletId && walletAddress) {
        // Pass userId and userToken to getBalance for user-controlled wallets
        const currentBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
        const current = currentBalance ? parseFloat(currentBalance) : 0;
        const needed = parseFloat(previewAmount);
        if (!Number.isNaN(needed) && current < needed) {
          const insufficientMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ Insufficient balance (${currentBalance ?? "0"} USDC). You need ${needed} USDC to complete this transaction.\n\nPlease request testnet tokens manually using the "faucet" command or visit https://faucet.circle.com`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, insufficientMsg]);
          setIsLoading(false);
          return; // Stop transaction if insufficient balance
        }
      }
    } catch (e) {
      // Log error but continue with transaction attempt
      console.warn("Balance check failed:", e);
    }

    try {
      // Ensure pendingTransaction is set (should be set above, but double-check)
      if (!pendingTransaction) {
        setPendingTransaction({
          messageId: message.id,
          amount: previewAmount,
          to: normalizedAddress,
        });
      }

      // Update message to show pending state
      setMessages((prev) => prev.map(msg =>
        msg.id === message.id
          ? {
            ...msg,
            transactionPreview: msg.transactionPreview ? {
              ...msg.transactionPreview,
            } : undefined,
          }
          : msg
      ));

      // Send transaction using normalized address
      // CRITICAL: walletAddress must be passed to avoid SDK public key fetch (401 error)
      if (!walletAddress) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Error: Wallet address not found. Please create a new wallet.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      // Validate all required fields before sending
      if (!walletId) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "❌ Error: Wallet ID is missing. Please create a wallet first.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      if (!previewAmount || isNaN(parseFloat(previewAmount))) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: Invalid amount "${previewAmount}". Please provide a valid number.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      if (!normalizedAddress) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "❌ Error: Destination address is missing.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return;
      }

      // Resolve the latest credentials from state or Supabase (in case state is stale)
      let resolvedUserId = userId;
      let resolvedUserToken = userToken;
      let resolvedEncryptionKey = encryptionKey;

      // If credentials are missing in state, try to load from Supabase
      if ((!resolvedUserId || !resolvedUserToken) && typeof window !== "undefined" && userId) {
        try {
          const credentials = await loadUserCredentials(userId);
          if (credentials.userToken) {
            resolvedUserToken = credentials.userToken;
            if (credentials.encryptionKey) {
              resolvedEncryptionKey = credentials.encryptionKey;
            }
          }
        } catch (error) {
          console.error("[Transaction] Failed to load credentials from Supabase:", error);
        }
      }

      if (!resolvedUserId || !resolvedUserToken) {
        console.warn("[Transaction] Missing user credentials:", {
          hasUserId: !!resolvedUserId,
          hasUserToken: !!resolvedUserToken,
        });
      }

      console.log("Sending transaction with:", {
        walletId,
        destinationAddress: normalizedAddress,
        amount: previewAmount,
        walletAddress,
      });

      let result: Awaited<ReturnType<typeof sendTransaction>> = null;
      let transaction: Transaction | null = null;

      try {
        console.log("[Transaction] About to call sendTransaction...");
        result = await sendTransaction(
          walletId,
          normalizedAddress, // Use checksummed address
          previewAmount,
          walletAddress, // CRITICAL: Always pass wallet address for SDK transaction creation
          resolvedUserId || undefined,
          resolvedUserToken || undefined
        );
        console.log("[Transaction] sendTransaction completed, result:", result);

        // Check if result is a challenge (PIN required)
        if (result && result.type === "challenge") {
          console.log("[Transaction] ✅✅✅ Challenge required detected from return value!");
          console.log("[Transaction] Challenge ID:", result.challengeId);
          console.log("[Transaction] Wallet ID:", result.walletId);
          console.log("[Transaction] Destination:", result.destinationAddress);
          console.log("[Transaction] Amount:", result.amount);

          // Check if token is expired before showing PIN widget
          if (resolvedUserToken) {
            const tokenStatus = checkTokenExpiry(resolvedUserToken, 5);
            if (tokenStatus.isExpired || tokenStatus.isExpiringSoon) {
              console.log("[Transaction] Token expired or expiring soon, refreshing before PIN widget...");
              try {
                const newToken = await refreshUserToken();
                if (newToken && newToken.userToken) {
                  console.log("[Transaction] ✅ Token refreshed, using new token for PIN widget");
                  resolvedUserToken = newToken.userToken;
                  if (newToken.encryptionKey) {
                    resolvedEncryptionKey = newToken.encryptionKey;
                  }
                  setUserToken(newToken.userToken);
                  if (newToken.encryptionKey) {
                    setEncryptionKey(newToken.encryptionKey);
                  }
                } else {
                  console.warn("[Transaction] Token refresh failed, proceeding with existing token");
                }
              } catch (refreshError) {
                console.error("[Transaction] Error refreshing token:", refreshError);
              }
            }
          }

          // Show PIN widget for transaction challenge
          // Store transaction details so we can complete it after PIN confirmation
          const challengeDataToSet = {
            challengeId: result.challengeId,
            userId: resolvedUserId || "",
            userToken: resolvedUserToken || "",
            encryptionKey: resolvedEncryptionKey || undefined,
            transactionChallenge: {
              walletId: result.walletId,
              destinationAddress: result.destinationAddress,
              amount: result.amount,
              messageId: message.id,
            },
          };
          console.log("[Transaction] Setting challengeData with transaction details:", {
            challengeId: challengeDataToSet.challengeId,
            hasUserId: !!challengeDataToSet.userId,
            hasUserToken: !!challengeDataToSet.userToken,
            hasEncryptionKey: !!challengeDataToSet.encryptionKey,
            hasTransactionChallenge: !!challengeDataToSet.transactionChallenge,
          });

          // Check if session keys can handle this transaction
          if (isSessionKeysEnabled() && resolvedUserId && resolvedUserToken && result.walletId) {
            // Dynamically import to avoid SSR issues with Circle SDK
            const { checkSessionKeyStatus } = await import("@/lib/ai/sessionKeyHelper");
            const status = await checkSessionKeyStatus(
              result.walletId,
              resolvedUserId,
              resolvedUserToken,
              'transfer',
              result.amount
            );

            if (status.canAutoExecute && status.hasActiveSession) {
              // Execute via session key - no PIN widget needed
              console.log("[Transaction] Executing via session key, no PIN widget needed");
              setSessionKeyStatus(status);
              // The transaction will be executed via delegateExecution in the API
              // Just show a message that it's processing
              const processingMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "✅ Executing transaction automatically via your approved session...",
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, processingMsg]);
              return; // Don't show PIN widget
            } else if (!status.hasActiveSession) {
              // No active session - show session approval modal instead
              setShowSessionApproval(true);
              return; // Don't show PIN widget yet
            }
            // If session exists but can't auto-execute, fall through to PIN widget
            setSessionKeyStatus(status);
          }

          setChallengeData(challengeDataToSet);
          setShowPinWidget(true);

          console.log("[Transaction] ✅✅✅ PIN widget state set - showPinWidget should be true now");

          // Update message to show challenge is required
          const challengeMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `🔐 Transaction requires PIN confirmation\n\nPlease enter your PIN to approve this transaction:\n• Amount: ${previewAmount} USDC\n• To: ${normalizedAddress}\n\nThe PIN widget will appear below.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, challengeMessage]);

          setIsLoading(false);
          console.log("[Transaction] ✅✅✅ Exiting early - PIN widget should be visible");
          return; // Exit early - PIN widget will handle completion
        }

        // If result is a transaction (challenge already completed or not required)
        if (result && result.type === "transaction") {
          console.log("[Transaction] ✅ Transaction completed successfully:", result.transaction);
          transaction = result.transaction;
        } else if (result === null) {
          console.error("[Transaction] ❌ sendTransaction returned null");
          throw new Error("Transaction failed: No response from sendTransaction");
        } else {
          console.error("[Transaction] ❌ Unexpected result type:", result);
          throw new Error("Transaction failed: Unexpected response from sendTransaction");
        }
      } catch (txError: any) {
        // Handle actual errors (network, API errors, etc.)
        console.log("[Transaction] ========================================");
        console.log("[Transaction] ⚠️⚠️⚠️ CATCH BLOCK EXECUTED ⚠️⚠️⚠️");
        console.log("[Transaction] Error caught in handleConfirmTransaction");
        const errorMessage = txError?.message || String(txError);
        console.log("[Transaction] Error type:", typeof txError);
        console.log("[Transaction] Error message:", errorMessage);

        // If it's not a challenge error, show error message
        console.error("[Transaction] ❌ Transaction failed:", errorMessage);
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Transaction failed: ${errorMessage}\n\nPlease check your balance and try again.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setIsLoading(false);
        return; // Don't re-throw, we've already shown the error
      }

      if (transaction) {
        // 🔥 CRITICAL: Cache transaction immediately so it never "disappears" from history
        // This ensures the transaction shows up in history instantly, even if Circle API is slow to index
        if (typeof window !== 'undefined' && userId && walletId) {
          const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
          await cacheTransaction(userId, walletId, transaction);
          console.log(`[Transaction] 💾 Cached transaction immediately: ${transaction.id}`);
        }

        // Update address history for future risk scoring (using normalized address)
        if (userId) {
          updateAddressHistory(userId, normalizedAddress).catch(error => {
            console.error("[Transaction] Failed to update address history:", error);
          });
        }

        // Optimistic balance update - immediately reflect the transaction
        if (walletAddress && balance && pendingTransaction) {
          const currentBalance = parseFloat(balance);
          const sentAmount = parseFloat(pendingTransaction.amount);
          const newBalance = Math.max(0, (currentBalance - sentAmount)).toFixed(2); // Ensure non-negative
          setBalance(newBalance); // Immediate optimistic update
          console.log(`[Transaction] Optimistic balance update: ${balance} -> ${newBalance} (sent ${sentAmount})`);

          // If balance goes to 0 or negative, show a message
          if (parseFloat(newBalance) <= 0) {
            const balanceMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `💡 Balance Update\n\nYour balance after this transaction: ${newBalance} USDC\n\nNote: The balance will refresh automatically once the transaction is confirmed on-chain.`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, balanceMsg]);
          }
        }

        // Refresh balance aggressively after successful transaction
        const refreshBalance = async () => {
          if (walletAddress) {
            try {
              // Add cache-busting parameter to force fresh balance
              const timestamp = Date.now();
              const response = await fetch(
                `/api/circle/balance?walletId=${walletId}&address=${walletAddress}&useBlockchain=true&_t=${timestamp}`
              );
              const data = await response.json();
              if (data.success && data.data?.balance !== undefined) {
                const newBalance = parseFloat(data.data.balance).toFixed(2);
                setBalance(newBalance);
                console.log(`[Transaction] Balance refreshed: ${newBalance} USDC`);
              } else if (data.success && data.balance !== undefined) {
                // Handle alternative response format
                const newBalance = parseFloat(data.balance).toFixed(2);
                setBalance(newBalance);
                console.log(`[Transaction] Balance refreshed (alt format): ${newBalance} USDC`);
              } else {
                console.warn(`[Transaction] Balance refresh returned unexpected format:`, data);
              }
            } catch (error) {
              console.error('[Transaction] Error refreshing balance:', error);
            }
          }
        };

        // Refresh balance multiple times to ensure we catch Circle API updates
        refreshBalance(); // Immediate
        setTimeout(refreshBalance, 2000); // 2s
        setTimeout(refreshBalance, 5000); // 5s
        setTimeout(refreshBalance, 10000); // 10s
        setTimeout(refreshBalance, 20000); // 20s (extra aggressive)

        // Update message to show confirmed state with link to verify
        if (pendingTransaction) {
          // Get blockchain hash from transaction response
          // The hash should be directly on transaction.hash (mapped from API response)
          const blockchainHash = transaction.hash;

          // Only generate explorer URL if we have a valid blockchain hash (starts with 0x and is 66 chars)
          // Circle transaction IDs are UUIDs, not blockchain hashes
          const isValidHash = blockchainHash && /^0x[a-fA-F0-9]{64}$/.test(blockchainHash);

          console.log('[Transaction] Hash check:', {
            hash: blockchainHash,
            isValid: isValidHash,
            transactionId: transaction.id,
            fullTransaction: transaction
          });

          // If hash is not available yet, poll for it immediately
          if (!isValidHash && transaction.id) {
            // Show initial message without hash
            const explorerLink = `\n\n⏳ Getting transaction hash...`;
            setMessages((prev) => prev.map(msg =>
              msg.id === pendingTransaction.messageId
                ? {
                  ...msg,
                  content: `✅ Payment sent successfully!\n\nSent: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}${explorerLink}`,
                  transactionPreview: undefined,
                }
                : msg
            ));

            // Poll immediately for the transaction hash
            let hashFound = false;
            const pollForHash = async () => {
              if (hashFound) return; // Stop if hash already found

              try {
                // Try Circle API first
                // Use state credentials or load from Supabase
                let pollUserId = userId;
                let pollUserToken = userToken;

                if ((!pollUserId || !pollUserToken) && typeof window !== "undefined" && userId) {
                  try {
                    const credentials = await loadUserCredentials(userId);
                    if (credentials.userToken) {
                      pollUserToken = credentials.userToken;
                    }
                  } catch (error) {
                    console.error("[Transaction] Failed to load credentials for polling:", error);
                  }
                }

                let queryString = `walletId=${walletId}&transactionId=${transaction.id}`;
                if (pollUserId && pollUserToken) {
                  queryString += `&userId=${encodeURIComponent(pollUserId)}&userToken=${encodeURIComponent(pollUserToken)}`;
                }

                const response = await fetch(`/api/circle/transactions?${queryString}`);
                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.data?.data) {
                    const txData = data.data.data;
                    const hash = txData.hash || txData.txHash || txData.transactionHash;
                    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
                      hashFound = true; // Mark as found
                      // Found valid hash - update message with ArcScan link
                      const explorerLink = `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${hash})`;
                      setMessages((prev) => prev.map(msg =>
                        msg.id === pendingTransaction.messageId
                          ? {
                            ...msg,
                            content: `✅ Payment sent successfully!\n\nSent: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}${explorerLink}`,
                            transactionPreview: undefined,
                          }
                          : msg
                      ));
                      return true; // Hash found
                    }
                  }
                }

                // Fallback: Try ArcScan API if Circle doesn't have the hash yet
                // This can help us get the hash faster when Circle is slow to index
                if (walletAddress && pendingTransaction.to && pendingTransaction.amount) {
                  try {
                    const { findTransactionByDetails } = await import('@/lib/arcscan-api');
                    const amountInSmallestUnit = (parseFloat(pendingTransaction.amount) * 1000000).toString();
                    const arcScanHash = await findTransactionByDetails(
                      walletAddress,
                      pendingTransaction.to,
                      amountInSmallestUnit,
                      60 // Search last 60 seconds
                    );

                    if (arcScanHash && /^0x[a-fA-F0-9]{64}$/.test(arcScanHash)) {
                      hashFound = true;
                      const explorerLink = `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${arcScanHash})`;
                      setMessages((prev) => prev.map(msg =>
                        msg.id === pendingTransaction.messageId
                          ? {
                            ...msg,
                            content: `✅ Payment sent successfully!\n\nSent: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}${explorerLink}`,
                            transactionPreview: undefined,
                          }
                          : msg
                      ));
                      return true; // Hash found via ArcScan
                    }
                  } catch (arcScanError) {
                    // Silently fail - ArcScan is just a fallback
                    console.log('[Transaction] ArcScan fallback failed:', arcScanError);
                  }
                }
              } catch (error) {
                console.error('[Transaction] Error polling for hash:', error);
              }
              return false; // Hash not found yet
            };

            // Poll immediately
            pollForHash();

            // Poll every 500ms for up to 10 seconds (20 attempts)
            let attempts = 0;
            const maxAttempts = 20;
            const pollInterval = setInterval(async () => {
              attempts++;
              const found = await pollForHash();
              if (found || attempts >= maxAttempts) {
                clearInterval(pollInterval);
                if (!found && attempts >= maxAttempts) {
                  // Update message to indicate we're still waiting
                  setMessages((prev) => prev.map(msg =>
                    msg.id === pendingTransaction.messageId
                      ? {
                        ...msg,
                        content: `✅ Payment sent successfully!\n\nSent: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}\n\n⏳ Transaction is processing. The blockchain hash will be available once the transaction is confirmed.`,
                        transactionPreview: undefined,
                      }
                      : msg
                  ));
                }
              }
            }, 500); // Poll every 500ms for faster response

            // Stop polling after 10 seconds
            setTimeout(() => {
              clearInterval(pollInterval);
              hashFound = true; // Prevent further polling
            }, 10000);
          } else {
            // Hash is available immediately - show link right away
            const explorerLink = isValidHash
              ? `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${blockchainHash})`
              : `\n\n⏳ Transaction is processing. The blockchain hash will be available once the transaction is confirmed.`;

            setMessages((prev) => prev.map(msg =>
              msg.id === pendingTransaction.messageId
                ? {
                  ...msg,
                  content: `✅ Payment sent successfully!\n\nSent: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}${explorerLink}`,
                  transactionPreview: undefined,
                }
                : msg
            ));
          }
        }

        // Notify transaction history to refresh immediately and aggressively
        if (typeof window !== 'undefined') {
          // Dispatch multiple refresh events at different intervals to catch Circle API indexing
          window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          }, 2000);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          }, 5000);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          }, 10000);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          }, 20000);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
          }, 30000); // Extra aggressive - 30s
        }

        // Monitor transaction with notification system
        if (transaction.id && walletId) {
          monitorTransaction({
            walletId,
            transactionId: transaction.id,
            pollInterval: 2000, // 2 seconds
            maxAttempts: 30, // 60 seconds total
            onStatusChange: async (status, hash) => {
              if (status === "confirmed") {
                // Add confirmation message with Arc-specific info
                const isValidBlockchainHash = hash && /^0x[a-fA-F0-9]{64}$/.test(hash);
                const explorerLink = isValidBlockchainHash
                  ? `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${hash})`
                  : `\n\n⏳ Transaction is processing. The blockchain hash will be available once the transaction is confirmed.`;

                // Verify transaction on ArcScan if we have a hash
                let verificationStatus = "";
                if (isValidBlockchainHash) {
                  try {
                    const { getTransactionStatusFromArcScan } = await import("@/lib/arcscan-api");
                    const arcScanStatus = await getTransactionStatusFromArcScan(hash);
                    if (arcScanStatus === "confirmed") {
                      verificationStatus = "\n✅ Verified on ArcScan";
                    } else if (arcScanStatus === "pending") {
                      verificationStatus = "\n⏳ Pending verification on ArcScan";
                    } else if (arcScanStatus === "failed") {
                      verificationStatus = "\n⚠️ Transaction failed on blockchain";
                    }
                  } catch (error) {
                    console.warn("ArcScan verification failed:", error);
                    // Don't show error to user, just continue
                  }
                }

                // Don't add confirmation message to chat - transaction appears in transaction history panel
                // Just trigger refresh events
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
                }

                // Update balance immediately after transaction confirmation
                if (walletId && walletAddress) {
                  const updatedBalance = await getBalance(
                    walletId,
                    walletAddress,
                    userId || undefined,
                    userToken || undefined
                  );
                  if (updatedBalance) {
                    setBalance(updatedBalance);
                  }
                }

                // Trigger refresh for transaction history and balance
                if (typeof window !== 'undefined') {
                  if (isValidBlockchainHash) {
                    window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  }
                  // Force balance refresh
                  window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
                  // Also refresh balance directly after a short delay to ensure it's updated
                  if (walletId && walletAddress) {
                    setTimeout(async () => {
                      const refreshedBalance = await getBalance(
                        walletId,
                        walletAddress,
                        userId || undefined,
                        userToken || undefined
                      );
                      if (refreshedBalance) {
                        setBalance(refreshedBalance);
                      }
                    }, 2000);
                  }
                }
              } else if (status === "failed") {
                const failedMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `❌ Transaction failed. Please check the transaction details and try again.`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, failedMessage]);
              }
            },
          });
        }
      } else {
        // Show error message
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Failed to send transaction. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (err) {
      console.error("Transaction error:", err);
      if (err instanceof Error && err.message.startsWith("SESSION_EXPIRED")) {
        // Clear data from Supabase
        if (typeof window !== 'undefined' && userId) {
          try {
            await Promise.all([
              clearWalletData(userId),
              clearUserCredentials(userId),
            ]);
          } catch (error) {
            console.error("[Transaction] Failed to clear data from Supabase:", error);
          }
        }

        setUserId(null);
        setUserToken(null);
        setWalletId(null);
        setWalletAddress(null);
        setHasWallet(false);
        setBalance("0.00");
        setChallengeData(null);
        setShowPinWidget(false);

        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "🔐 Your Circle session expired. Please create a new user and rerun the PIN setup so I can send payments again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "An error occurred while sending the transaction. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setPendingTransaction(null);
      setIsLoading(false);
    }
  };

  const handleCancelTransaction = () => {
    if (!pendingTransaction) return;

    // Remove the transaction preview message
    setMessages((prev) => prev.filter(msg => msg.id !== pendingTransaction.messageId));

    // Add cancellation message
    const cancelMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Transaction cancelled. You can try sending again anytime.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);

    setPendingTransaction(null);
  };

  const handleUSYCOperation = async (action: 'subscribe' | 'redeem', amount: string, blockchain: string = 'ETH') => {
    if (!walletId || !userId || !userToken) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "❌ Error: Wallet or user credentials missing. Please create a wallet first.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Check balance for subscribe action
      if (action === 'subscribe') {
        const currentBalance = await getBalance(walletId, walletAddress || '', userId, userToken);
        const needed = parseFloat(amount);
        const current = currentBalance ? parseFloat(currentBalance) : 0;

        if (current < needed) {
          const insufficientMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ Insufficient balance (${currentBalance ?? "0"} USDC). You need ${needed} USDC to deposit into USYC.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, insufficientMsg]);
          setIsLoading(false);
          return;
        }
      }

      // Call USYC API
      const apiAction = action === 'subscribe' ? 'subscribe' : 'redeem';
      const response = await fetch('/api/circle/usyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: apiAction,
          userId,
          userToken,
          walletId,
          amount,
          blockchain,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'USYC operation failed');
      }

      const data = result.data;
      const messageId = crypto.randomUUID();

      // Store pending USYC operation
      setPendingUSYC({
        messageId,
        action,
        amount,
        blockchain,
        step: data.step || 'approve',
      });

      // If this is the approval step, show PIN widget
      if (data.step === 'approve' && data.challengeId) {
        // Resolve credentials
        let resolvedUserId = userId;
        let resolvedUserToken = userToken;
        let resolvedEncryptionKey = encryptionKey;

        if ((!resolvedUserId || !resolvedUserToken) && typeof window !== "undefined" && userId) {
          try {
            const credentials = await loadUserCredentials(userId);
            if (credentials.userToken) {
              resolvedUserToken = credentials.userToken;
              if (credentials.encryptionKey) {
                resolvedEncryptionKey = credentials.encryptionKey;
              }
            }
          } catch (error) {
            console.error("[USYC] Failed to load credentials:", error);
          }
        }

        // Check token expiry
        if (resolvedUserToken) {
          const tokenStatus = checkTokenExpiry(resolvedUserToken, 5);
          if (tokenStatus.isExpired || tokenStatus.isExpiringSoon) {
            try {
              const newToken = await refreshUserToken();
              if (newToken && newToken.userToken) {
                resolvedUserToken = newToken.userToken;
                if (newToken.encryptionKey) {
                  resolvedEncryptionKey = newToken.encryptionKey;
                }
                setUserToken(newToken.userToken);
                if (newToken.encryptionKey) {
                  setEncryptionKey(newToken.encryptionKey);
                }
              }
            } catch (refreshError) {
              console.error("[USYC] Error refreshing token:", refreshError);
            }
          }
        }

        // Set challenge data for PIN widget
        const challengeDataToSet = {
          challengeId: data.challengeId,
          userId: resolvedUserId || "",
          userToken: resolvedUserToken || "",
          encryptionKey: resolvedEncryptionKey || undefined,
        };

        setChallengeData(challengeDataToSet);
        setShowPinWidget(true);

        // Show message
        const challengeMessage: ChatMessage = {
          id: messageId,
          role: "assistant",
          content: `🔐 ${action === 'subscribe' ? 'USYC Deposit' : 'USYC Redemption'} requires PIN confirmation\n\nPlease enter your PIN to approve:\n• ${action === 'subscribe' ? 'Deposit' : 'Redeem'}: ${amount} ${action === 'subscribe' ? 'USDC' : 'USYC'}\n• Blockchain: ${blockchain}\n\nThe PIN widget will appear below.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, challengeMessage]);
        setIsLoading(false);
        return;
      }

      // If already completed (shouldn't happen in two-step flow, but handle it)
      const successMessage: ChatMessage = {
        id: messageId,
        role: "assistant",
        content: `✅ USYC ${action === 'subscribe' ? 'deposit' : 'redemption'} initiated successfully!`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);
      setIsLoading(false);

    } catch (error: any) {
      console.error("[USYC] Operation error:", error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ USYC operation failed: ${error.message || 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
    }
  };

  // Poll transaction status until confirmed
  // Arc has sub-second finality, so we can poll faster
  const pollTransactionStatus = async (transactionId: string, maxAttempts = 30, pollInterval = 2000) => {
    let attempts = 0;
    let hasNotified = false;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log(`Polling stopped after ${maxAttempts} attempts for transaction ${transactionId}`);
        // Add timeout message
        setMessages((prev) => prev.map(msg => {
          if (msg.content.includes(transactionId) && !msg.content.includes("Transaction confirmed") && !msg.content.includes("Transaction failed")) {
            return {
              ...msg,
              content: msg.content + "\n\n⏱️ Transaction is still processing. Please check back later or view it on ArcScan.",
            };
          }
          return msg;
        }));
        return;
      }

      attempts++;
      console.log(`[Polling] Transaction ${transactionId} (attempt ${attempts}/${maxAttempts})...`);

      const status = await getTransactionStatus(transactionId);

      if (!status) {
        console.log(`[Polling] No status returned for transaction ${transactionId}, continuing to poll...`);
        setTimeout(poll, pollInterval);
        return;
      }

      console.log(`[Polling] Transaction ${transactionId} status: ${status.status}, hash: ${status.hash || 'none'}`);

      // Check if we have a valid blockchain hash (0x followed by 64 hex characters)
      const hasValidHash = status.hash && status.hash.startsWith("0x") && status.hash.length === 66;

      // Transaction is confirmed when status is confirmed AND we have a blockchain hash
      const isConfirmed = status && status.status === "confirmed" && hasValidHash;

      if (isConfirmed) {
        if (!hasNotified) {
          hasNotified = true;

          // Update balance after confirmation
          if (walletId && walletAddress) {
            const updatedBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
            if (updatedBalance) {
              setBalance(updatedBalance);
            }
          }

          // Don't add confirmation message to chat - transaction appears in transaction history panel
          // Just trigger refresh events
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
            window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
          }
        }
        return; // Stop polling once confirmed with hash
      } else if (status && status.status === "confirmed" && !hasValidHash) {
        // Transaction is marked confirmed but we don't have the hash yet - keep polling
        console.log(`[Polling] Transaction ${transactionId} is confirmed but hash not available yet, continuing to poll...`);
        setTimeout(poll, pollInterval);
        return;
      } else if (status && status.status === "failed") {
        if (!hasNotified) {
          hasNotified = true;
          setMessages((prev) => prev.map(msg => {
            if (msg.content.includes(transactionId) && !msg.content.includes("Transaction failed")) {
              return {
                ...msg,
                content: msg.content + "\n\n❌ Transaction failed. Please try again.",
              };
            }
            return msg;
          }));
        }
      } else {
        // Continue polling
        console.log(`Transaction ${transactionId} still pending, will poll again in ${pollInterval}ms...`);
        setTimeout(poll, pollInterval);
      }
    };

    setTimeout(poll, pollInterval);
  };

  // Handler for PIN widget success
  const handlePinWidgetSuccess = async (result: any) => {
    // Prevent multiple simultaneous challenge processing
    if (processingChallengeRef.current) {
      console.warn("[PIN Widget] Challenge already being processed, ignoring duplicate success callback");
      return;
    }

    processingChallengeRef.current = true;

    // Handle Gateway deposit challenge completion
    if (challengeData?.gatewayDeposit) {
      const deposit = challengeData.gatewayDeposit;

      try {
        // Wait a moment for deposit to finalize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Retry the bridge transfer now that deposit is complete
        const retryMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `✅ Gateway deposit complete!\n\nNow initiating the bridge transfer...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, retryMessage]);

        const response = await fetch("/api/circle/bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletId: deposit.walletId,
            walletAddress: walletAddress!,
            userId: userId!,
            userToken: userToken!,
            amount: deposit.amount,
            fromChain: deposit.fromChain,
            toChain: deposit.toChain,
            destinationAddress: deposit.destinationAddress,
          }),
        });

        const bridgeResult = await response.json();

        if (bridgeResult.success && bridgeResult.data?.requiresChallenge) {
          // Gateway transfer signing required - set up new challenge
          setChallengeData({
            challengeId: bridgeResult.data.challengeId,
            userId: userId!,
            userToken: userToken!,
            encryptionKey: encryptionKey || undefined,
            gatewayTransfer: {
              walletId: deposit.walletId,
              burnIntent: bridgeResult.data.burnIntent,
              fromChain: deposit.fromChain,
              toChain: deposit.toChain,
              amount: deposit.amount,
              destinationAddress: deposit.destinationAddress,
              messageId: retryMessage.id,
            },
          });
          setShowPinWidget(true);
          // Reset flag to allow the new challenge to be processed
          processingChallengeRef.current = false;
          return;
        }

        // If no new challenge needed, deposit completed successfully
        setChallengeData(null);
        setShowPinWidget(false);
        processingChallengeRef.current = false;
        setIsLoading(false);
        return;
      } catch (error: any) {
        console.error("[Gateway Deposit] Error retrying bridge:", error);
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error retrying bridge: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setChallengeData(null);
        setShowPinWidget(false);
        processingChallengeRef.current = false;
        setIsLoading(false);
        return;
      }
    }

    // Handle Gateway transfer signing challenge completion
    if (challengeData?.gatewayTransfer) {
      const transfer = challengeData.gatewayTransfer;

      // Get signature from challenge result
      // The signature should be in result.signature or we need to fetch it
      let signature: string | null = null;

      try {
        // Log the result structure to understand what we're working with
        console.log(`[Gateway Transfer] PIN widget result:`, {
          hasResult: !!result,
          resultType: result?.type,
          resultStatus: result?.status,
          hasSignature: !!result?.signature,
          hasData: !!result?.data,
          resultKeys: result ? Object.keys(result) : [],
          dataKeys: result?.data ? Object.keys(result.data) : [],
        });

        // Try to get signature from the challenge result (check multiple possible locations)
        // For EIP-712 signing challenges, Circle might return signature in different places
        if (result?.signature) {
          signature = result.signature;
          console.log(`[Gateway Transfer] ✅ Signature found in result.signature!`);
        } else if (result?.data?.signature) {
          signature = result.data.signature;
          console.log(`[Gateway Transfer] ✅ Signature found in result.data.signature!`);
        } else if (result?.data?.data?.signature) {
          signature = result.data.data.signature;
          console.log(`[Gateway Transfer] ✅ Signature found in result.data.data.signature!`);
        } else if (result?.challenge?.signature) {
          signature = result.challenge.signature;
          console.log(`[Gateway Transfer] ✅ Signature found in result.challenge.signature!`);
        } else if (typeof result?.data === 'string' && result.data.startsWith('0x') && result.data.length >= 130) {
          // Sometimes the signature IS the data itself (as a string)
          signature = result.data;
          console.log(`[Gateway Transfer] ✅ Signature found as result.data (direct string)!`);
        } else {
          // Signature not found in callback result
          // For EIP-712 signing challenges with User-Controlled Wallets, Circle's challenge API endpoint doesn't exist (404)
          // The signature MUST be in the PIN widget callback result
          // If it's not there, we need to check the result structure more thoroughly
          console.log(`[Gateway Transfer] ⚠️ Signature not found in callback result. Checking result structure...`);
          console.log(`[Gateway Transfer] Full result object:`, JSON.stringify(result, null, 2));

          // Try to extract signature from deeply nested structures
          const deepSearch = (obj: any, depth = 0): string | null => {
            if (depth > 5) return null; // Prevent infinite recursion
            if (!obj || typeof obj !== 'object') return null;

            // Check if this is a signature (starts with 0x and is 130+ chars)
            if (typeof obj === 'string' && obj.startsWith('0x') && obj.length >= 130) {
              return obj;
            }

            // Check all string values in the object
            for (const key in obj) {
              const value = obj[key];
              if (typeof value === 'string' && value.startsWith('0x') && value.length >= 130) {
                return value;
              }
              if (typeof value === 'object' && value !== null) {
                const found = deepSearch(value, depth + 1);
                if (found) return found;
              }
            }

            return null;
          };

          const deepSignature = deepSearch(result);
          if (deepSignature) {
            signature = deepSignature;
            console.log(`[Gateway Transfer] ✅ Signature found via deep search!`);
          } else {
            // Last resort: For EIP-712 signing challenges, Circle might not expose the signature
            // through the challenge API. We need to inform the user that the signature wasn't found
            console.error(`[Gateway Transfer] ❌ Signature not found in callback result or nested structures`);
            console.error(`[Gateway Transfer] This is a known limitation with User-Controlled Wallets EIP-712 signing challenges`);
            throw new Error(
              "Could not retrieve signature from challenge. " +
              "This may be a limitation with Circle's User-Controlled Wallets SDK. " +
              "Please try using session keys to enable PIN-less signing, or contact support."
            );
          }
        }

        if (!signature) {
          throw new Error("Could not retrieve signature from challenge");
        }

        // Submit signed burn intent to Gateway API
        const submitResponse = await fetch("/api/circle/gateway-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            burnIntent: transfer.burnIntent,
            signature: signature,
          }),
        });

        const submitResult = await submitResponse.json();

        if (submitResult.success) {
          const successMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `🎉 Bridge transfer complete!\n\n` +
              `Your ${transfer.amount} USDC has been bridged from ${transfer.fromChain} to ${transfer.toChain}!\n\n` +
              `The transfer is instant - funds should arrive in seconds.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, successMessage]);

          // Refresh balance
          if (walletId) {
            const newBalance = await getBalance(walletId, walletAddress || undefined, userId || undefined, userToken || undefined);
            if (newBalance) {
              setBalance(newBalance);
            }
          }
        } else {
          throw new Error(submitResult.error || "Failed to submit Gateway transfer");
        }
      } catch (error: any) {
        console.error("[Gateway Transfer] Error completing bridge:", error);
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error completing bridge transfer: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        // Stop AI typing/loading
        setIsLoading(false);
      } finally {
        // Always clear challenge data and reset processing flag, even on error
        setChallengeData(null);
        setShowPinWidget(false);
        processingChallengeRef.current = false;
        // Ensure loading is stopped
        setIsLoading(false);
      }
      return;
    }

    // Handle USYC approval challenge completion
    if (pendingUSYC && pendingUSYC.step === 'approve') {
      try {
        setIsLoading(true);

        // Wait a moment for approval to finalize
        await new Promise(resolve => setTimeout(resolve, 2000));

        const completeMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `✅ Approval complete!\n\nNow ${pendingUSYC.action === 'subscribe' ? 'depositing' : 'redeeming'} your ${pendingUSYC.action === 'subscribe' ? 'USDC' : 'USYC'}...`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, completeMessage]);

        // Complete the second step
        const completeAction = pendingUSYC.action === 'subscribe' ? 'complete-subscribe' : 'complete-redeem';
        const response = await fetch('/api/circle/usyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: completeAction,
            userId: userId!,
            userToken: userToken!,
            walletId: walletId!,
            amount: pendingUSYC.amount,
            blockchain: pendingUSYC.blockchain || 'ETH',
          }),
        });

        const completeResult = await response.json();

        if (completeResult.success && completeResult.data?.challengeId) {
          // Second challenge required - show PIN widget again
          const challengeDataToSet = {
            challengeId: completeResult.data.challengeId,
            userId: userId!,
            userToken: userToken!,
            encryptionKey: encryptionKey || undefined,
          };

          setChallengeData(challengeDataToSet);
          setPendingUSYC({
            ...pendingUSYC,
            step: 'complete',
          });
          setShowPinWidget(true);
          processingChallengeRef.current = false; // Allow next challenge
          setIsLoading(false);
          return;
        } else if (completeResult.success) {
          // Operation completed successfully
          const successMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `🎉 USYC ${pendingUSYC.action === 'subscribe' ? 'deposit' : 'redemption'} complete!\n\n${pendingUSYC.action === 'subscribe' ? `Deposited ${pendingUSYC.amount} USDC into USYC. You're now earning yield!` : `Redeemed ${pendingUSYC.amount} USYC. Your USDC (plus yield) is back in your wallet.`}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, successMessage]);

          // Refresh balance
          if (walletId && walletAddress) {
            const newBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
            if (newBalance) {
              setBalance(newBalance);
            }
          }
        } else {
          throw new Error(completeResult.error || 'Failed to complete USYC operation');
        }
      } catch (error: any) {
        console.error("[USYC] Error completing operation:", error);
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error completing USYC ${pendingUSYC.action}: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setChallengeData(null);
        setShowPinWidget(false);
        setPendingUSYC(null);
        processingChallengeRef.current = false;
        setIsLoading(false);
      }
      return;
    }

    // Handle USYC complete step (subscribe/redeem challenge)
    if (pendingUSYC && pendingUSYC.step === 'complete') {
      // Operation is fully complete
      const successMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `🎉 USYC ${pendingUSYC.action === 'subscribe' ? 'deposit' : 'redemption'} complete!\n\n${pendingUSYC.action === 'subscribe' ? `Deposited ${pendingUSYC.amount} USDC into USYC. You're now earning yield!` : `Redeemed ${pendingUSYC.amount} USYC. Your USDC (plus yield) is back in your wallet.`}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, successMessage]);

      // Refresh balance
      if (walletId && walletAddress) {
        const newBalance = await getBalance(walletId, walletAddress, userId || undefined, userToken || undefined);
        if (newBalance) {
          setBalance(newBalance);
        }
      }

      setChallengeData(null);
      setShowPinWidget(false);
      setPendingUSYC(null);
      processingChallengeRef.current = false;
      setIsLoading(false);
      return;
    }

    // Original transaction challenge handling
    console.log("PIN widget success:", result);
    setShowPinWidget(false);

    // Check if this is a transaction challenge (not wallet creation)
    const isTransactionChallenge = challengeData?.transactionChallenge !== undefined;

    if (isTransactionChallenge && challengeData?.transactionChallenge) {
      // This is a transaction challenge - complete the transaction
      const txChallenge = challengeData.transactionChallenge;
      console.log("[Transaction] PIN confirmed for transaction challenge:", txChallenge);

      // Ensure we have the latest credentials (load from Supabase if challengeData is missing them)
      let pollUserId: string | null = challengeData.userId || userId || null;
      let pollUserToken: string | null = challengeData.userToken || userToken || null;

      // If credentials are missing, try to load from Supabase
      if (typeof window !== "undefined" && pollUserId && !pollUserToken) {
        try {
          const credentials = await loadUserCredentials(pollUserId);
          if (credentials.userToken) {
            pollUserToken = credentials.userToken;
          }
        } catch (error) {
          console.error("[Transaction] Failed to load credentials for polling:", error);
        }
      }
      if (!pollUserId || !pollUserToken) {
        console.warn("[Transaction] Missing user credentials during PIN success polling:", {
          hasUserId: !!pollUserId,
          hasUserToken: !!pollUserToken,
        });
      }

      try {
        setIsLoading(true);

        // After PIN confirmation, the transaction should be completed on Circle's side
        // Poll for the transaction status to confirm it went through
        const progressMsgId = crypto.randomUUID();
        const progressMsg: ChatMessage = {
          id: progressMsgId,
          role: "assistant",
          content: "⏳ PIN confirmed! Processing your transaction...",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, progressMsg]);

        // Function to remove the processing message once transaction is found
        const removeProcessingMessage = () => {
          setMessages((prev) => prev.filter(msg => msg.id !== progressMsgId));
        };

        // Poll for transaction status (transaction might be processing)
        let attempts = 0;
        const maxAttempts = 15; // Try for up to 15 seconds
        let transactionFound = false;

        while (attempts < maxAttempts && !transactionFound) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
          attempts++;

          console.log(`[Transaction] Polling for transaction status (attempt ${attempts}/${maxAttempts})...`);

          try {
            // Query transactions for this wallet to find the one that matches
            // Pass userId and userToken as query parameters (API expects them this way)
            const queryParams = new URLSearchParams({
              walletId: txChallenge.walletId,
              limit: "10",
            });
            if (pollUserId) {
              queryParams.append("userId", pollUserId);
            }
            if (pollUserToken) {
              queryParams.append("userToken", pollUserToken);
            }

            const response = await fetch(
              `/api/circle/transactions?${queryParams.toString()}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            );

            if (response.ok) {
              const data = await response.json();
              const transactions = data.data?.data || [];

              // Find the most recent transaction matching our criteria
              // Check the most recent transactions first (they're usually sorted newest first)
              const matchingTx = transactions.find((tx: any) => {
                const actualTx = tx.transaction || tx;
                const destAddress = actualTx.destinationAddress ||
                  actualTx.destination?.address ||
                  actualTx.to?.address ||
                  actualTx.to;

                // Match by destination address (most reliable)
                const addressMatches = destAddress?.toLowerCase() === txChallenge.destinationAddress.toLowerCase();

                // Accept any status that indicates the transaction exists (not failed)
                const statusMatches = actualTx.status !== "failed" &&
                  actualTx.state !== "FAILED" &&
                  actualTx.state !== "DENIED" &&
                  actualTx.state !== "CANCELLED";

                return addressMatches && statusMatches;
              });

              // If no exact match, check for the most recent transaction (might be our transaction)
              // This handles cases where the transaction was just created
              const mostRecentTx = transactions.length > 0 ? (transactions[0].transaction || transactions[0]) : null;
              const fallbackMatch = mostRecentTx &&
                (mostRecentTx.status !== "failed" && mostRecentTx.state !== "FAILED") &&
                (!matchingTx); // Only use fallback if no exact match found

              const txToUse = matchingTx || (fallbackMatch ? mostRecentTx : null);

              if (txToUse) {
                transactionFound = true;
                const actualTx = txToUse.transaction || txToUse;

                // Remove the "Processing" message since we found the transaction
                removeProcessingMessage();

                // Update balance immediately
                const newBalance = await getBalance(
                  txChallenge.walletId,
                  walletAddress || "",
                  pollUserId || undefined,
                  pollUserToken || undefined
                );
                if (newBalance) {
                  setBalance(newBalance);
                }

                // Extract blockchain hash - check multiple possible fields
                const hash = actualTx.txHash ||
                  actualTx.transactionHash ||
                  actualTx.onChainTxHash ||
                  actualTx.hash ||
                  "";

                // Validate hash format (should be 0x followed by 64 hex chars)
                const isValidHash = hash && /^0x[a-fA-F0-9]{64}$/.test(hash);

                // Don't add confirmation message to chat - transaction appears in transaction history panel
                // Just trigger refresh events
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
                }

                // Clear pending transaction
                setPendingTransaction(null);

                // Trigger refresh for transaction history and balance
                if (typeof window !== 'undefined') {
                  if (isValidHash) {
                    window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  }
                  // Force balance refresh
                  window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
                  // Also refresh balance directly after a short delay to ensure it's updated
                  setTimeout(async () => {
                    const refreshedBalance = await getBalance(
                      txChallenge.walletId,
                      walletAddress || "",
                      pollUserId || undefined,
                      pollUserToken || undefined
                    );
                    if (refreshedBalance) {
                      setBalance(refreshedBalance);
                    }
                  }, 2000);
                }

                break;
              }
            }
          } catch (pollError) {
            console.warn(`[Transaction] Poll attempt ${attempts} failed:`, pollError);
          }
        }

        if (!transactionFound) {
          // Remove the processing message since we couldn't find the transaction
          removeProcessingMessage();

          // Transaction not found after polling - might still be processing
          // Don't add another message, just let the transaction appear in history when it's ready
          console.log("[Transaction] Transaction not found after polling, but it may still be processing");

          // Still trigger refresh events so transaction history can pick it up when available
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
            window.dispatchEvent(new CustomEvent('arcle:balance:refresh'));
          }
        }
      } catch (error) {
        console.error("[Transaction] Error completing transaction after PIN confirmation:", error);
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Your PIN was confirmed, but there was an issue verifying the transaction. Please check your transaction history to see if it completed.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setChallengeData(null);
        setIsLoading(false);
        processingChallengeRef.current = false;
      }

      return; // Exit early - transaction challenge handled
    }

    // Otherwise, this is a wallet creation challenge
    // If status is IN_PROGRESS, the wallet creation is still processing
    const isInProgress = result.status === 'IN_PROGRESS';

    if (isInProgress) {
      const progressMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⏳ Your PIN is set up! Creating your wallet now... This usually takes a few seconds.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, progressMsg]);
    }

    try {
      // Poll for wallet creation (wallet might not be immediately available)
      if (userId && userToken) {
        let attempts = 0;
        const maxAttempts = 10; // Try for up to 10 seconds
        let wallets: any[] | null = null;

        while (attempts < maxAttempts && (!wallets || wallets.length === 0)) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
          attempts++;

          console.log(`Polling for wallet (attempt ${attempts}/${maxAttempts})...`);
          wallets = await listWallets(userId, userToken);

          if (wallets && wallets.length > 0) {
            break;
          }
        }

        if (wallets && wallets.length > 0) {
          const wallet = wallets[0];
          setWalletId(wallet.id);
          setWalletAddress(wallet.address);
          setHasWallet(true);

          // Store wallet in Supabase
          if (typeof window !== 'undefined' && userId) {
            try {
              await saveWalletData(userId, { walletId: wallet.id, walletAddress: wallet.address });
            } catch (error) {
              console.error("[ChatPage] Failed to save wallet data to Supabase:", error);
            }
          }

          // Check balance (don't auto-request faucet)
          const fundedBalance = await getBalance(wallet.id, wallet.address, userId || undefined, userToken || undefined);
          if (fundedBalance) {
            setBalance(fundedBalance);
          }

          const successMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `✅ Your wallet is ready! 
Address: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}

Your wallet is now set up and ready to use. Testnet tokens have been requested for you to start testing!`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, successMsg]);
        } else {
          // Wallet not found after polling
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "Your PIN was set up successfully, but the wallet creation is still processing. Please wait a moment and say 'show wallet' to check your wallet status.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      }
    } catch (error) {
      console.error("Error after PIN setup:", error);
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Your PIN was set up successfully, but there was an issue retrieving your wallet. Please try saying 'show wallet' to see your details.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChallengeData(null);
      setIsLoading(false);
      // Reset processing flag - this is the only place it should be reset for wallet creation
      processingChallengeRef.current = false;
    }
  };

  // Handler for PIN widget error
  const handlePinWidgetError = async (error: any) => {
    console.error("PIN widget error:", error);

    // Check if it's a 401 "Invalid credentials" error - likely expired token
    const is401Error = error.code === 401 ||
      error.message?.includes("Invalid credentials") ||
      error.message?.includes("401");

    if (is401Error && challengeData?.userId) {
      console.log("[PIN Widget] 401 error detected, attempting token refresh...");

      try {
        const newToken = await refreshUserToken();

        if (newToken && newToken.userToken) {
          console.log("[PIN Widget] ✅ Token refreshed, retrying PIN widget...");

          // Update challengeData with new token
          const updatedChallengeData = {
            ...challengeData,
            userToken: newToken.userToken,
            encryptionKey: newToken.encryptionKey || challengeData.encryptionKey || "",
          };

          // Update state
          setUserToken(newToken.userToken);
          if (newToken.encryptionKey) {
            setEncryptionKey(newToken.encryptionKey);
          }

          // Retry with new credentials
          setChallengeData(updatedChallengeData);
          // Keep showPinWidget true to retry
          return; // Don't show error, let it retry
        } else {
          console.warn("[PIN Widget] Token refresh failed, showing error");
        }
      } catch (refreshError) {
        console.error("[PIN Widget] Error during token refresh:", refreshError);
      }
    }

    setShowPinWidget(false);
    setChallengeData(null);
    setIsLoading(false);

    // Handle specific errors
    let errorMessage = "There was an issue setting up your PIN. Please try creating your wallet again.";

    if (is401Error) {
      errorMessage = `⚠️ Authentication Error: Your session has expired.

**What happened:**
Your user token expired (they last for 1 hour). The system tried to refresh it automatically, but it failed.

**To fix this:**
1. Refresh the page to get a new token
2. Or try creating your wallet again - a fresh token will be generated

If the issue persists, you may need to refresh the page and start fresh.`;
    } else if (error.code === 155114 || error.message?.includes("app ID is not recognized")) {
      errorMessage = `⚠️ Configuration Issue: Your Circle App ID is not recognized.

Your Circle App ID doesn't match your API key. This usually happens when:
• The App ID in Vercel environment variables is incorrect
• The App ID is for a different environment (testnet vs production)
• The App ID doesn't match the API key's entity

**To fix on Vercel:**

1. Run locally: \`npx tsx scripts/get-circle-app-id.ts\`
2. Copy the App ID it shows (should be: 46b9a2f0-73f3-535e-8099-990bb2b543e9)
3. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
4. Update \`NEXT_PUBLIC_CIRCLE_APP_ID\` with the correct value
5. Redeploy your application

Or get it from Circle Console:
→ https://console.circle.com
→ Wallets > User Controlled > Configurator
→ Copy the App ID shown there`;
    } else if (error.code === 155118 || error.message?.includes("Invalid encryption key")) {
      errorMessage = `⚠️ Encryption Key Issue: The encryption key doesn't match your user token.

This can happen if:
- The encryption key wasn't properly generated
- There's a mismatch between the user token and encryption key

**To fix this:**
1. Refresh the page (or use incognito mode)
2. Try creating your wallet again
3. A fresh encryption key will be generated automatically

If the issue persists, the encryption key might not be returned from Circle's API. Check the server logs for details.`;
    }

    const errorMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: errorMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, errorMsg]);
  };

  return (
    <>
      <MainLayout
        balance={balance}
        walletId={walletId}
        walletAddress={walletAddress}
        userId={userId}
        onNewChat={() => {
          setMessages([]);
          setReplyToMessageId(null);
        }}
        onLogout={handleLogout}
        onWalletCreated={async (newWalletId: string, newWalletAddress: string) => {
          setWalletId(newWalletId);
          setWalletAddress(newWalletAddress);
          setHasWallet(true);
          // Check balance (don't auto-request faucet)
          const newBalance = await getBalance(newWalletId, newWalletAddress, userId || undefined, userToken || undefined);
          if (newBalance) {
            setBalance(newBalance);
          }
        }}
        onSend={() => handleSendMessage("Send USDC")}
        onReceive={() => handleSendMessage("Show my wallet address")}
        onBridge={() => handleSendMessage("Bridge USDC")}
        onPay={() => handleSendMessage("Pay with USDC")}
        onYield={() => handleSendMessage("Earn yield on my USDC")}
        onWithdraw={() => handleSendMessage("Withdraw USDC")}
        onScan={() => handleSendMessage("Scan an address for safety")}
        onSchedule={() => handleSendMessage("Schedule a payment")}
        selectedTier={selectedTier}
        onTierChange={setSelectedTier}
      >
        <div className="h-full flex flex-col bg-carbon relative">
          {/* Show Welcome Screen when no messages */}
          {messages.length === 0 ? (
            <>
              {/* Welcome Screen Content - Centered vertically */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="w-full max-w-2xl px-4 pointer-events-auto">
                  <WelcomeScreen userName={settings.displayName || undefined} />
                  {/* Chat Input - Directly below greeting */}
                  <div className="mt-6 sm:mt-8">
                    <ChatInput
                      onSendMessage={handleSendMessage}
                      disabled={isLoading}
                      placeholder="Ask anything"
                      replyTo={null}
                      onCancelReply={() => { }}
                      isCentered={true}
                      onQRCodeScanned={(data) => {
                        // Store QR code data in context for AI agent
                        console.log("[ChatPage] QR code scanned:", data);
                        // The message will be auto-sent by ChatInput, but we can also store context here
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Chat Interface */}
              <div className="flex-1 overflow-hidden min-h-0">
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  walletAddress={walletAddress}
                  walletId={walletId}
                  onConfirmTransaction={handleConfirmTransaction}
                  onCancelTransaction={handleCancelTransaction}
                  replyToMessageId={replyToMessageId}
                  onReplyToMessage={setReplyToMessageId}
                />
              </div>
              {/* Chat Input - Fixed at bottom when messages exist */}
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isLoading}
                placeholder="Ask anything"
                replyTo={
                  replyToMessageId
                    ? (() => {
                      const repliedMsg = messages.find((m) => m.id === replyToMessageId);
                      return repliedMsg
                        ? {
                          id: repliedMsg.id,
                          content: repliedMsg.content,
                          role: repliedMsg.role,
                        }
                        : null;
                    })()
                    : null
                }
                onCancelReply={() => setReplyToMessageId(null)}
                onQRCodeScanned={(data) => {
                  // Store QR code data in context for AI agent
                  console.log("[ChatPage] QR code scanned:", data);
                  // The message will be auto-sent by ChatInput, but we can also store context here
                }}
              />
            </>
          )}
        </div>
      </MainLayout>

      {/* Session Status - Show if session keys enabled and wallet exists */}
      {isSessionKeysEnabled() && hasWallet && walletId && userId && userToken && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm">
          <SessionStatus
            walletId={walletId}
            userId={userId}
            userToken={userToken}
            onRevoke={async () => {
              setSessionKeyStatus(null);
              // Reload session status
              if (walletId && userId && userToken) {
                const { checkSessionKeyStatus } = await import("@/lib/ai/sessionKeyHelper");
                const status = await checkSessionKeyStatus(walletId, userId, userToken, 'transfer');
                setSessionKeyStatus(status);
              }
            }}
          />
        </div>
      )}

      {/* Session Approval Modal */}
      {showSessionApproval && walletId && userId && userToken && (
        <SessionApprovalModal
          isOpen={showSessionApproval}
          onApprove={async (config) => {
            try {
              const response = await fetch("/api/circle/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create",
                  walletId,
                  userId,
                  userToken,
                  ...config,
                }),
              });

              const result = await response.json();
              if (result.success) {
                setShowSessionApproval(false);
                setSessionKeyStatus({
                  hasActiveSession: true,
                  canAutoExecute: true,
                  sessionKeyId: result.sessionKey?.sessionKeyId,
                });
                const msg: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: "✅ Session approved! I can now execute actions automatically within your approved limits.",
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, msg]);
              } else {
                alert(`Failed to create session: ${result.error}`);
              }
            } catch (error: any) {
              console.error("[Chat] Error creating session:", error);
              alert(`Error creating session: ${error.message}`);
            }
          }}
          onCancel={() => {
            setShowSessionApproval(false);
          }}
        />
      )}

      {/* Circle PIN Widget Modal */}
      {showPinWidget && challengeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon/90 backdrop-blur-sm">
          <div className="bg-carbon rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 border border-graphite/30">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-signal-white mb-2">
                🔐 Secure Your Wallet
              </h2>
              <p className="text-soft-mist/70 text-sm">
                Set up a 6-digit PIN to protect your wallet. This PIN will be required for all transactions.
              </p>
            </div>

            <CirclePinWidget
              appId={process.env.NEXT_PUBLIC_CIRCLE_APP_ID || ""}
              challengeId={challengeData.challengeId}
              userToken={challengeData.userToken}
              encryptionKey={challengeData.encryptionKey || ""}
              onSuccess={handlePinWidgetSuccess}
              onError={(error) => {
                // Enhanced error handling for App ID issues
                if (!process.env.NEXT_PUBLIC_CIRCLE_APP_ID) {
                  console.error("❌ NEXT_PUBLIC_CIRCLE_APP_ID is not set in environment variables");
                  handlePinWidgetError(new Error("Circle App ID not configured. Please set NEXT_PUBLIC_CIRCLE_APP_ID in .env.local"));
                } else {
                  handlePinWidgetError(error);
                }
              }}
            />

            <div className="mt-4 pt-4 border-t border-graphite/30">
              <p className="text-xs text-soft-mist/50 text-center">
                Secured by Circle • Your PIN is encrypted and never stored
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

