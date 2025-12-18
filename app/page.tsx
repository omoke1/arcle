"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, X } from "lucide-react";
import { BorderBeamDemo } from "@/components/ui/border-beam-demo";
import { BorderBeam } from "@/components/ui/border-beam";
import { hasValidAccess, grantAccess } from "@/lib/auth/invite-codes";
import { loadWalletData, loadUserCredentials, saveUserCredentials, saveWalletData } from "@/lib/supabase-data";
import { CircleGoogleAuth } from "@/components/auth/CircleGoogleAuth";
import { CircleEmailWidget } from "@/components/wallet/CircleEmailWidget";
import { circleConfig } from "@/lib/circle";
// Wallet creation moved to API route to avoid client-side SDK issues

const designTokens = {
  aurora: "#E9F28E",
  carbon: "#0D0D0C",
};

export default function Home() {
  const router = useRouter();
  const [startVisible, setStartVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [circleAuthData, setCircleAuthData] = useState<{
    userId: string;
    userToken: string;
    encryptionKey: string;
  } | null>(null);
  const [email, setEmail] = useState("");
  const [showEmailOTP, setShowEmailOTP] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailAuthData, setEmailAuthData] = useState<any>(null);
  const [isSendingOTP, setIsSendingOTP] = useState(false);

  const handleGetAccess = async () => {
    const hasAccess = await hasValidAccess();
    if (hasAccess) {
      setIsCreating(true);
      router.push("/chat");
    } else {
      // Show Google auth first, then invite code
      setShowGoogleAuth(true);
    }
  };

  const handleGoogleAuthSuccess = (result: {
    userId: string;
    userToken: string;
    encryptionKey: string;
  }) => {
    console.log("Social login successful, showing invite code modal...");
    setCircleAuthData(result);
    setShowGoogleAuth(false);
    setShowInviteModal(true);
  };

  const handleGoogleAuthError = (error: any) => {
    console.error("Social login error:", error);
    setErrorMessage(error.message || "Failed to authenticate with social provider");
    setShowGoogleAuth(false);
  };

  const handleEmailSignUp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    setIsSendingOTP(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/circle/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "email-login",
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        setEmailAuthData(data.data);
        setShowEmailOTP(true);
        console.log("OTP sent to email:", email);
      } else {
        setErrorMessage(data.error || "Failed to send verification code");
      }
    } catch (error) {
      setErrorMessage("Connection error. Please try again.");
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleEmailOTPSuccess = (result: any) => {
    console.log("Email OTP verified successfully:", result);

    // Extract user credentials from the W3S SDK result
    // The SDK should return userId, userToken, and encryptionKey after successful OTP verification
    if (result && result.userId) {
      setCircleAuthData({
        userId: result.userId,
        userToken: result.userToken,
        encryptionKey: result.encryptionKey,
      });
      setShowGoogleAuth(false);
      setShowEmailOTP(false);
      setShowInviteModal(true);
    } else {
      setErrorMessage("Failed to retrieve user credentials from Circle");
    }
  };

  const handleEmailOTPError = (error: any) => {
    console.error("Email OTP error:", error);
    setErrorMessage(error.message || "Failed to verify email");
  };

  const handleResendOTP = async () => {
    try {
      const response = await fetch("/api/circle/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend-otp",
          email: emailAuthData.email,
          deviceId: emailAuthData.deviceId,
          otpToken: emailAuthData.otpToken,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log("OTP resent successfully");
        // Update the otpToken if a new one is returned
        if (data.data?.otpToken) {
          setEmailAuthData({
            ...emailAuthData,
            otpToken: data.data.otpToken,
          });
        }
      } else {
        setErrorMessage(data.error || "Failed to resend OTP");
      }
    } catch (error) {
      setErrorMessage("Connection error. Please try again.");
    }
  };

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
        body: JSON.stringify({
          code: inviteCode.trim(),
          circleUserId: circleAuthData?.userId,
          circleUserToken: circleAuthData?.userToken,
          circleEncryptionKey: circleAuthData?.encryptionKey,
        }),
      });

      const data = await response.json();

      if (data.valid) {
        setVerificationStatus('success');
        await grantAccess(inviteCode.trim());

        // Save Circle credentials to Supabase and localStorage
        if (circleAuthData) {
          try {
            // Save to Supabase
            await saveUserCredentials(circleAuthData.userId, {
              userToken: circleAuthData.userToken,
              encryptionKey: circleAuthData.encryptionKey,
            });
            console.log("Circle credentials saved to Supabase");

            // Save to localStorage for chat page
            if (typeof window !== 'undefined') {
              localStorage.setItem("arcle_user_id", circleAuthData.userId);
              localStorage.setItem("arcle_user_token", circleAuthData.userToken);
              if (circleAuthData.encryptionKey) {
                localStorage.setItem("arcle_encryption_key", circleAuthData.encryptionKey);
              }
            }

            // Ensure wallet exists after signup (non-blocking - don't wait for it)
            // Wallet creation will happen in background, or in chat page if needed
            // Use API route instead of direct client-side call to avoid SDK issues
            console.log("Ensuring wallet exists after signup...");
            fetch("/api/circle/wallets/ensure-after-signup", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: circleAuthData.userId,
                userToken: circleAuthData.userToken,
                encryptionKey: circleAuthData.encryptionKey,
                blockchain: "ARC-TESTNET",
              }),
            })
              .then((res) => res.json())
              .then((walletResult) => {
                if (walletResult.success) {
                  if (walletResult.walletId && walletResult.walletAddress) {
                    // Wallet created successfully
                    console.log("Wallet created/verified after signup:", {
                      walletId: walletResult.walletId,
                      address: walletResult.walletAddress.substring(0, 10) + "...",
                    });

                    // Save wallet to localStorage
                    if (typeof window !== 'undefined') {
                      localStorage.setItem("arcle_wallet_id", walletResult.walletId);
                      localStorage.setItem("arcle_wallet_address", walletResult.walletAddress);
                    }
                  } else if (walletResult.challengeId) {
                    // Wallet creation requires PIN setup
                    console.log("Wallet creation requires PIN setup, challengeId:", walletResult.challengeId);
                    // Note: PIN setup will be handled in chat page when user first interacts
                    // For now, just redirect - chat page will detect missing wallet and prompt for PIN
                  }
                } else {
                  console.warn("Wallet creation after signup failed:", walletResult.error);
                  // Continue anyway - wallet can be created in chat
                }
              })
              .catch((error) => {
                console.error("Error ensuring wallet after signup:", error);
                // Don't block - wallet can be created in chat page
              });
          } catch (error) {
            console.error("Failed to save Circle credentials or create wallet:", error);
            // Continue anyway - user can still proceed to chat
          }
        }

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isVerifying) {
      handleVerifyCode();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkAutoLogin = async () => {
        const hasAccess = await hasValidAccess();

        // Try to load wallet data from Supabase
        try {
          // Try to get userId from credentials first
          const credentials = await loadUserCredentials("current").catch(() => null);
          let userId: string | null = null;

          if (credentials) {
            // Try to get current user ID from a preference
            const { loadPreference } = await import("@/lib/supabase-data");
            const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
            userId = currentUserPref?.value || null;
          }

          // Migration fallback: try localStorage
          if (!userId) {
            const legacyUserId = localStorage.getItem('arcle_user_id');
            if (legacyUserId) {
              userId = legacyUserId;
            }
          }

          if (userId) {
            const walletData = await loadWalletData(userId);
            if (walletData && walletData.walletId && walletData.walletAddress) {
              // Wallet exists in Supabase, auto-login
              if (hasAccess) {
                router.push("/chat");
                return;
              }
            }
          }

          // Migration fallback: check localStorage
          const storedWalletId = localStorage.getItem('arcle_wallet_id');
          const storedWalletAddress = localStorage.getItem('arcle_wallet_address');

          // If user has access and wallet exists, auto-login
          if (hasAccess && storedWalletId && storedWalletAddress) {
            router.push("/chat");
          }
        } catch (error) {
          console.error("[Home] Error checking auto-login:", error);
          // Fallback to localStorage check
          const storedWalletId = localStorage.getItem('arcle_wallet_id');
          const storedWalletAddress = localStorage.getItem('arcle_wallet_address');
          const hasAccess = await hasValidAccess();

          if (hasAccess && storedWalletId && storedWalletAddress) {
            router.push("/chat");
          }
        }
      };

      checkAutoLogin();
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => setStartVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

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
          style={{
            boxShadow: "0 0 40px rgba(0,0,0,0.65)",
          }}
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

      {showGoogleAuth && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setShowGoogleAuth(false)}
        >
          <div
            className="bg-onyx border border-white/20 rounded-2xl p-8 max-w-md w-full relative overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Border Beam */}
            <BorderBeam size={200} duration={10} delay={0} />

            {/* Close Button */}
            <button
              onClick={() => setShowGoogleAuth(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Title */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white/90 mb-2">
                Sign up
              </h2>
              <p className="text-sm text-white/60">
                Already have an account? Use the same email or Google account to
                continue.
              </p>
            </div>

            {!showEmailOTP ? (
              <>
                {/* Email Section */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white/90 mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isSendingOTP) {
                        handleEmailSignUp();
                      }
                    }}
                    placeholder="Email"
                    className="
                      w-full
                      bg-white/5 border border-white/10 rounded-lg
                      px-4 py-3
                      text-white placeholder:text-white/40
                      focus:outline-none focus:ring-2 focus:ring-aurora/50 focus:border-aurora/50
                      transition-all
                    "
                    disabled={isSendingOTP}
                  />
                  <p className="text-xs text-white/50 mt-2">
                    We&apos;ll send an email with a verification code.
                  </p>
                  <button
                    onClick={handleEmailSignUp}
                    disabled={isSendingOTP || !email.trim()}
                    className="
                      w-full mt-4
                      bg-aurora text-carbon
                      rounded-lg px-4 py-3
                      font-semibold text-sm tracking-wide uppercase
                      hover:bg-aurora/90
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                      flex items-center justify-center gap-2
                    "
                  >
                    {isSendingOTP ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "SIGN UP"
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-white/10"></div>
                  <span className="text-xs text-white/40">or</span>
                  <div className="flex-1 h-px bg-white/10"></div>
                </div>

                {/* Social Login Buttons */}
                <div className="space-y-3">
                  <CircleGoogleAuth
                    appId={circleConfig.appId}
                    onSuccess={handleGoogleAuthSuccess}
                    onError={handleGoogleAuthError}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Circle Email OTP Widget */}
                <div className="mb-4">
                  <p className="text-sm text-white/60 mb-4">
                    Enter the 6-digit code sent to <span className="text-white/90">{emailAuthData.email}</span>
                  </p>

                  <CircleEmailWidget
                    appId={circleConfig.appId}
                    email={emailAuthData.email}
                    deviceToken={emailAuthData.deviceToken}
                    deviceEncryptionKey={emailAuthData.deviceEncryptionKey}
                    otpToken={emailAuthData.otpToken}
                    onSuccess={handleEmailOTPSuccess}
                    onError={handleEmailOTPError}
                    onResendOTP={handleResendOTP}
                  />
                </div>

                {/* Back Button */}
                <button
                  onClick={() => {
                    setShowEmailOTP(false);
                    setErrorMessage("");
                  }}
                  className="
                    w-full
                    text-white/60 text-sm
                    hover:text-white/80
                    transition-colors
                    mt-4
                  "
                >
                  ← Back to email
                </button>
              </>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center justify-center gap-2 text-red-400/90 text-sm mb-4">
                <XCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Terms Text */}
            <div className="text-center mt-6">
              <p className="text-xs text-white/50">
                By continuing, you agree to our{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-aurora hover:text-aurora/80 transition-colors"
                >
                  Terms of Use
                </a>
                {" & "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-aurora hover:text-aurora/80 transition-colors"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => !isVerifying && setShowInviteModal(false)}
        >
          <div
            className="bg-onyx border border-white/20 rounded-2xl p-8 max-w-md w-full relative overflow-hidden animate-in fade-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Animated Border Beam */}
            <BorderBeam size={200} duration={10} delay={0} />

            {/* Close Button */}
            <button
              onClick={() => setShowInviteModal(false)}
              disabled={isVerifying}
              className="absolute top-4 right-4 text-white/60 hover:text-white/90 transition-colors disabled:opacity-50 z-10"
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
