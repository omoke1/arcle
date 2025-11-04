"use client";

import { cn } from "@/lib/utils";

interface ArcleLogoProps {
  className?: string;
  size?: number;
}

export function ArcleLogo({ className, size = 24 }: ArcleLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-white", className)}
    >
      {/* Wallet/Card shape - modern rounded rectangle */}
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      {/* Wallet flap/bottom section */}
      <rect
        x="4"
        y="14"
        width="16"
        height="4"
        rx="0 0 2.5 2.5"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* AI/Sparkle indicators - modern design */}
      <circle cx="12" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      {/* Connection lines representing AI/network */}
      <path
        d="M12 10l2.5 2.5M12 10L9.5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arc indicator - subtle curve */}
      <path
        d="M6 10h12"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.5"
      />
    </svg>
  );
}

