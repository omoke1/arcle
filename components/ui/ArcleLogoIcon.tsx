"use client";

import { cn } from "@/lib/utils";

interface ArcleLogoIconProps {
  className?: string;
  size?: number;
}

/**
 * Arcle Logo Icon
 * Rounded square with stylized "A" letter inside
 * - Background: Aurora Lime (#E9F28E)
 * - Letter: Carbon (#0D0D0C)
 * 
 * The "A" consists of:
 * - Triangle top (isosceles triangle, apex pointing up)
 * - Arch bottom (inverted U with vertical segments and concave curve)
 * - Gap between them creating the crossbar
 */
export function ArcleLogoIcon({ className, size = 48 }: ArcleLogoIconProps) {
  return (
    <div 
      className={cn(
        "rounded-xl bg-aurora flex items-center justify-center flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg 
        width={size * 0.7} 
        height={size * 0.7} 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-carbon"
      >
        {/* Stylized A - Triangle top (isosceles triangle, apex pointing up) */}
        <path 
          d="M12 2L4 12H20L12 2Z" 
          fill="currentColor"
        />
        {/* Stylized A - Arch bottom (left vertical segment, curved bottom, right vertical segment) */}
        <path 
          d="M5 12.5L5 20H4L4 12.5L5 12.5ZM5 12.5C5.8 13.3 6.8 14.3 7.8 15.3C8.8 16.3 9.8 17.3 10.8 18.3C11.5 19 12 19.5 12 19.5C12 19.5 12.5 19 13.2 18.3C14.2 17.3 15.2 16.3 16.2 15.3C17.2 14.3 18.2 13.3 19 12.5L20 12.5L20 20H19L19 12.5C18.2 13.3 17.2 14.3 16.2 15.3C15.2 16.3 14.2 17.3 13.2 18.3C12.5 19 12 19.5 12 19.5C12 19.5 11.5 19 10.8 18.3C9.8 17.3 8.8 16.3 7.8 15.3C6.8 14.3 5.8 13.3 5 12.5Z" 
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
