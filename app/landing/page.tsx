"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpiralAnimation } from "@/components/ui/spiral-animation";
import { Sparkles } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [startVisible, setStartVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Handle navigation to main app
  const handleEnter = () => {
    router.push("/");
  };

  // Fade in the start button after animation loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartVisible(true);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  // Show content after initial animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-onyx">
      {/* Spiral Animation Background */}
      <div className="absolute inset-0">
        <SpiralAnimation />
      </div>
      
      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        {/* ARCLE Logo and Title */}
        <div 
          className={`
            text-center space-y-6 mb-12
            transition-all duration-1500 ease-out
            ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-12 h-12 text-rich-blue" />
            <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight">
              ARCLE
            </h1>
          </div>
          <h2 className="text-2xl md:text-3xl font-light text-white/90 tracking-wide">
            Your AI-Powered Blockchain Wallet
          </h2>
          <p className="text-casper text-lg max-w-md mx-auto">
            Chat with AI to manage your wallet on Arc network
          </p>
        </div>

        {/* Enter Button */}
        <div 
          className={`
            transition-all duration-1500 ease-out
            ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}
        >
          <button 
            onClick={handleEnter}
            className="
              text-white text-2xl md:text-3xl tracking-[0.2em] uppercase font-extralight
              transition-all duration-700
              hover:tracking-[0.3em] 
              hover:text-rich-blue
              animate-pulse
              px-8 py-4
              border border-white/20 rounded-xl
              hover:border-rich-blue/50
              hover:bg-rich-blue/10
              backdrop-blur-sm
            "
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}

