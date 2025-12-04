"use client";

import Image from "next/image";

interface WelcomeScreenProps {
  userName?: string;
  onStartChat?: () => void;
}

export function WelcomeScreen({ userName, onStartChat }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center px-4 sm:px-6 bg-carbon">
      {/* Logo Image - Centered at top */}
      <div className="mb-6 sm:mb-8">
        <div className="relative w-[84px] h-[84px] mx-auto">
          <Image
            src="/logo.png"
            alt="ARCLE Logo"
            width={84}
            height={84}
            className="object-contain w-full h-full"
            priority
            unoptimized
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
            onError={(e) => {
              // Fallback if image doesn't exist - hide the broken image
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
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

