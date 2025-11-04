"use client";

import { useState, useEffect } from "react";
import { X, History, Settings, Wallet, HelpCircle, LogOut, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import { SettingsPage } from "./SettingsPage";
import { WalletSettingsPage } from "./WalletSettingsPage";
import { HelpPage } from "./HelpPage";
import { CreateWalletPage } from "./CreateWalletPage";
import { BotPermissionsPage } from "./BotPermissionsPage";

type SidebarView = "main" | "settings" | "wallet" | "help" | "create-wallet" | "permissions";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  walletId?: string | null;
  walletAddress?: string | null;
  onLogout?: () => void;
  onWalletCreated?: (walletId: string, walletAddress: string) => void;
}

export function Sidebar({ isOpen, onClose, walletId, walletAddress, onLogout, onWalletCreated }: SidebarProps) {
  const [currentView, setCurrentView] = useState<SidebarView>("main");
  const [newWalletId, setNewWalletId] = useState<string | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(null);

  // Reset view when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView("main");
    }
  }, [isOpen]);

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
      // If going back from permissions, go to create wallet
      setCurrentView("create-wallet");
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
              {/* Transaction History Section */}
              <div>
                <div className="flex items-center gap-3 mb-3 px-2">
                  <History className="w-5 h-5 text-white" />
                  <h2 className="text-base font-semibold text-white">Transaction History</h2>
                </div>
                
                {walletId ? (
                  <div className="px-2">
                    <TransactionHistory walletId={walletId} limit={10} />
                  </div>
                ) : (
                  <p className="text-sm text-casper/70 px-2">
                    No wallet connected
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-dark-grey/50" />

              {/* More Options */}
              <div className="space-y-1">
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
            onCreateWallet={() => setCurrentView("create-wallet")}
          />
        ) : currentView === "help" ? (
          <HelpPage onBack={handleBack} />
        ) : currentView === "create-wallet" ? (
          <CreateWalletPage 
            onBack={handleBack} 
            onWalletCreated={handleWalletCreated}
          />
        ) : currentView === "permissions" && newWalletId && newWalletAddress ? (
          <BotPermissionsPage
            onBack={handleBack}
            onComplete={handlePermissionsComplete}
            walletId={newWalletId}
            walletAddress={newWalletAddress}
          />
        ) : null}
      </aside>
    </>
  );
}

