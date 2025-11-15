"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { BorderBeamDemo } from "@/components/ui/border-beam-demo";
import { hasValidAccess, grantAccess } from "@/lib/auth/invite-codes";

export default function Home() {
  const router = useRouter();
  const [startVisible, setStartVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Invite code state
  const [inviteCode, setInviteCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  // Handle Get Access button click
  const handleGetAccess = () => {
    // Check if user already has access
    if (hasValidAccess()) {
      // Already verified, go straight to chat
      setIsCreating(true);
      router.push("/chat");
    } else {
      // Need invite code, show modal
      setShowInviteModal(true);
    }
  };

  // Verify invite code
  const handleVerifyCode = async () => {
    if (!inviteCode.trim()) {
      setVerificationStatus('error');
      setErrorMessage("Please enter an invite code");
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('idle');
    setErrorMessage("");

    try {
      const response = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        setVerificationStatus('success');
        grantAccess(inviteCode.trim());
        
        // Redirect after short delay
        setTimeout(() => {
          setShowInviteModal(false);
          setIsCreating(true);
          router.push("/chat");
        }, 1000);
      } else {
        setVerificationStatus('error');
        setErrorMessage(data.message || "Invalid invite code");
      }
    } catch (error) {
      setVerificationStatus('error');
      setErrorMessage("Connection error. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isVerifying) {
      handleVerifyCode();
    }
  };

  // Fade in the start button after animation loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartVisible(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Show content after initial animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-login: Check if user has valid access and wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasAccess = hasValidAccess();
      const storedWalletId = localStorage.getItem('arcle_wallet_id');
      const storedWalletAddress = localStorage.getItem('arcle_wallet_address');
      
      // If user has access and wallet exists, auto-login
      if (hasAccess && storedWalletId && storedWalletAddress) {
        router.push("/chat");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-onyx text-white flex flex-col items-center justify-center px-4 py-12">
      {/* BorderBeam Showcase */}
      <div className={`w-full max-w-5xl mb-10 transition-all duration-1500 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <BorderBeamDemo />
      </div>

      {/* Get Access Button */}
      <div className={`transition-all duration-1500 ease-out ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button 
          onClick={handleGetAccess}
          disabled={isCreating}
          className="
            text-white text-lg md:text-xl tracking-[0.12em] uppercase font-extralight
            transition-all duration-700
            hover:tracking-[0.18em]
            hover:text-white/80
            disabled:opacity-50 disabled:cursor-not-allowed
            px-6 py-3
            border border-white/20 rounded-lg
            hover:border-white/40
            hover:bg-white/10
            backdrop-blur-sm
            flex items-center gap-3
          "
        >
          {isCreating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Launching…</span>
            </>
          ) : (
            "Get Access"
          )}
        </button>
      </div>

      {/* Invite Code Modal */}
      {showInviteModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => !isVerifying && setShowInviteModal(false)}
        >
          <div 
            className="bg-onyx border border-white/20 rounded-2xl p-8 max-w-md w-full relative animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowInviteModal(false)}
              disabled={isVerifying}
              className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-extralight tracking-wider text-white/90 mb-2">
                Enter Invite Code
              </h2>
              <p className="text-sm text-white/60 tracking-wide">
                Arcle is in private testing
              </p>
            </div>

            {/* Input */}
            <div className="mb-4">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="XXXXXXXX"
                maxLength={8}
                disabled={isVerifying || verificationStatus === 'success'}
                autoFocus
                className="
                  w-full
                  bg-transparent
                  text-white text-xl tracking-[0.18em] uppercase font-extralight text-center
                  px-6 py-4
                  border border-white/20 rounded-lg
                  focus:border-white/40 focus:outline-none
                  backdrop-blur-sm
                  placeholder:text-white/30
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300
                "
              />
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerifyCode}
              disabled={isVerifying || verificationStatus === 'success' || !inviteCode.trim()}
              className="
                w-full
                text-white text-lg tracking-[0.12em] uppercase font-extralight
                transition-all duration-700
                hover:text-white/80
                disabled:opacity-50 disabled:cursor-not-allowed
                px-6 py-4
                border border-white/20 rounded-lg
                hover:border-white/40
                hover:bg-white/10
                backdrop-blur-sm
                flex items-center justify-center gap-2
                mb-4
              "
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying</span>
                </>
              ) : verificationStatus === 'success' ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Access Granted</span>
                </>
              ) : (
                "Verify Code"
              )}
            </button>

            {/* Status Messages */}
            {verificationStatus === 'error' && errorMessage && (
              <div className="flex items-center justify-center gap-2 text-red-400/90 text-sm animate-in fade-in duration-300 mb-4">
                <XCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {verificationStatus === 'success' && (
              <div className="flex items-center justify-center gap-2 text-green-400/90 text-sm animate-in fade-in duration-300 mb-4">
                <CheckCircle2 className="w-4 h-4" />
                <span>Welcome to Arcle! Redirecting...</span>
              </div>
            )}

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-white/40 tracking-wide">
                Don&apos;t have a code?{" "}
                <a 
                  href="https://x.com/ArcleAI" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white/80 transition-colors underline"
                >
                  Request access
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
