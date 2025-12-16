"use client";

import { useState, useEffect } from "react";
import * as React from "react";
import {
  History,
  Wallet,
  CalendarDays,
  Search,
  Settings,
  HelpCircle,
  LogOut,
  X,
  Columns2,
  PanelLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { TransactionHistoryPage } from "./TransactionHistoryPage";
import { WalletSettingsPage } from "./WalletSettingsPage";
import { SchedulesPage } from "./SchedulesPage";
import { ScanReportsPage } from "./ScanReportsPage";
import { SettingsPage } from "./SettingsPage";
import { HelpPage } from "./HelpPage";
import { ArcleLogoIcon } from "@/components/ui/ArcleLogoIcon";
import { SplitViewIcon } from "@/components/ui/SplitViewIcon";

type SidebarView = "main" | "transaction-history" | "wallet" | "schedules" | "scan-reports" | "settings" | "profile" | "help";

interface AppSidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
  onNewChat?: () => void;
  walletId?: string | null;
  walletAddress?: string | null;
  userId?: string | null;
  onLogout?: () => void;
  onWalletCreated?: (walletId: string, walletAddress: string) => void;
  isMobile?: boolean;
  initialView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
}

export function AppSidebar({
  isOpen = true,
  onToggle,
  onNewChat,
  walletId,
  walletAddress,
  userId,
  onLogout,
  onWalletCreated,
  isMobile = false,
  initialView = "main",
  onViewChange,
}: AppSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [currentView, setCurrentView] = useState<SidebarView>(initialView);

  // Update view when initialView prop changes
  useEffect(() => {
    if (initialView !== currentView) {
      setCurrentView(initialView);
    }
  }, [initialView, currentView]);

  // Notify parent of view changes
  useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);

  const handleItemClick = (callback?: () => void) => {
    if (callback) {
      callback();
    }
    // Close sidebar on mobile after clicking an item
    if (isMobile && onToggle) {
      onToggle();
    }
  };

  return (
    <>
      {/* Sidebar - Responsive */}
      <aside
        className={cn(
          "bg-carbon border-r border-graphite/30 flex flex-col h-full transition-all duration-300 ease-in-out group",
          // Mobile: Fixed overlay, Desktop: Inline
          isMobile
            ? "fixed left-0 top-0 z-[60] h-screen"
            : "relative",
          // Width based on open state
          isOpen
            ? isMobile ? "w-64 translate-x-0" : "w-64"
            : isMobile ? "-translate-x-full w-64" : "w-16"
        )}
      >
        {/* Logo - Only show on main view, left aligned, shows split icon on hover when collapsed */}
        {currentView === "main" && (
          <div className="p-4 border-b border-carbon flex-shrink-0 flex items-center justify-between transition-all duration-300 relative w-full">
            {/* When collapsed: Show toggle icon button */}
            {!isOpen ? (
              <button
                onClick={onToggle}
                className="w-full flex items-center justify-center transition-all duration-300 relative cursor-pointer hover:bg-graphite/50 rounded-lg p-2 group"
                aria-label="Open sidebar"
              >
                {/* Toggle icon - Always visible when collapsed */}
                <PanelLeft className="w-5 h-5 text-signal-white transition-transform duration-200 rotate-180" />
              </button>
            ) : (
              <>
                {/* When expanded: Show logo */}
                <div className={cn(
                  "transition-opacity duration-300 flex items-center justify-start"
                )}>
                  <ArcleLogoIcon size={96} />
                </div>
                {/* Collapse Button - Top right of sidebar when expanded */}
                {onToggle && (
                  <button
                    onClick={onToggle}
                    className="p-1.5 rounded-lg text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50 transition-colors flex items-center"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeft className="w-4 h-4 transition-transform duration-200" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Navigation Sections */}
        {currentView === "main" ? (
          <>
            <div className={cn(
              "flex-1 overflow-y-auto py-4 space-y-1",
              isOpen ? "px-4" : "px-2"
            )}>
              {/* Navigation Items - Always visible */}
              <div className="mb-4">
                <div className="space-y-1">
                  {walletId && (
                    <SidebarItem
                      icon={History}
                      label="Transaction History"
                      onClick={() => handleItemClick(() => setCurrentView("transaction-history"))}
                      isCollapsed={!isOpen}
                    />
                  )}
                  {walletId && (
                    <SidebarItem
                      icon={Wallet}
                      label="Wallet Settings"
                      onClick={() => handleItemClick(() => setCurrentView("wallet"))}
                      isCollapsed={!isOpen}
                    />
                  )}
                  <SidebarItem
                    icon={CalendarDays}
                    label="Schedules"
                    onClick={() => handleItemClick(() => setCurrentView("schedules"))}
                    isCollapsed={!isOpen}
                  />
                  <SidebarItem
                    icon={Search}
                    label="Scan Reports"
                    onClick={() => handleItemClick(() => setCurrentView("scan-reports"))}
                    isCollapsed={!isOpen}
                  />
                </div>
              </div>

              {/* Settings & Help Section - Always visible */}
              <div>
                <h3 className={cn(
                  "text-xs font-semibold text-soft-mist/50 uppercase tracking-wider mb-2 px-2",
                  !isOpen && "hidden"
                )}>
                  Settings & Help
                </h3>
                <div className="space-y-1">
                  <SidebarItem
                    icon={Settings}
                    label="Settings"
                    onClick={() => handleItemClick(() => setCurrentView("settings"))}
                    isCollapsed={!isOpen}
                  />
                  <SidebarItem
                    icon={HelpCircle}
                    label="Help & Support"
                    onClick={() => handleItemClick(() => setCurrentView("help"))}
                    isCollapsed={!isOpen}
                  />
                </div>
              </div>
            </div>

            {/* User Profile - Only show on main view */}
            <div className="p-4 border-t border-graphite/30 flex-shrink-0">
              <div className={cn(
                "flex items-center gap-3 mb-2",
                !isOpen && "justify-center"
              )}>
                <div className="w-8 h-8 rounded-full bg-aurora/20 border border-aurora/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-aurora">U</span>
                </div>
                {isOpen && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-signal-white truncate">User</p>
                      <p className="text-xs text-soft-mist/60 truncate">user@arcle.com</p>
                    </div>
                    {onLogout && (
                      <button
                        onClick={() => {
                          onLogout();
                        }}
                        className="p-1 rounded hover:bg-graphite/50 text-soft-mist/70 hover:text-signal-white transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : currentView === "transaction-history" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <TransactionHistoryPage
              onBack={() => setCurrentView("main")}
              walletId={walletId}
              walletAddress={walletAddress}
            />
          </div>
        ) : currentView === "wallet" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <WalletSettingsPage
              onBack={() => setCurrentView("main")}
              walletAddress={walletAddress}
              walletId={walletId}
              onCreateWallet={() => { }}
              onViewPermissions={() => { }}
            />
          </div>
        ) : currentView === "schedules" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SchedulesPage
              onBack={() => setCurrentView("main")}
              userId={userId}
            />
          </div>
        ) : currentView === "scan-reports" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScanReportsPage
              onBack={() => setCurrentView("main")}
            />
          </div>
        ) : currentView === "settings" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SettingsPage
              onBack={() => setCurrentView("main")}
              onLogout={onLogout}
            />
          </div>
        ) : currentView === "profile" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <SettingsPage
              onBack={() => setCurrentView("main")}
              onLogout={onLogout}
              showProfileOnMount={true}
            />
          </div>
        ) : currentView === "help" ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <HelpPage
              onBack={() => setCurrentView("main")}
            />
          </div>
        ) : null}

      </aside>

      {/* Mobile Sidebar - Slide Out (for mobile devices) */}
      <Sidebar
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        walletId={walletId}
        walletAddress={walletAddress}
        userId={userId}
        onLogout={onLogout}
        onWalletCreated={onWalletCreated}
      />
    </>
  );
}

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  badge?: string;
  onClick?: () => void;
  isCollapsed?: boolean;
}

function SidebarItem({ icon: Icon, label, active, badge, onClick, isCollapsed = false }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
        isCollapsed && "justify-center px-2",
        active
          ? "bg-aurora/20 text-aurora border border-aurora/30"
          : "text-soft-mist/70 hover:text-signal-white hover:bg-graphite/50"
      )}
      title={isCollapsed ? label : undefined}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {!isCollapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && (
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-aurora text-carbon rounded">
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

