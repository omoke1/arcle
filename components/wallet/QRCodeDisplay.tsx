"use client";

import { useState } from "react";
import { Copy, Check, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arcUtils } from "@/lib/arc";
import dynamic from "next/dynamic";

// Dynamically import QR code to avoid SSR issues
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  { 
    ssr: false,
    loading: () => <div className="w-[200px] h-[200px] bg-gray-100 animate-pulse rounded" />
  }
) as any; // Type assertion for dynamic import

interface QRCodeDisplayProps {
  address: string;
  label?: string;
  className?: string;
}

export function QRCodeDisplay({
  address,
  label = "Wallet Address",
  className,
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={`bg-dark-grey rounded-2xl p-6 border border-casper/20 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">{label}</h3>

      {/* QR Code */}
      <div className="bg-white rounded-xl p-8 mb-4 flex items-center justify-center">
        <QRCodeSVG
          value={address}
          size={200}
          level="H"
          includeMargin={true}
          fgColor="#111111"
          bgColor="#FFFFFF"
        />
      </div>

      {/* Address */}
      <div className="bg-onyx rounded-xl p-4 mb-4">
        <p className="text-xs text-casper mb-2">Address</p>
        <p className="text-sm text-white font-mono break-all">{address}</p>
      </div>

      {/* Copy Button */}
      <Button
        onClick={handleCopy}
        variant="secondary"
        className="w-full"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 mr-2" />
            Copy Address
          </>
        )}
      </Button>

      {/* Formatted Address for Display */}
      <p className="text-xs text-casper text-center mt-3">
        {arcUtils.formatAddress(address)}
      </p>
      
      {/* Receive Instructions */}
      <div className="mt-4 pt-4 border-t border-casper/20">
        <p className="text-xs text-casper text-center">
          Share this QR code or address to receive USDC on Arc network
        </p>
      </div>
    </div>
  );
}

