"use client";

import { Sun, Moon, Bell, User, ChevronDown, Settings, LogOut, Menu } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Layers2 } from "@/components/animate-ui/icons/layers-2";
import FloatingActionMenu from "@/components/ui/floating-action-menu";
import { QuickActionsSheet } from "./QuickActionsSheet";
import { ActivityDropdown } from "@/components/ui/activity-dropdown";
import { TierSelector, AgentTier } from "@/components/ui/TierSelector";
import { useSettings } from "@/lib/settings/use-settings";

interface TopBarProps {
  balance?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onSend?: () => void;
  onReceive?: () => void;
  onBridge?: () => void;
  onPay?: () => void;
  onYield?: () => void;
  onWithdraw?: () => void;
  onScan?: () => void;
  onSchedule?: () => void;
  userId?: string;
  selectedTier?: AgentTier;
  onTierChange?: (tier: AgentTier) => void;
  onLogout?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
}

export function TopBar({ 
  balance, 
  onToggleSidebar, 
  isSidebarOpen = true,
  onSend,
  onReceive,
  onBridge,
  onPay,
  onYield,
  onWithdraw,
  onScan,
  onSchedule,
  userId,
  selectedTier = "basic",
  onTierChange,
  onLogout,
  onSettings,
  onProfile,
}: TopBarProps) {
  const { settings, updateTheme } = useSettings(userId);
  const isDark = useMemo(
    () => settings.theme === "dark",
    [settings.theme]
  );
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  const handleTemplateClick = () => {
    setIsQuickActionsOpen(true);
  };

  return (
    <div className="h-14 md:h-16 bg-carbon border-b border-carbon flex items-center justify-between px-3 md:px-6">
      {/* Left: Mobile Menu Button + Tier Selector */}
      <div className="flex items-center gap-2 md:gap-3 h-full">
        {/* Mobile Menu Button - Only show on mobile */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden w-10 h-10 rounded-xl bg-graphite/80 text-signal-white hover:bg-graphite/60 transition-colors flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.35)] border border-graphite/50"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
          </button>
        )}
        {/* Tier Selector - Positioned like ChatGPT dropdown */}
        {onTierChange && (
          <div className="flex items-center h-full">
            <TierSelector selectedTier={selectedTier} onTierChange={onTierChange} />
          </div>
        )}
      </div>

      {/* Right: User Controls */}
      <div className="flex items-center gap-1.5 md:gap-3 h-full">
        {/* Theme Toggle - Hidden on mobile */}
        <button
          onClick={() => updateTheme(isDark ? "light" : "dark")}
          className="hidden md:flex p-2 rounded-lg text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50 transition-colors items-center"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications */}
        <div className="flex items-center h-full">
          <ActivityDropdown userId={userId} />
        </div>

        {/* Layers-2 Icon - Template Menu */}
        <button 
          onClick={handleTemplateClick}
          className={cn(
            "p-2 rounded-lg transition-colors flex items-center",
            isQuickActionsOpen 
              ? "text-signal-white bg-graphite/70" 
              : "text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50"
          )}
          aria-label="Templates"
        >
          <Layers2 size={20} className="text-current" />
        </button>

        {/* User Avatar / Profile Menu Trigger */}
        <div className="relative">
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="p-0.5 md:p-1 rounded-full hover:bg-graphite/50 transition-colors flex items-center gap-1 h-full"
            aria-label="Profile menu"
          >
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-aurora/20 border border-aurora/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-aurora" />
            </div>
            <ChevronDown className={cn(
              "w-3 h-3 md:w-4 md:h-4 text-soft-mist/70 hidden sm:block transition-transform",
              isProfileMenuOpen && "rotate-180"
            )} />
          </button>

          {/* Floating Action Menu for Profile */}
          <FloatingActionMenu
            isOpen={isProfileMenuOpen}
            onClose={() => setIsProfileMenuOpen(false)}
            showToggleButton={false}
            className="absolute top-full right-0 mt-2"
            options={[
              {
                label: "Account",
                Icon: <User className="w-4 h-4" />,
                onClick: () => {
                  if (onProfile) onProfile();
                },
              },
              {
                label: "Settings",
                Icon: <Settings className="w-4 h-4" />,
                onClick: () => {
                  if (onSettings) onSettings();
                },
              },
              {
                label: "Logout",
                Icon: <LogOut className="w-4 h-4" />,
                onClick: () => {
                  if (onLogout) onLogout();
                },
              },
            ]}
          />
        </div>
      </div>

      {/* Quick Actions Bottom Sheet - Shows balance and quick actions */}
      <QuickActionsSheet
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        balance={balance || "0.00"}
        onSend={onSend}
        onReceive={onReceive}
        onBridge={onBridge}
        onPay={onPay}
        onYield={onYield}
        onWithdraw={onWithdraw}
        onScan={onScan}
        onSchedule={onSchedule}
      />
    </div>
  );
}

