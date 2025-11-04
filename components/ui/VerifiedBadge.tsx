"use client";

import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
  variant?: "light" | "dark";
}

export function VerifiedBadge({ className, size = 16, variant = "dark" }: VerifiedBadgeProps) {
  const isDark = variant === "dark";
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Verified Badge - based on Icons8 verified badge */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={isDark ? "#111111" : "#FFFFFF"}
        className={className}
      />
      <path
        d="M8 12l2 2 4-4"
        stroke={isDark ? "#FFFFFF" : "#111111"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

