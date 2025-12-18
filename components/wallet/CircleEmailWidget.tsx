"use client";

import { useEffect, useRef, useState } from "react";

interface CircleEmailWidgetProps {
  appId: string;
  email: string;
  deviceToken: string;
  deviceEncryptionKey: string;
  otpToken: string;
  onSuccess: (result: any) => void;
  onError: (error: any) => void;
  onResendOTP: () => void;
}

/**
 * Circle Email OTP Widget Component
 * 
 * Handles OTP verification for email-based authentication
 * https://developers.circle.com/wallets/user-controlled/authentication-methods#email
 */
export function CircleEmailWidget({
  appId,
  email,
  deviceToken,
  deviceEncryptionKey,
  otpToken,
  onSuccess,
  onError,
  onResendOTP,
}: CircleEmailWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const sdkRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const initializeSDK = async () => {
      try {
        // Dynamically import the SDK (only on client side)
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        if (!mounted) return;

        console.log("Initializing Circle SDK for email auth...", {
          appId: appId.substring(0, 8) + "...",
          email,
        });

        // Create SDK instance
        const sdk = new W3SSdk();
        sdkRef.current = sdk;

        // Configure SDK with device token for email auth
        sdk.setAppSettings({
          appId,
        });

        // Set authentication with device token
        // Note: SDK types may not include deviceToken, but it's required for email auth
        sdk.setAuthentication({
          deviceToken,
          deviceEncryptionKey,
        } as any);

        setIsLoading(false);
        console.log("SDK initialized, ready for OTP verification");
      } catch (err: any) {
        console.error("SDK initialization error:", err);
        setError(err.message || "Failed to initialize Circle SDK");
        setIsLoading(false);
        onError(err);
      }
    };

    initializeSDK();

    return () => {
      mounted = false;
      if (sdkRef.current) {
        sdkRef.current = null;
      }
    };
  }, [appId, deviceToken, deviceEncryptionKey, email, onError]);

  const handleVerifyOTP = async () => {
    // Extract numeric part from OTP code
    // Circle sends codes like "XB6-727832" or just "727832"
    // We need to extract just the numeric digits (typically 6 digits)
    const numericCode = otpCode.replace(/\D/g, "");
    
    if (!numericCode || numericCode.length < 6) {
      setError("Please enter a valid code (at least 6 digits)");
      return;
    }

    // Use the last 6 digits if code is longer (handles cases like "6727832" -> "727832")
    const codeToVerify = numericCode.length >= 6 ? numericCode.slice(-6) : numericCode;

    try {
      setIsLoading(true);
      setError(null);

      if (!sdkRef.current) {
        throw new Error("SDK not initialized");
      }

      console.log("Verifying OTP code...", {
        originalCode: otpCode,
        extractedCode: codeToVerify,
        codeLength: codeToVerify.length,
        hasOtpToken: !!otpToken,
        otpTokenPreview: otpToken ? otpToken.substring(0, 20) + "..." : "none",
        deviceTokenPreview: deviceToken ? deviceToken.substring(0, 20) + "..." : "none",
      });

      // Execute OTP verification challenge
      // The SDK expects just the numeric part of the OTP code (6 digits)
      // Note: The Web SDK's execute() method handles OTP verification internally
      // It uses the deviceToken set via setAuthentication() to authenticate the request
      sdkRef.current.execute(codeToVerify, (executionError: any, result: any) => {
        if (executionError) {
          console.error("OTP verification error:", executionError);
          // Check for specific Circle error codes
          const errorCode = executionError.code || executionError.errorCode;
          let errorMessage = executionError.message || "Invalid OTP code";
          
          // Map Circle error codes to user-friendly messages
          if (errorCode === 155131 || errorCode === 155133) {
            errorMessage = "Invalid OTP code. Please check the code and try again.";
          } else if (errorCode === 155132) {
            errorMessage = "OTP code not found. Please request a new code.";
          } else if (errorCode === 155134) {
            errorMessage = "OTP code doesn't match. Please check the code from your email.";
          } else if (errorCode === 155130) {
            errorMessage = "OTP code has expired. Please request a new code.";
          } else if (executionError.message?.includes("Invalid credentials") || executionError.code === 401) {
            errorMessage = "Invalid OTP code. Make sure you're entering the 6-digit number from your email (e.g., if code is 'XB6-727832', enter '727832').";
          }
          
          setError(errorMessage);
          setIsLoading(false);
          onError(executionError);
          return;
        }

        console.log("OTP verified successfully:", result);
        onSuccess(result);
      });
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      setError(err.message || "Failed to verify OTP");
      setIsLoading(false);
      onError(err);
    }
  };

  if (error && !isLoading) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-950/30 border border-red-500/50 rounded-lg backdrop-blur-sm">
          <p className="text-red-400 font-medium">❌ {error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setOtpCode("");
          }}
          className="w-full px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 border border-white/20 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#E9F28E]"></div>
          <p className="text-white/80">Setting up verification...</p>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="text-center space-y-2">
            <p className="text-white/70 text-sm">
              We sent a 6-digit code to:
            </p>
            <p className="font-semibold text-[#E9F28E] text-lg">{email}</p>
            <p className="text-xs text-white/50">
              Check your inbox and spam folder
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-white/90 mb-3 text-center">
              Enter OTP Code
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={15}
                value={otpCode}
                onChange={(e) => {
                  // Allow alphanumeric and hyphens (for codes like "XB6-727832")
                  // But extract and show just the numeric part for display
                  const input = e.target.value;
                  // Allow full format but extract numeric part
                  const numeric = input.replace(/\D/g, "");
                  setOtpCode(input); // Store full input to allow user to paste full code
                }}
                placeholder="000000"
                className="w-full px-6 py-4 text-center text-3xl font-mono tracking-[0.3em] 
                  bg-white/5 border-2 border-white/20 rounded-xl 
                  text-white placeholder-white/30
                  focus:outline-none focus:ring-2 focus:ring-[#E9F28E]/50 focus:border-[#E9F28E]/50
                  transition-all duration-200
                  backdrop-blur-sm
                  disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
                autoFocus
              />
              {/* Glow effect on focus */}
              <div className="absolute inset-0 rounded-xl bg-[#E9F28E]/10 opacity-0 focus-within:opacity-100 transition-opacity pointer-events-none blur-xl"></div>
            </div>
            <p className="text-xs text-white/50 mt-2 text-center">
              Enter the 6-digit number from your email
              <br />
              <span className="text-white/40">(e.g., if code is &quot;XB6-727832&quot;, enter &quot;727832&quot;)</span>
            </p>
          </div>

          <button
            onClick={handleVerifyOTP}
            disabled={otpCode.replace(/\D/g, "").length < 6 || isLoading}
            className="w-full px-6 py-4 
              bg-[#E9F28E] text-[#0D0D0C] 
              rounded-xl font-semibold text-base
              hover:bg-[#E9F28E]/90 
              active:scale-[0.98]
              disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed
              transition-all duration-200
              border border-[#E9F28E]/20
              shadow-lg shadow-[#E9F28E]/20"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0D0D0C] border-t-transparent"></div>
                Verifying...
              </span>
            ) : (
              "Verify & Create Wallet"
            )}
          </button>

          <div className="text-center pt-2">
            <button
              onClick={onResendOTP}
              className="text-[#E9F28E] hover:text-[#E9F28E]/80 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              Didn&apos;t receive it? <span className="underline">Resend OTP</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

