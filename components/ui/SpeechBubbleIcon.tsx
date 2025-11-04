"use client";

import { cn } from "@/lib/utils";

interface SpeechBubbleIconProps {
  className?: string;
  size?: number;
}

export function SpeechBubbleIcon({ className, size = 24 }: SpeechBubbleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Speech Bubble Icon - iOS 17 Outlined style from Icons8 */}
      <path
        d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

