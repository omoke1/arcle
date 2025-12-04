"use client";

import { cn } from "@/lib/utils";

interface SplitViewIconProps {
  className?: string;
  size?: number;
}

/**
 * Split View Icon
 * Rounded square with inner square divided by vertical line
 * - Background: Aurora lime with border
 * - Icon: Carbon color
 */
export function SplitViewIcon({ className, size = 40 }: SplitViewIconProps) {
  return (
    <div 
      className={cn(
        "rounded-xl bg-aurora/10 border border-aurora/30 flex items-center justify-center flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size * 0.6} 
        height={size * 0.6} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-aurora"
      >
        {/* Outer rounded square */}
        <rect 
          x="3" 
          y="3" 
          width="18" 
          height="18" 
          rx="3" 
          stroke="currentColor" 
          strokeWidth="1.5"
          fill="none"
        />
        {/* Inner square */}
        <rect 
          x="6" 
          y="6" 
          width="12" 
          height="12" 
          rx="1" 
          stroke="currentColor" 
          strokeWidth="1.5"
          fill="none"
        />
        {/* Vertical divider line (left section wider) */}
        <line 
          x1="10" 
          y1="6" 
          x2="10" 
          y2="18" 
          stroke="currentColor" 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

