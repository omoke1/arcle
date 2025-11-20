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
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (!sdkRef.current) {
        throw new Error("SDK not initialized");
      }

      console.log("Verifying OTP code...");

      // Execute OTP verification challenge
      // The SDK will handle the OTP verification and wallet creation
      sdkRef.current.execute(otpCode, (executionError: any, result: any) => {
        if (executionError) {
          console.error("OTP verification error:", executionError);
          setError(executionError.message || "Invalid OTP code");
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">❌ {error}</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setOtpCode("");
          }}
          className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center justify-center space-x-3 py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-gray-700">Setting up verification...</p>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="text-center space-y-2">
            <p className="text-gray-700">
              We sent a 6-digit code to:
            </p>
            <p className="font-semibold text-gray-900">{email}</p>
            <p className="text-sm text-gray-600">
              Check your inbox and spam folder
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter OTP Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <button
            onClick={handleVerifyOTP}
            disabled={otpCode.length !== 6 || isLoading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? "Verifying..." : "Verify & Create Wallet"}
          </button>

          <div className="text-center">
            <button
              onClick={onResendOTP}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              disabled={isLoading}
            >
              Didn&apos;t receive it? Resend OTP
            </button>
          </div>
        </>
      )}
    </div>
  );
}

