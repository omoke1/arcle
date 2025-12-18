"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, X, Mail } from "lucide-react";
import { BorderBeamDemo } from "@/components/ui/border-beam-demo";
import { BorderBeam } from "@/components/ui/border-beam";
import { hasValidAccess, grantAccess } from "@/lib/auth/invite-codes";
import { loadWalletData, saveUserCredentials, loadUserCredentials } from "@/lib/supabase-data";
import { getSupabaseClient } from "@/lib/supabase";
import { circleConfig } from "@/lib/circle";

const designTokens = {
  aurora: "#E9F28E",
  carbon: "#0D0D0C",
};

export default function Home() {
  const router = useRouter();
  const [startVisible, setStartVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Auth State
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Invite State
  const [inviteCode, setInviteCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");

  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => setStartVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        console.log("Found existing session:", session.user.id);
        await handleAuthSuccess(session.user);
      } else {
        // Legacy local storage check
        const legacyId = localStorage.getItem('arcle_user_id');
        if (legacyId) {
          // If we have a legacy ID but no Supabase session, we might want to prompt login?
          // For now, let's just let them stay on landing page
        }
      }
    };
    checkSession();
  }, []);

  const handleGetAccess = async () => {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      await handleAuthSuccess(session.user);
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = async (user: any) => {
    setAuthenticatedUser(user);
    setShowAuthModal(false);

    try {
      setIsCreating(true);

      // 1. Ensure Circle User exists / Get Tokens
      // We pass the Supabase User ID as the 'userId' to our API
      console.log("Syncing with Circle for user:", user.id);
      const response = await fetch("/api/circle/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to sync with Circle");
      }

      const { userToken, encryptionKey } = data.data;

      // 2. Save Credentials locally/supabase
      await saveUserCredentials(user.id, {
        userToken,
        encryptionKey
      });

      // 3. Check Access
      const hasAccess = await hasValidAccess(user.id);

      if (hasAccess) {
        // 4. Check Wallet (Optional: could duplicate logic effectively)
        const walletData = await loadWalletData(user.id);
        if (!walletData.walletId) {
          // No wallet yet? We'll let Chat page handle creation
          // or we could force creation here. 
          // Existing flow does it in Chat page usually.
        }

        router.push("/chat");
      } else {
        setIsCreating(false);
        setShowInviteModal(true);
      }

    } catch (err: any) {
      console.error("Auth success provisioning failed:", err);
      setErrorMessage(err.message || "Failed to setup account");
      setIsCreating(false);
      setShowAuthModal(true); // Show modal again to show error?
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage("");
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback` // We need to make sure this route exists or handle on page load
      }
    });
    if (error) setErrorMessage(error.message);
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      setErrorMessage("Please enter email and password");
      return;
    }

    setIsAuthenticating(true);
    setErrorMessage("");
    const supabase = getSupabaseClient();

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          // If email confirmation is off, we are logged in.
          // If on, we need to show message. Assuming off/auto-confirm for beta.
          await handleAuthSuccess(data.user);
        } else {
          setErrorMessage("Check your email for confirmation link.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          await handleAuthSuccess(data.user);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message);
      setIsAuthenticating(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!inviteCode.trim() || !authenticatedUser) return;

    setIsVerifying(true);
    setVerificationStatus('idle');

    try {
      // Server-side verify
      const response = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inviteCode.trim(),
          userId: authenticatedUser.id
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setVerificationStatus('success');
        // Grant access linked to the authenticated user
        await grantAccess(inviteCode.trim(), authenticatedUser.id);

        setTimeout(() => {
          setShowInviteModal(false);
          setIsCreating(true);
          router.push("/chat");
        }, 1000);
      } else {
        setVerificationStatus('error');
        setErrorMessage(data.message || "Invalid code");
      }
    } catch (error) {
      setVerificationStatus('error');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: designTokens.carbon }}
    >
      <div
        className={`w-full max-w-5xl mb-10 transition-all duration-1500 ease-out ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
      >
        <BorderBeamDemo />
      </div>

      <div
        className={`transition-all duration-1500 ease-out ${startVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
      >
        <button
          onClick={handleGetAccess}
          disabled={isCreating}
          className="
            text-white text-lg md:text-xl tracking-[0.18em] uppercase font-extralight
            transition-all duration-700
            hover:tracking-[0.24em]
            hover:text-white/80
            disabled:opacity-50 disabled:cursor-not-allowed
            px-8 py-3
            border border-white/25 rounded-[999px]
            hover:border-white/60
            hover:bg-white/5
            backdrop-blur-sm
            flex items-center gap-3
          "
          style={{ boxShadow: "0 0 40px rgba(0,0,0,0.65)" }}
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

      {showAuthModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="bg-onyx border border-white/20 rounded-2xl p-8 max-w-md w-full relative overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1A1A1A" }}
          >
            <BorderBeam size={200} duration={10} delay={0} />
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-6 text-center">
              <h2 className="text-3xl font-bold text-white/90 mb-2">
                {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-sm text-white/60">
                Sign in to manage your wallet and chats
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full bg-white text-black font-medium rounded-lg px-4 py-3 flex items-center justify-center gap-2 mb-4 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10"></div>
              <span className="text-xs text-white/40">or</span>
              <div className="flex-1 h-px bg-white/10"></div>
            </div>

            <div className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-aurora/50"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-aurora/50"
                />
              </div>

              {errorMessage && (
                <p className="text-red-400 text-sm">{errorMessage}</p>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={isAuthenticating}
                className="w-full bg-aurora text-carbon font-semibold rounded-lg px-4 py-3 hover:bg-aurora/90 transition-colors disabled:opacity-50"
              >
                {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (authMode === 'signup' ? 'Create Account' : 'Sign In')}
              </button>

              <div className="text-center text-sm text-white/50">
                {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button onClick={() => setAuthMode(authMode === 'signup' ? 'signin' : 'signup')} className="text-aurora hover:underline">
                  {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => !isVerifying && setShowInviteModal(false)}
        >
          {/* Invite Modal Content - Same as before but uses handleVerifyCode updated logic */}
          <div
            className="bg-onyx border border-white/20 rounded-2xl p-8 max-w-md w-full relative overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#1A1A1A" }}
          >
            <BorderBeam size={200} duration={10} delay={0} />
            <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white/90"><X className="w-6 h-6" /></button>

            <div className="text-center mb-6">
              <h2 className="text-2xl text-white/90 font-light tracking-wider">Enter Invite Code</h2>
              <p className="text-sm text-white/60">Private Beta Access</p>
            </div>

            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              maxLength={8}
              className="w-full bg-transparent text-white text-xl tracking-[0.2em] text-center border border-white/20 rounded-lg px-6 py-4 mb-4 focus:outline-none focus:border-white/50"
            />

            {errorMessage && verificationStatus === 'error' && <p className="text-red-400 text-sm text-center mb-4">{errorMessage}</p>}

            <button
              onClick={handleVerifyCode}
              disabled={isVerifying || !inviteCode}
              className="w-full bg-white/10 border border-white/20 text-white py-4 rounded-lg hover:bg-white/20 transition-all uppercase tracking-widest disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify Code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
