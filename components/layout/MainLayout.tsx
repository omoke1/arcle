"use client";

import { ReactNode, useState, useEffect } from "react";
import { TopBar } from "./TopBar";
import { AppSidebar } from "./AppSidebar";
import { AgentTier } from "@/components/ui/TierSelector";

interface MainLayoutProps {
  children: ReactNode;
  balance?: string;
  walletId?: string | null;
  walletAddress?: string | null;
  userId?: string | null;
  onNewChat?: () => void;
  onLogout?: () => void;
  onWalletCreated?: (walletId: string, walletAddress: string) => void;
  onSend?: () => void;
  onReceive?: () => void;
  onBridge?: () => void;
  onPay?: () => void;
  onYield?: () => void;
  onWithdraw?: () => void;
  onScan?: () => void;
  onSchedule?: () => void;
  selectedTier?: AgentTier;
  onTierChange?: (tier: AgentTier) => void;
}

export function MainLayout({
  children,
  balance,
  walletId,
  walletAddress,
  userId,
  onNewChat,
  onLogout,
  onWalletCreated,
  onSend,
  onReceive,
  onBridge,
  onPay,
  onYield,
  onWithdraw,
  onScan,
  onSchedule,
  selectedTier = "basic",
  onTierChange,
}: MainLayoutProps) {
  // Always start with false to avoid hydration mismatch
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarView, setSidebarView] = useState<"main" | "transaction-history" | "wallet" | "schedules" | "scan-reports" | "settings" | "profile" | "help">("main");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load sidebar state from localStorage after hydration
  useEffect(() => {
    setIsHydrated(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarOpen");
      if (saved === "true") {
        setIsSidebarOpen(true);
      }
    }
  }, []);

  // Detect mobile (but don't auto-toggle sidebar)
  useEffect(() => {
    if (!isHydrated) return;
    
    const checkMobile = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      // Don't auto-toggle sidebar - only detect mobile state
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [isHydrated]);

  // Persist sidebar state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebarOpen", String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleOpenSettings = () => {
    setSidebarView("settings");
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  const handleOpenProfile = () => {
    // Open profile view directly
    setSidebarView("profile");
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
    }
  };

  return (
    <div className="flex h-screen bg-carbon overflow-hidden">
      {/* Mobile Overlay - Show when sidebar is open on mobile */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-carbon/80 z-40 md:hidden"
          onClick={handleToggleSidebar}
        />
      )}

      {/* Left Sidebar */}
      <AppSidebar
        isOpen={isSidebarOpen}
        onToggle={handleToggleSidebar}
        onNewChat={onNewChat}
        walletId={walletId}
        walletAddress={walletAddress}
        userId={userId}
        onLogout={onLogout}
        onWalletCreated={onWalletCreated}
        isMobile={isMobile}
        initialView={sidebarView}
        onViewChange={setSidebarView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Top Bar */}
        <TopBar 
          balance={balance}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onSend={onSend}
          onReceive={onReceive}
          onBridge={onBridge}
          onPay={onPay}
          onYield={onYield}
          onWithdraw={onWithdraw}
          onScan={onScan}
          onSchedule={onSchedule}
          userId={userId || undefined}
          selectedTier={selectedTier}
          onTierChange={onTierChange}
          onLogout={onLogout}
          onSettings={handleOpenSettings}
          onProfile={handleOpenProfile}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-hidden w-full">
          {children}
        </div>
      </div>
    </div>
  );
}

