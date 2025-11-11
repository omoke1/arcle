"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatInput } from "@/components/chat/ChatInput";
import { CollapsibleHeader } from "@/components/layout/CollapsibleHeader";
import { TransactionPreviewMessage } from "@/components/chat/TransactionPreviewMessage";
import { useCircle } from "@/hooks/useCircle";
import { AIService } from "@/lib/ai/ai-service";
import { updateAddressHistory, calculateRiskScore } from "@/lib/security/risk-scoring";
import { validateAddress } from "@/lib/security/address-validation";
import type { ChatMessage } from "@/types";
import { findDueReminders, findDueCharges, scheduleNext, updateSubscription, listSubscriptions } from "@/lib/subscriptions";
import { monitorTransaction } from "@/lib/notifications/transaction-monitor";
import { startBalanceMonitoring, stopBalanceMonitoring } from "@/lib/notifications/balance-monitor";
import { startIncomingTransactionMonitoring, stopIncomingTransactionMonitoring } from "@/lib/notifications/incoming-transaction-monitor";
import { getAllNotifications, markAsRead, getUnreadCount } from "@/lib/notifications/notification-service";

export default function ChatPage() {
  const router = useRouter();
  const { createWallet, sendTransaction, getBalance, getTransactionStatus, requestTestnetTokens, bridgeTransaction, getBridgeStatus } = useCircle();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    messageId: string;
    amount: string;
    to: string;
  } | null>(null);
  const [sessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("arcle_session_id");
      if (stored) return stored;
      const newId = crypto.randomUUID();
      localStorage.setItem("arcle_session_id", newId);
      return newId;
    }
    return crypto.randomUUID();
  });

  const creatingRef = useRef(false);

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

  // Load wallet from localStorage on mount and fetch real balance
  useEffect(() => {
    const loadWallet = async () => {
      if (typeof window !== 'undefined') {
        const storedWalletId = localStorage.getItem('arcle_wallet_id');
        const storedWalletAddress = localStorage.getItem('arcle_wallet_address');
        
        if (storedWalletId && storedWalletAddress) {
          setWalletId(storedWalletId);
          setWalletAddress(storedWalletAddress);
          setHasWallet(true);
          
          // Always fetch real balance from API/blockchain (no mock data)
          const balance = await getBalance(storedWalletId, storedWalletAddress);
          if (balance) {
            setBalance(balance);
          } else {
            // If balance fetch fails, set to 0 (not a mock, just fallback)
            setBalance("0.00");
          }

          // Start balance monitoring for notifications
          startBalanceMonitoring({
            walletId: storedWalletId,
            walletAddress: storedWalletAddress,
            pollInterval: 15000, // Check every 15 seconds
            enabled: true,
            onBalanceChange: (oldBalance, newBalance, change) => {
              // Add notification message to chat
              const changeNum = parseFloat(change);
              const isIncrease = changeNum > 0;
              const notificationMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: isIncrease
                  ? `💰 **Balance Increased!**\n\nYour balance increased by ${change} USDC!\n\n**New balance:** ${newBalance} USDC`
                  : `💸 **Balance Decreased**\n\nYour balance decreased by ${Math.abs(changeNum)} USDC.\n\n**New balance:** ${newBalance} USDC`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, notificationMsg]);
            },
          });

          // Start incoming transaction monitoring for scam token detection
          startIncomingTransactionMonitoring({
            walletId: storedWalletId,
            walletAddress: storedWalletAddress,
            pollInterval: 20000, // Check every 20 seconds
            enabled: true,
            onIncomingToken: (transfer) => {
              // Safe or medium risk token - just notify
              let content = "";
              if (transfer.analysis?.riskLevel === "medium") {
                content = `⚠️ **Token Received (Medium Risk)**\n\n**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n**Amount:** ${transfer.amount}\n**Risk Score:** ${transfer.analysis?.riskScore}/100\n\n**Warnings:**\n${transfer.analysis?.riskReasons.map(r => `• ${r}`).join('\n')}\n\nPlease review this token carefully.`;
              } else {
                content = `✅ **Token Received**\n\n**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n**Amount:** ${transfer.amount}\n\nToken has been added to your wallet.`;
              }
              
              const notificationMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, notificationMsg]);
            },
            onSuspiciousToken: (transfer) => {
              // Suspicious/scam token - requires approval
              const analysis = transfer.analysis!;
              const notificationMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `🚨 **SUSPICIOUS TOKEN DETECTED**\n\n**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n**Amount:** ${transfer.amount}\n**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n**Risk Score:** ${analysis.riskScore}/100 (${analysis.riskLevel.toUpperCase()})\n\n**Risk Reasons:**\n${analysis.riskReasons.map(r => `• ${r}`).join('\n')}\n\n⚠️ **This token has been blocked for your safety.**\n\nTo approve it, say: "Approve token" or "Accept token"\nTo reject it, say: "Reject token" or "Block token"`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, notificationMsg]);
            },
          });
        } else {
          // No wallet yet - ensure balance is 0
          setBalance("0.00");
        }
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
  }, [router, getBalance, walletId, walletAddress]);
  
  // Removed periodic background polling for balances to honor on-demand fetching

  // Reminder loop: check subscriptions and scheduled payments every 60s
  useEffect(() => {
    const interval = setInterval(async () => {
      if (typeof window === 'undefined') return;
      const now = Date.now();
      
      // Reminders (show once, 2 days before due date)
      const reminders = findDueReminders(now);
      reminders.forEach((s) => {
        // Mark reminder as shown
        updateSubscription(s.id, { lastReminderShownAt: now });
        
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Reminder: your ${s.merchant} subscription (${s.amount} ${s.currency}) renews in 2 days (${new Date(s.nextChargeAt).toLocaleString()}). Would you like to renew?`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, msg]);
      });
      
      // Charges (MVP: auto-renew acknowledge + schedule next)
      const charges = findDueCharges(now);
      charges.forEach((s) => {
        const next = scheduleNext(s);
        updateSubscription(s.id, { nextChargeAt: next.nextChargeAt });
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Auto-renewed ${s.merchant} for ${s.amount} ${s.currency}. Next renewal scheduled.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, msg]);
      });
      
      // Execute scheduled payments
      if (hasWallet && walletId && walletAddress) {
        const { findDuePayments, markAsExecuted, markAsFailed } = await import("@/lib/scheduled-payments");
        const duePayments = findDuePayments(now);
        
        for (const payment of duePayments) {
          try {
            // Execute the payment
            const response = await sendTransaction(
              walletId!,
              payment.to,
              payment.amount,
              walletAddress
            );
            
            if (response && response.id) {
              markAsExecuted(payment.id, response.id);
              const msg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `✅ Scheduled payment executed! Sent $${payment.amount} USDC to ${payment.to.substring(0, 6)}...${payment.to.substring(38)}. Transaction ID: ${response.id}`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, msg]);
            } else {
              markAsFailed(payment.id, "Transaction failed");
              const msg: ChatMessage = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `❌ Scheduled payment failed: Transaction could not be completed. Please check your balance and try again.`,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, msg]);
            }
          } catch (error: any) {
            markAsFailed(payment.id, error.message || "Execution error");
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
  }, [hasWallet, walletId, walletAddress, sendTransaction]);

  const handleLogout = () => {
    // Clear wallet data from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('arcle_wallet_id');
      localStorage.removeItem('arcle_wallet_address');
    }
    
    // Reset state
    setWalletId(null);
    setWalletAddress(null);
    setHasWallet(false);
    setMessages([]);
    
    // Redirect to home page
    router.push("/");
  };

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);

    // Add 3-second delay to show typing indicator
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Use AI service for intent classification and response
    const aiResponse = await AIService.processMessage(content, {
      hasWallet,
      balance,
      walletAddress: walletAddress || undefined,
      walletId: walletId || undefined,
    }, sessionId);
    
    const lowerContent = content.toLowerCase();

    // Handle different intents
    // Allow creating wallet even if one exists (for testing multiple wallets)
    if ((lowerContent.includes("create wallet") || lowerContent.includes("create new wallet") || lowerContent.includes("create another wallet")) && !creatingRef.current) {
      creatingRef.current = true;
      try {
        // If user wants a new wallet, clear the old one first
        if (hasWallet && (lowerContent.includes("new wallet") || lowerContent.includes("another wallet"))) {
          // Clear existing wallet from localStorage to allow new wallet creation
          if (typeof window !== 'undefined') {
            localStorage.removeItem('arcle_wallet_id');
            localStorage.removeItem('arcle_wallet_address');
          }
          setWalletId(null);
          setWalletAddress(null);
          setHasWallet(false);
        }
        
        const creatingMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Creating your ARCLE wallet…",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, creatingMessage]);

        // Pass forceNew flag if user wants a new wallet (clears old one)
        const forceNew = hasWallet && (lowerContent.includes("new wallet") || lowerContent.includes("another wallet"));
        const wallet = await createWallet(forceNew);
        if (!wallet) throw new Error("Failed to create wallet");

        setWalletId(wallet.id);
        setWalletAddress(wallet.address);
        setHasWallet(true);

        // Fund testnet tokens for immediate testing
        await requestTestnetTokens(wallet.address);
        const fundedBalance = await getBalance(wallet.id, wallet.address);
        if (fundedBalance) {
          setBalance(fundedBalance);
        }

        const createdMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Your wallet is ready: ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}. Testnet tokens requested for you.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, createdMsg]);
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

    if ((aiResponse.intent.intent === "send" || aiResponse.intent.intent === "pay") && !hasWallet) {
      const needWalletMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "You don’t have a wallet yet. Say ‘create wallet’ to set one up.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, needWalletMsg]);
      setIsLoading(false);
      return;
    }

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
        const updatedBalance = await getBalance(walletId, walletAddress);
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
            const updatedBalance = await getBalance(walletId, walletAddress);
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
      // Handle bridge intent
      const { amount, recipient: destinationChain } = aiResponse.intent.entities;
      
      if (!amount || !destinationChain) {
        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: aiResponse.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        // Map chain names to our format
        const chainMap: Record<string, "BASE" | "ARBITRUM" | "ETH"> = {
          "ethereum": "ETH",
          "eth": "ETH",
          "base": "BASE",
          "arbitrum": "ARBITRUM",
          "polygon": "ETH", // Default to ETH for now
          "optimism": "ETH",
          "avalanche": "ETH",
        };
        
        const toChain = chainMap[destinationChain.toLowerCase()] || "ETH";
        
        // Extract destination address from message or use a placeholder
        // In a real scenario, the user should provide the destination address
        const bridgeMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `🌉 Initiating bridge of ${amount} USDC from Arc to ${destinationChain}...\n\nPlease provide the destination address on ${destinationChain}.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, bridgeMessage]);
        
        // Note: In a complete implementation, we'd wait for the user to provide the destination address
        // For now, we'll show a message that they need to provide it
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
        content: `⚠️ **HIGH RISK TRANSACTION**\n\nYou're about to proceed with a high-risk transaction (Risk Score: ${message.transactionPreview.riskScore}/100).\n\n**Risk Factors:**\n${message.transactionPreview.riskReasons?.map(r => `• ${r}`).join('\n')}\n\nPlease verify the recipient address is correct. Proceeding with this transaction is at your own risk.`,
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
    
    // Safety Check 3: Re-validate risk score before execution
    try {
      const currentRiskResult = await calculateRiskScore(normalizedAddress, previewAmount);
      if (currentRiskResult.blocked || currentRiskResult.score >= 80) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ **Transaction Blocked**\n\nRisk score has changed to ${currentRiskResult.score}/100 (High Risk).\n\n**Reasons:**\n${currentRiskResult.reasons.map(r => `• ${r}`).join('\n')}\n\nTransaction cancelled for your safety.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
    } catch (error) {
      console.error("Error re-validating risk score:", error);
      // Continue with transaction if risk check fails (fail open, but log the error)
    }
    
    setIsLoading(true);

    // Ensure sufficient balance: attempt faucet if needed (testnet only)
    try {
      if (walletId && walletAddress) {
        const currentBalance = await getBalance(walletId, walletAddress);
        const current = currentBalance ? parseFloat(currentBalance) : 0;
        const needed = parseFloat(previewAmount);
        if (!Number.isNaN(needed) && current < needed) {
          const topupMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Insufficient balance (${currentBalance ?? "0"}). Requesting testnet tokens…`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, topupMsg]);
          await requestTestnetTokens(walletAddress);
          // Wait briefly and refresh balance
          await new Promise((r) => setTimeout(r, 3000));
          const refreshed = await getBalance(walletId, walletAddress);
          if (refreshed) setBalance(refreshed);
        }
      }
    } catch (e) {
      // Continue even if faucet/top-up fails
      // Intentionally no rethrow; user can retry
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
      
      console.log("Sending transaction with:", {
        walletId,
        destinationAddress: normalizedAddress,
        amount: previewAmount,
        walletAddress,
      });
      
      const transaction = await sendTransaction(
        walletId,
        normalizedAddress, // Use checksummed address
        previewAmount,
        walletAddress // CRITICAL: Always pass wallet address for SDK transaction creation
      );
      
      if (transaction) {
        // Update address history for future risk scoring (using normalized address)
        updateAddressHistory(normalizedAddress);
        
        // Refresh balance after successful transaction
        if (walletAddress) {
          const updatedBalance = await getBalance(walletId, walletAddress);
          if (updatedBalance) {
            setBalance(updatedBalance);
          }
        }
        
        // Update message to show confirmed state
        if (pendingTransaction) {
          setMessages((prev) => prev.map(msg =>
            msg.id === pendingTransaction.messageId
              ? {
                  ...msg,
                  content: `✅ Transaction sent successfully!\n\nHash: ${transaction.hash}\nAmount: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}`,
                  transactionPreview: undefined,
                }
              : msg
          ));
        }
        
        // Notify transaction history to refresh
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
        }
        
        // Monitor transaction with notification system
        if (transaction.id && walletId) {
          monitorTransaction({
            walletId,
            transactionId: transaction.id,
            pollInterval: 2000, // 2 seconds
            maxAttempts: 30, // 60 seconds total
            onStatusChange: (status, hash) => {
              if (status === "confirmed") {
                // Add confirmation message with Arc-specific info
                const isValidBlockchainHash = hash && /^0x[a-fA-F0-9]{64}$/.test(hash);
                const explorerLink = isValidBlockchainHash 
                  ? `\n\n🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${hash})`
                  : `\n\n⏳ Transaction is processing. The blockchain hash will be available once the transaction is confirmed.`;
                
                const confirmMessage: ChatMessage = {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: `✅ Transaction confirmed on Arc!\n\n**Transaction ID:** ${transaction.id}\n${isValidBlockchainHash ? `**Transaction Hash:** ${hash}` : ''}\n**Network:** Arc (sub-second finality)\n**Gas Paid:** USDC (no ETH needed)${explorerLink}`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, confirmMessage]);
                
                // If we have a valid hash, trigger refresh
                if (typeof window !== 'undefined' && isValidBlockchainHash) {
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
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
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "An error occurred while sending the transaction. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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
            const updatedBalance = await getBalance(walletId, walletAddress);
            if (updatedBalance) {
              setBalance(updatedBalance);
            }
          }
          
          // Create confirmation message with ArcScan link
          const explorerLink = `\n\n[View on ArcScan](https://testnet.arcscan.app/tx/${status.hash})`;
          
          const confirmMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `✅ **Transaction confirmed on Arc!**\n\n**Transaction Hash:** ${status.hash}\n**Network:** Arc (sub-second finality)\n**Gas Paid:** USDC (no ETH needed)${explorerLink}`,
            timestamp: new Date(),
          };
          
          // Update existing transaction message and add confirmation
          setMessages((prev) => {
            const updated = prev.map(msg => {
              if (msg.content.includes(transactionId) && !msg.content.includes("Transaction confirmed")) {
                return {
                  ...msg,
                  content: msg.content.replace(/pending|in process|processing/gi, "confirmed"),
                };
              }
              return msg;
            });
            // Add confirmation message if not already present
            if (!updated.some(msg => msg.content.includes("Transaction confirmed") && msg.content.includes(status.hash || transactionId))) {
              updated.push(confirmMessage);
            }
            return updated;
          });
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

  return (
    <main className="min-h-screen bg-onyx flex flex-col">
      {/* Collapsible Header with Balance - always shown */}
      <CollapsibleHeader
        balance={balance}
        isLoading={false}
        walletId={walletId}
        walletAddress={walletAddress}
        onSend={() => {
          handleSendMessage("Send");
        }}
        onReceive={() => {
          handleSendMessage("Show my address");
        }}
        onBridge={() => {
          handleSendMessage("Bridge");
        }}
        onPay={() => {
          handleSendMessage("Pay");
        }}
        onYield={() => {
          handleSendMessage("Show yield options");
        }}
        onWithdraw={() => {
          handleSendMessage("Withdraw");
        }}
        onScan={() => {
          handleSendMessage("Scan this address for security risks:");
        }}
        onSchedule={() => {
          handleSendMessage("Schedule a payment");
        }}
        onLogout={handleLogout}
        onWalletCreated={async (newWalletId: string, newWalletAddress: string) => {
          setWalletId(newWalletId);
          setWalletAddress(newWalletAddress);
          setHasWallet(true);
          // Request testnet tokens and update balance for testing
          await requestTestnetTokens(newWalletAddress);
          const newBalance = await getBalance(newWalletId, newWalletAddress);
          if (newBalance) {
            setBalance(newBalance);
          }
        }}
      />

      {/* Chat Interface - Chat-first layout: 90% of screen per ui-plans.md */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          walletAddress={walletAddress}
          walletId={walletId}
          onConfirmTransaction={handleConfirmTransaction}
          onCancelTransaction={handleCancelTransaction}
        />
      </div>

      {/* Chat Input - Fixed at bottom */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder="Chat with ARCLE..."
      />
    </main>
  );
}

