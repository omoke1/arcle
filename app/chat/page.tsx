"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function ChatPage() {
  const router = useRouter();
  const { sendTransaction, getBalance, getTransactionStatus, requestTestnetTokens } = useCircle();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasWallet, setHasWallet] = useState(true); // TODO: Check actual wallet state
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    messageId: string;
    amount: string;
    to: string;
  } | null>(null);

  // Load wallet from localStorage on mount and fetch balance
  useEffect(() => {
    const loadWallet = async () => {
      if (typeof window !== 'undefined') {
        const storedWalletId = localStorage.getItem('arcle_wallet_id');
        const storedWalletAddress = localStorage.getItem('arcle_wallet_address');
        
        if (storedWalletId && storedWalletAddress) {
          setWalletId(storedWalletId);
          setWalletAddress(storedWalletAddress);
          setHasWallet(true);
          
          // Fetch initial balance
          const balance = await getBalance(storedWalletId, storedWalletAddress);
          if (balance) {
            setBalance(balance);
          }
        } else {
          // No wallet found, redirect to home to create one
          router.push("/");
        }
      }
    };
    
    loadWallet();
  }, [router, getBalance]);
  
  // Refresh balance periodically (every 30 seconds)
  useEffect(() => {
    if (!walletId || !walletAddress) return;
    
    const interval = setInterval(async () => {
      const updatedBalance = await getBalance(walletId, walletAddress);
      if (updatedBalance) {
        setBalance(updatedBalance);
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [walletId, walletAddress, getBalance]);

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

    // Use AI service for intent classification and response
    const aiResponse = await AIService.processMessage(content, {
      hasWallet,
      balance,
      walletAddress: walletAddress || undefined,
    });
    
    const lowerContent = content.toLowerCase();

    // Handle different intents
    if ((aiResponse.intent.intent === "send" || aiResponse.intent.intent === "pay") && aiResponse.transactionPreview && walletId) {
      // Check if transaction is blocked
      const isBlocked = aiResponse.transactionPreview.blocked || 
                        (aiResponse.transactionPreview.riskScore !== undefined && 
                         aiResponse.transactionPreview.riskScore >= 80);
      
      // Send transaction preview (only set pending if not blocked)
      const messageId = crypto.randomUUID();
      const aiMessage: ChatMessage = {
        id: messageId,
        role: "assistant",
        content: aiResponse.message,
        timestamp: new Date(),
        transactionPreview: aiResponse.transactionPreview,
      };
      
      // Only set pending transaction if not blocked
      if (!isBlocked) {
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
      // Fetch and display transaction history
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Fetching your transaction history...",
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
    if (!pendingTransaction || !walletId) return;
    
    // Safety Check 1: Verify transaction preview exists and is not blocked
    const message = messages.find(m => m.id === pendingTransaction.messageId);
    if (!message?.transactionPreview) {
      console.error("Transaction preview not found");
      return;
    }
    
    if (message.transactionPreview.blocked || 
        (message.transactionPreview.riskScore !== undefined && 
         message.transactionPreview.riskScore >= 80)) {
      // Show error message
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⚠️ This transaction has been blocked for your safety. Please verify the recipient address and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    
    // Safety Check 2: Validate and normalize address
    const addressValidation = validateAddress(pendingTransaction.to);
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
    const normalizedAddress = addressValidation.normalizedAddress || pendingTransaction.to;
    
    // Safety Check 3: Re-validate risk score before execution
    try {
      const currentRiskResult = await calculateRiskScore(normalizedAddress, pendingTransaction.amount);
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
    
    try {
      // Update message to show pending state
      setMessages((prev) => prev.map(msg => 
        msg.id === pendingTransaction.messageId
          ? {
              ...msg,
              transactionPreview: msg.transactionPreview ? {
                ...msg.transactionPreview,
              } : undefined,
            }
          : msg
      ));
      
      // Send transaction using normalized address
      const transaction = await sendTransaction(
        walletId,
        normalizedAddress, // Use checksummed address
        pendingTransaction.amount
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
        setMessages((prev) => prev.map(msg => 
          msg.id === pendingTransaction.messageId
            ? {
                ...msg,
                content: `✅ Transaction sent successfully!\n\nHash: ${transaction.hash}\nAmount: $${pendingTransaction.amount} USDC\nTo: ${pendingTransaction.to.substring(0, 6)}...${pendingTransaction.to.substring(38)}`,
                transactionPreview: undefined,
              }
            : msg
        ));
        
        // Poll for transaction status (Arc has sub-second finality, so poll faster)
        if (transaction.id) {
          pollTransactionStatus(transaction.id, 10, 1000); // 10 attempts, 1 second interval for Arc
        }
        
            // Add confirmation message with Arc-specific info
            const confirmMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `✅ Transaction confirmed on Arc!\n\n**Transaction Hash:** ${transaction.hash}\n**Network:** Arc (sub-second finality)\n**Gas Paid:** USDC (no ETH needed)\n\n🔗 [View on Arc Explorer](https://testnet.arcscan.app/tx/${transaction.hash})`,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, confirmMessage]);
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
      const pollTransactionStatus = async (transactionId: string, maxAttempts = 10, pollInterval = 2000) => {
        let attempts = 0;
    
    const poll = async () => {
      if (attempts >= maxAttempts) return;
      
      attempts++;
      const status = await getTransactionStatus(transactionId);
      
      if (status && status.status === "confirmed") {
        // Update balance after confirmation
        if (walletId && walletAddress) {
          const updatedBalance = await getBalance(walletId, walletAddress);
          if (updatedBalance) {
            setBalance(updatedBalance);
          }
        }
        
        // Update transaction status in messages
        setMessages((prev) => prev.map(msg => {
          if (msg.content.includes(transactionId) || msg.content.includes("Transaction confirmed")) {
            return {
              ...msg,
              content: msg.content.replace(/pending|confirmed/g, "confirmed"),
            };
          }
          return msg;
        }));
      } else if (status && status.status === "failed") {
        setMessages((prev) => prev.map(msg => {
          if (msg.content.includes(transactionId)) {
            return {
              ...msg,
              content: msg.content + "\n\n❌ Transaction failed. Please try again.",
            };
          }
          return msg;
        }));
      } else {
        // Continue polling
        setTimeout(poll, pollInterval);
      }
    };
    
    setTimeout(poll, pollInterval);
  };

  return (
    <main className="min-h-screen bg-onyx flex flex-col">
      {/* Collapsible Header with Balance - Only shown when wallet exists per ui-plans.md */}
      {hasWallet && (
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
          onLogout={handleLogout}
          onWalletCreated={async (newWalletId: string, newWalletAddress: string) => {
            setWalletId(newWalletId);
            setWalletAddress(newWalletAddress);
            setHasWallet(true);
            // Refresh balance
            const newBalance = await getBalance(newWalletId, newWalletAddress);
            if (newBalance) {
              setBalance(newBalance);
            }
            // Request testnet tokens
            await requestTestnetTokens(newWalletAddress);
          }}
        />
      )}

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

