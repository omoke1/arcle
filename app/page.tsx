"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BorderBeamDemo } from "@/components/ui/border-beam-demo";

export default function Home() {
  const router = useRouter();
  const [startVisible, setStartVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Navigate to chat; wallet will be created in-chat now
  const handleEnter = () => {
    setIsCreating(true);
    router.push("/chat");
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

  // Auto-login: Check if wallet exists and redirect to chat
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWalletId = localStorage.getItem('arcle_wallet_id');
      const storedWalletAddress = localStorage.getItem('arcle_wallet_address');
      
      if (storedWalletId && storedWalletAddress) {
        // Wallet exists, auto-login by redirecting to chat
        router.push("/chat");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-onyx text-white flex flex-col items-center justify-center px-4 py-12">
      {/* BorderBeam Showcase */}
      <div className={`w-full max-w-5xl mb-10 transition-all duration-1500 ease-out ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <BorderBeamDemo />
      </div>

      {/* Launch CTA */}
      <div className={`transition-all duration-1500 ease-out ${startVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button 
          onClick={handleEnter}
          disabled={isCreating}
          className="
            text-white text-lg md:text-xl tracking-[0.12em] uppercase font-extralight
            transition-all duration-700
            hover:tracking-[0.18em]
            hover:text-white/80
            disabled:opacity-50 disabled:cursor-not-allowed
            px-6 py-3
            border border-white/20 rounded-lg
            hover:border-white/40
            hover:bg-white/10
            backdrop-blur-sm
            flex items-center gap-3
          "
        >
          {isCreating ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Launching…</span>
            </>
          ) : (
            "Launch App"
          )}
        </button>
      </div>
    </div>
  );
}
