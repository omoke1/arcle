"use client";

import { cn } from "@/lib/utils";

interface AnonymousMaskIconProps {
  className?: string;
  size?: number;
}

export function AnonymousMaskIcon({ className, size = 24 }: AnonymousMaskIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-white", className)}
    >
      {/* Anonymous mask icon - Material Outlined style from Icons8 */}
      {/* Face outline */}
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Mask covering lower face */}
      <path
        d="M7 13c0-2.76 2.24-5 5-5s5 2.24 5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Eyes visible through mask */}
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="14" cy="10" r="1.5" fill="currentColor" />
      {/* Mask straps */}
      <path
        d="M8 6l-2-2M16 6l2-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

