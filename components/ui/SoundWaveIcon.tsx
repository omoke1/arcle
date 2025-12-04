"use client";

interface SoundWaveIconProps {
  className?: string;
  size?: number;
}

export function SoundWaveIcon({ className, size = 16 }: SoundWaveIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Sound wave bars - varying heights */}
      <rect x="2" y="8" width="1.5" height="4" fill="currentColor" rx="0.75" />
      <rect x="5" y="6" width="1.5" height="8" fill="currentColor" rx="0.75" />
      <rect x="8" y="4" width="1.5" height="12" fill="currentColor" rx="0.75" />
      <rect x="11" y="7" width="1.5" height="6" fill="currentColor" rx="0.75" />
    </svg>
  );
}

