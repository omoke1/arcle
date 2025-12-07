"use client";

import { ArcleLogoIcon } from "@/components/ui/ArcleLogoIcon";

interface WelcomeScreenProps {
  userName?: string;
  onStartChat?: () => void;
}

export function WelcomeScreen({ userName, onStartChat }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center px-4 sm:px-6 bg-carbon">
      {/* Logo Icon - Centered at top */}
      <div className="mb-6 sm:mb-8">
        <div className="flex justify-center">
          <ArcleLogoIcon size={160} />
        </div>
      </div>

      {/* Greeting Text - Below logo */}
      <div className="text-center w-full max-w-2xl">
        <p className="text-base sm:text-lg md:text-xl text-soft-mist/70">
          What do you have me do today?
        </p>
      </div>
    </div>
  );
}

