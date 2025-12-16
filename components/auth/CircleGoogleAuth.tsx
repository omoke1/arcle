"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface CircleGoogleAuthProps {
  appId: string;
  onSuccess: (result: {
    userId: string;
    userToken: string;
    encryptionKey: string;
  }) => void;
  onError: (error: any) => void;
}

/**
 * Circle Social Login Component (Google, Facebook, Apple)
 * 
 * Uses Circle's native social login via SDK performLogin method
 * https://developers.circle.com/wallets/user-controlled/authentication-methods#social-logins
 */
export function CircleGoogleAuth({
  appId,
  onSuccess,
  onError,
}: CircleGoogleAuthProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sdkRef = useRef<any>(null);
  const deviceIdRef = useRef<string | null>(null);
  const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeSDK = async () => {
      try {
        // Dynamically import the SDK (only on client side)
        const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");

        if (!mounted) return;

        console.log("Initializing Circle SDK for social login...", {
          appId: appId.substring(0, 8) + "...",
        });

        // Create SDK instance
        const sdk = new W3SSdk();
        sdkRef.current = sdk;

        // Configure SDK
        sdk.setAppSettings({
          appId,
        });

        // Get device ID from SDK (async method)
        const deviceId = await sdk.getDeviceId();
        deviceIdRef.current = deviceId;

        console.log("SDK initialized, device ID:", deviceId);
        setIsLoading(false);
      } catch (err: any) {
        console.error("SDK initialization error:", err);
        setError(err.message || "Failed to initialize Circle SDK");
        setIsLoading(false);
        onError(err);
      }
    };

    initializeSDK();

    // Check if we're returning from a social login redirect
    // Circle SDK might handle this automatically, but we check URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code') || urlParams.has('state')) {
      console.log("Detected OAuth redirect parameters in URL");
      // The SDK should handle this automatically via performLogin callback
    }

    return () => {
      mounted = false;
      if (sdkRef.current) {
        sdkRef.current = null;
      }
    };
  }, [appId, onError]);

  const handleSocialLogin = async () => {
    if (!sdkRef.current || !deviceIdRef.current) {
      const err = new Error("SDK not initialized");
      setError(err.message);
      onError(err);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Initiating Circle social login...");

      // Step 1: Get device token from backend
      if (!deviceIdRef.current) {
        throw new Error("Device ID not available. Please refresh the page.");
      }

      console.log("Requesting device token with deviceId:", deviceIdRef.current);

      const tokenResponse = await fetch("/api/circle/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "social-login",
          deviceId: deviceIdRef.current,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Device token request failed:", tokenData);
        throw new Error(tokenData.error || tokenData.details || `Failed to get device token: ${tokenResponse.statusText}`);
      }

      if (!tokenData.success || !tokenData.data) {
        throw new Error(tokenData.error || "Failed to get device token");
      }

      const { deviceToken, deviceEncryptionKey } = tokenData.data;

      console.log("Device token received:", {
        hasDeviceToken: !!deviceToken,
        hasDeviceEncryptionKey: !!deviceEncryptionKey,
        deviceTokenLength: deviceToken?.length,
      });

      console.log("Starting Circle social login via performLogin...");

      // As per Circle docs, call performLogin with deviceToken + deviceEncryptionKey
      // https://developers.circle.com/wallets/user-controlled/authentication-methods
      // performLogin({ deviceToken, deviceEncryptionKey }, callback)

      // Set a timeout to prevent infinite loading (2 minutes max)
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current);
      }

      loginTimeoutRef.current = setTimeout(() => {
        console.error("Social login timeout - callback never fired after 2 minutes");
        setError("Login timed out. The redirect may have failed. Please try again.");
        setIsLoading(false);
        onError(new Error("Social login timed out - callback never fired"));
      }, 2 * 60 * 1000); // 2 minutes

      sdkRef.current.performLogin(
        {
          deviceToken,
          deviceEncryptionKey,
        },
        (loginError: any, loginResult: any) => {
        // Clear timeout on callback
        if (loginTimeoutRef.current) {
          clearTimeout(loginTimeoutRef.current);
          loginTimeoutRef.current = null;
        }
        
        console.log("performLogin callback triggered", {
          hasError: !!loginError,
          hasResult: !!loginResult,
          errorMessage: loginError?.message,
          resultKeys: loginResult ? Object.keys(loginResult) : [],
        });
        
        if (loginError) {
          console.error("Social login error:", loginError);
          setError(loginError.message || "Social login failed");
          setIsLoading(false);
          onError(loginError);
          return;
        }

        console.log("Social login successful:", loginResult);

        // Extract user credentials from Circle SDK response
        // Circle SDK returns: { userID, userToken, encryptionKey, refreshToken, oAuthInfo }
        const { userID, userToken, encryptionKey } = loginResult || {};

        if (!userID || !userToken) {
          console.error("Missing credentials in loginResult:", loginResult);
          const err = new Error("Missing user credentials from Circle");
          setError(err.message);
          setIsLoading(false);
          onError(err);
          return;
        }

        setIsLoading(false);
        onSuccess({
          userId: userID,
          userToken,
          encryptionKey: encryptionKey || "",
        });
      });
    } catch (err: any) {
      console.error("Social login error:", err);
      setError(err.message || "Failed to authenticate with social provider");
      setIsLoading(false);
      onError(err);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleSocialLogin}
        disabled={isLoading || !!error}
        className="
          w-full
          bg-white/10 hover:bg-white/20
          text-white
          border border-white/20 rounded-lg
          px-4 py-3
          font-medium text-sm
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-3
        "
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 text-center text-sm text-red-400/90">
          {error}
        </div>
      )}
    </div>
  );
}
