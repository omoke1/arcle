"use client";

import { cn } from "@/lib/utils";

interface ArcleLogoIconProps {
  className?: string;
  size?: number;
}

/**
 * Arcle Logo Icon
 * Uses the actual SVG logo from public/assets/logos/arcle.svg
 * The SVG contains its own styling and background
 */
export function ArcleLogoIcon({ className, size = 48 }: ArcleLogoIconProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-center flex-shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src="/assets/logos/arcle.svg"
        alt="Arcle Logo"
        className="object-contain"
        style={{ 
          width: `${size}px`,
          height: `${size}px`,
          display: 'block',
        }}
        onError={(e) => {
          console.error('Failed to load logo:', e);
        }}
      />
    </div>
  );
}
