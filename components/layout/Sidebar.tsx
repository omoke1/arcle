"use client";

import { useState, useEffect } from "react";
import { X, History, Settings, Wallet, HelpCircle, LogOut, Plus, CalendarDays, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import { SettingsPage } from "./SettingsPage";
import { WalletSettingsPage } from "./WalletSettingsPage";
import { HelpPage } from "./HelpPage";
import { CreateWalletPage } from "./CreateWalletPage";
import { CreateSubAccountPage } from "./CreateSubAccountPage";
import { BotPermissionsPage } from "./BotPermissionsPage";
import { SchedulesPage } from "./SchedulesPage";
import { ScanReportsPage } from "./ScanReportsPage";
import { TransactionHistoryPage } from "./TransactionHistoryPage";

type SidebarView = "main" | "settings" | "wallet" | "help" | "create-wallet" | "create-subaccount" | "permissions" | "schedules" | "scan-reports" | "transaction-history";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  walletId?: string | null;
  walletAddress?: string | null;
  onLogout?: () => void;
  onWalletCreated?: (walletId: string, walletAddress: string) => void;
  openView?: SidebarView;
}

export function Sidebar({ isOpen, onClose, walletId, walletAddress, onLogout, onWalletCreated, openView }: SidebarProps) {
  const [currentView, setCurrentView] = useState<SidebarView>("main");
  const [newWalletId, setNewWalletId] = useState<string | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editingWalletAddress, setEditingWalletAddress] = useState<string | null>(null);

  // Reset view when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView("main");
      setNewWalletId(null);
      setNewWalletAddress(null);
      setEditingWalletId(null);
      setEditingWalletAddress(null);
    }
  }, [isOpen]);

  // If a specific view is requested when opening, navigate there
  useEffect(() => {
    if (isOpen && openView) {
      setCurrentView(openView);
    }
  }, [isOpen, openView]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBack = () => {
    if (currentView === "permissions") {
      // If going back from permissions, check if we're editing or creating
      if (editingWalletId) {
        // If editing, go back to wallet settings
        setEditingWalletId(null);
        setEditingWalletAddress(null);
        setCurrentView("wallet");
      } else if (newWalletId) {
        // If creating new sub-account, go back to create-subaccount
        setCurrentView("create-subaccount");
      } else {
        // If creating new wallet, go back to create wallet
        setCurrentView("create-wallet");
      }
    } else if (currentView === "create-subaccount") {
      setCurrentView("wallet");
    } else {
      setCurrentView("main");
    }
  };

  const handleWalletCreated = (walletId: string, walletAddress: string) => {
    setNewWalletId(walletId);
    setNewWalletAddress(walletAddress);
    setCurrentView("permissions");
  };

  const handlePermissionsComplete = () => {
    if (newWalletId && newWalletAddress && onWalletCreated) {
      onWalletCreated(newWalletId, newWalletAddress);
    }
    setCurrentView("main");
    setNewWalletId(null);
    setNewWalletAddress(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-[75vw] max-w-sm bg-dark-grey z-[70]",
          "flex flex-col shadow-2xl border-r border-dark-grey/50",
          "transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {currentView === "main" ? (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">ARCLE</h1>
              <button
                onClick={onClose}
                className="text-casper hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Sections */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-hide">
              {/* Menu Items */}
              {walletId && (
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                  onClick={() => setCurrentView("transaction-history")}
                >
                  <History className="w-5 h-5 text-casper" />
                  <span className="text-sm font-medium">Transaction History</span>
                </button>
              )}

              {walletId && (
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                  onClick={() => setCurrentView("wallet")}
                >
                  <Wallet className="w-5 h-5 text-casper" />
                  <span className="text-sm font-medium">Wallet Settings</span>
                </button>
              )}

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                onClick={() => setCurrentView("schedules")}
              >
                <CalendarDays className="w-5 h-5 text-casper" />
                <span className="text-sm font-medium">Schedules</span>
              </button>

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                onClick={() => setCurrentView("scan-reports")}
              >
                <Search className="w-5 h-5 text-casper" />
                <span className="text-sm font-medium">Scan Reports</span>
              </button>

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                onClick={() => setCurrentView("settings")}
              >
                <Settings className="w-5 h-5 text-casper" />
                <span className="text-sm font-medium">Settings</span>
              </button>

              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-onyx transition-colors text-left"
                onClick={() => setCurrentView("help")}
              >
                <HelpCircle className="w-5 h-5 text-casper" />
                <span className="text-sm font-medium">Help & Support</span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-4 py-4 border-t border-dark-grey/50">
              {onLogout && (
                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-casper hover:bg-onyx hover:text-white transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Log Out</span>
                </button>
              )}
            </div>
          </>
        ) : currentView === "settings" ? (
          <SettingsPage onBack={handleBack} onLogout={onLogout} />
        ) : currentView === "wallet" ? (
          <WalletSettingsPage 
            onBack={handleBack} 
            walletAddress={walletAddress}
            walletId={walletId}
            onCreateWallet={() => setCurrentView("create-subaccount")}
            onViewPermissions={() => {
              // Navigate to permissions page with existing wallet
              if (walletId && walletAddress) {
                setEditingWalletId(walletId);
                setEditingWalletAddress(walletAddress);
                setCurrentView("permissions");
              }
            }}
          />
        ) : currentView === "help" ? (
          <HelpPage onBack={handleBack} />
        ) : currentView === "create-wallet" ? (
          <CreateWalletPage 
            onBack={handleBack} 
            onWalletCreated={handleWalletCreated}
          />
        ) : currentView === "create-subaccount" && walletId && walletAddress ? (
          <CreateSubAccountPage
            onBack={handleBack}
            masterWalletId={walletId}
            masterAddress={walletAddress}
            onSubAccountCreated={(subAccountId, subWalletId, subAddress) => {
              // Navigate to permissions for sub-account
              setNewWalletId(subWalletId);
              setNewWalletAddress(subAddress);
              setCurrentView("permissions");
            }}
          />
        ) : currentView === "permissions" && (newWalletId && newWalletAddress || editingWalletId && editingWalletAddress) ? (
          <BotPermissionsPage
            onBack={handleBack}
            onComplete={newWalletId ? handlePermissionsComplete : undefined}
            walletId={newWalletId || editingWalletId!}
            walletAddress={newWalletAddress || editingWalletAddress!}
            isEditing={!!editingWalletId}
          />
        ) : currentView === "schedules" ? (
          <SchedulesPage onBack={handleBack} />
        ) : currentView === "scan-reports" ? (
          <ScanReportsPage onBack={handleBack} />
        ) : currentView === "transaction-history" ? (
          <TransactionHistoryPage 
            onBack={handleBack} 
            walletId={walletId}
            walletAddress={walletAddress}
          />
        ) : null}
      </aside>
    </>
  );
}

