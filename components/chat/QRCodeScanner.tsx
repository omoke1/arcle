"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X, Camera, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Dynamic import for jsQR to handle CommonJS module
let jsQRFunction: any = null;
const loadJsQR = async () => {
  if (!jsQRFunction) {
    const jsQRModule = await import("jsqr");
    jsQRFunction = jsQRModule.default || jsQRModule;
  }
  return jsQRFunction;
};

// Check if QR code is a USDC address (Ethereum-based chains)
const isUSDCAddress = (data: string): boolean => {
  // Ethereum addresses start with 0x and are 42 characters
  if (data.startsWith("0x") && data.length === 42) {
    return /^0x[a-fA-F0-9]{40}$/.test(data);
  }
  // Solana addresses are base58 encoded, typically 32-44 characters
  if (data.length >= 32 && data.length <= 44 && !data.includes("://")) {
    // Basic check - could be Solana address
    return /^[A-HJ-NP-Za-km-z1-9]+$/.test(data);
  }
  return false;
};

// Check if QR code is a payment link/request
const isFiatPayment = (data: string): boolean => {
  // Check for common payment QR code formats
  const paymentPatterns = [
    /^https?:\/\/.*(pay|payment|invoice|checkout)/i,
    /^upi:\/\//i, // UPI payment (India)
    /^bitcoin:/i,
    /^ethereum:/i,
    /^amount=/i,
    /^payment_request=/i,
  ];
  return paymentPatterns.some((pattern) => pattern.test(data));
};

// Parse QR code data
const parseQRCode = (data: string) => {
  const trimmed = data.trim();

  if (isUSDCAddress(trimmed)) {
    return {
      type: "usdc_address" as const,
      address: trimmed,
      rawData: data,
    };
  }

  if (isFiatPayment(trimmed)) {
    // Try to extract amount and currency from payment link
    const amountMatch = trimmed.match(/amount[=:]([\d.]+)/i);
    const currencyMatch = trimmed.match(/currency[=:]([A-Z]{3})/i);

    return {
      type: "fiat_payment" as const,
      amount: amountMatch?.[1],
      currency: currencyMatch?.[1] || "USD",
      rawData: data,
    };
  }

  return {
    type: "unknown" as const,
    rawData: data,
  };
};

interface QRCodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (data: {
    type: "usdc_address" | "fiat_payment" | "unknown";
    address?: string;
    amount?: string;
    currency?: string;
    rawData: string;
  }) => void;
}

/**
 * QR Code Scanner Component
 * Uses browser camera API to scan QR codes
 */
export function QRCodeScanner({ isOpen, onClose, onScan }: QRCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);



  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Start QR code scanning using canvas and image processing
  const startQRScanning = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return;

    // Set canvas size to match video
    const updateCanvasSize = () => {
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    // Load jsQR first, then start scanning
    loadJsQR().then((jsQR: any) => {
      // Scan for QR codes
      const scan = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          updateCanvasSize();
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

          // Use jsQR to detect QR code
          try {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });

            if (code) {
              // QR code detected!
              console.log("[QRScanner] QR code detected:", code.data);
              const parsed = parseQRCode(code.data);
              onScan(parsed);
              stopCamera();
              onClose();
            }
          } catch (err) {
            console.error("[QRScanner] Error scanning QR code:", err);
          }
        }
      };

      // Scan every 100ms
      scanIntervalRef.current = setInterval(scan, 100);
    }).catch((err: any) => {
      console.error("[QRScanner] Failed to load jsQR:", err);
      setError("Failed to load QR scanner. Please try again.");
      setIsScanning(false);
    });
  }, [onScan, onClose, stopCamera]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start scanning for QR codes
      startQRScanning();
    } catch (err: any) {
      console.error("[QRScanner] Camera error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access."
          : err.name === "NotFoundError"
            ? "No camera found on this device."
            : "Failed to access camera. Please try again."
      );
      setIsScanning(false);
    }
  }, [startQRScanning]);

  // Handle manual QR code input (fallback)
  const handleManualInput = () => {
    const input = prompt("Enter QR code data manually:");
    if (input) {
      const parsed = parseQRCode(input);
      onScan(parsed);
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-carbon/95 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-graphite rounded-xl border border-graphite/60 shadow-lg w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-signal-white">Scan QR Code</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Preview */}
        <div className="relative bg-carbon rounded-lg overflow-hidden mb-4 aspect-video">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <AlertCircle className="w-12 h-12 text-soft-mist/50 mb-3" />
              <p className="text-sm text-soft-mist/70 text-center">{error}</p>
              <button
                onClick={handleManualInput}
                className="mt-4 px-4 py-2 bg-aurora text-carbon rounded-lg text-sm font-medium hover:bg-aurora/90 transition-colors"
              >
                Enter Manually
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="border-2 border-aurora rounded-lg w-64 h-64">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-aurora" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-aurora" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-aurora" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-aurora" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-sm text-soft-mist/70 mb-2">
            Position the QR code within the frame
          </p>
          <button
            onClick={handleManualInput}
            className="text-xs text-aurora hover:text-aurora/80 underline"
          >
            Or enter QR code manually
          </button>
        </div>
      </div>
    </div>
  );
}

