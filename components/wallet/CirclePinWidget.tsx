"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

interface CirclePinWidgetProps {
  appId: string;
  challengeId: string;
  userToken: string;
  encryptionKey: string;
  onSuccess: (result: any) => void;
  onError: (error: any) => void;
}

/**
 * Circle PIN Widget Component
 * 
 * Handles PIN setup and wallet creation using Circle's Web SDK
 * https://developers.circle.com/w3s/docs/web-sdk-ui-customize
 */
export function CirclePinWidget({
  appId,
  challengeId,
  userToken,
  encryptionKey,
  onSuccess,
  onError,
}: CirclePinWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sdkRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const initializeSDK = async () => {
      try {
        // Dynamically import the SDK (only on client side)
        // Note: This must be a dynamic import to avoid SSR issues
        const sdkModule = await import("@circle-fin/w3s-pw-web-sdk");
        const { W3SSdk } = sdkModule;
        
        if (!W3SSdk) {
          throw new Error("W3SSdk not found in @circle-fin/w3s-pw-web-sdk module");
        }

        if (!mounted) return;

        console.log("Initializing Circle SDK...", {
          appId: appId.substring(0, 8) + "...",
          challengeId: challengeId.substring(0, 8) + "...",
        });

        // Create SDK instance
        const sdk = new W3SSdk();
        sdkRef.current = sdk;

        // Validate encryption key
        if (!encryptionKey || encryptionKey.trim() === "") {
          throw new Error(
            "Encryption key is missing. This is required for PIN setup. " +
            "Please try creating your wallet again - a new encryption key will be generated."
          );
        }

        // Configure SDK
        sdk.setAppSettings({
          appId,
        });

        sdk.setAuthentication({
          userToken,
          encryptionKey: encryptionKey.trim(), // Ensure no whitespace
        });

        // Wait for container to be ready before executing
        // The SDK needs the DOM to be fully rendered
        await new Promise(resolve => {
          if (typeof window !== 'undefined') {
            // Wait for next tick to ensure DOM is ready
            setTimeout(() => {
              // Double-check container exists
              const container = document.getElementById('w3s-widget-container');
              if (!container && containerRef.current) {
                const newContainer = document.createElement('div');
                newContainer.id = 'w3s-widget-container';
                newContainer.style.width = '100%';
                newContainer.style.minHeight = '400px';
                containerRef.current.appendChild(newContainer);
              }
              resolve(undefined);
            }, 200);
          } else {
            resolve(undefined);
          }
        });

        setIsLoading(false);

        // Execute the challenge
        // The SDK will automatically render the PIN widget UI in the page
        console.log("Executing challenge:", challengeId);
        sdk.execute(challengeId, (executionError, result) => {
          if (executionError) {
            // Log detailed error information
            const errorDetails = {
              code: (executionError as any).code,
              message: executionError.message || String(executionError),
              name: (executionError as any).name || 'Error',
              stack: (executionError as any).stack,
              fullError: executionError,
            };
            console.error("Challenge execution error:", errorDetails);
            
            // Handle specific errors
            if (executionError.code === 155114 || executionError.message?.includes("app ID is not recognized")) {
              const errorMsg = `App ID Configuration Error (Code: ${executionError.code})

Your Circle App ID doesn't match your API key. This usually happens when:
• The App ID in Vercel environment variables is incorrect
• The App ID is for a different environment (testnet vs production)
• The App ID doesn't match the API key's entity

To fix:
1. Run locally: npx tsx scripts/get-circle-app-id.ts
2. Copy the App ID it shows
3. Update Vercel environment variable: NEXT_PUBLIC_CIRCLE_APP_ID
4. Redeploy your application

Or get it from Circle Console:
→ https://console.circle.com
→ Wallets > User Controlled > Configurator`;
              setError(errorMsg);
            } else if ((executionError as any).code === 155118 || executionError.message?.includes("Invalid encryption key")) {
              setError(
                "Encryption key error. This usually means the encryption key doesn't match your user token. " +
                "Please try creating your wallet again - a fresh encryption key will be generated."
              );
            } else {
              // Provide more detailed error message
              const errorMessage = executionError.message || 
                ((executionError as any).code ? `Error code: ${(executionError as any).code}` : "Failed to complete challenge");
              setError(errorMessage);
            }
            
            onError(executionError);
            return;
          }

          console.log("Challenge completed successfully:", result);
          onSuccess(result);
        });
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
      // Cleanup SDK if needed
      if (sdkRef.current) {
        try {
          sdkRef.current = null;
        } catch (e) {
          console.warn("SDK cleanup warning:", e);
        }
      }
    };
  }, [appId, challengeId, userToken, encryptionKey, onSuccess, onError]);

  if (error) {
    return (
      <div className="p-6 bg-graphite/20 border border-graphite/50 rounded-lg">
        <h3 className="text-lg font-semibold text-aurora mb-2">
          ❌ Error Setting Up Wallet
        </h3>
        <p className="text-soft-mist/70">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-graphite/20 border border-graphite/50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-aurora"></div>
          <p className="text-soft-mist/70">Loading Circle Security Widget...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="circle-pin-widget-container bg-carbon rounded-lg"
      style={{ minHeight: "400px", width: "100%" }}
    >
      {/* Circle SDK will inject the widget here */}
      <div 
        id="w3s-widget-container" 
        className="w3s-widget-container"
        style={{ width: "100%", minHeight: "400px" }}
      />
    </div>
  );
}

