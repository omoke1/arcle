"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, User, Settings as SettingsIcon, Shield, LogOut, Bell, Moon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings/use-settings";
import { ProfileModal } from "@/components/modals/ProfileModal";
import { CapabilitiesModal } from "@/components/modals/CapabilitiesModal";
import { PermissionsModal } from "@/components/modals/PermissionsModal";
import { PrivacyModal } from "@/components/modals/PrivacyModal";

interface SettingsPageProps {
  onBack: () => void;
  onLogout?: () => void;
}

export function SettingsPage({ onBack, onLogout }: SettingsPageProps) {
  const {
    settings,
    updateEmail,
    updateDisplayName,
    updateTheme,
    toggleHapticFeedback,
    updateFeeLevel,
    toggleCapability,
    getEnabledCapabilitiesCount,
    toggleAutoApprove,
    toggleAnalytics,
    toggleErrorReporting,
  } = useSettings();

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCapabilitiesModal, setShowCapabilitiesModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Apply theme on mount and when theme changes
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [settings.theme]);

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(settings.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    updateTheme(nextTheme);
  };

  const getThemeLabel = () => {
    return settings.theme.charAt(0).toUpperCase() + settings.theme.slice(1);
  };

  const cycleFeeLevel = () => {
    const levels: Array<'LOW' | 'MEDIUM' | 'HIGH'> = ['LOW', 'MEDIUM', 'HIGH'];
    const currentIndex = levels.indexOf(settings.defaultFeeLevel);
    const nextLevel = levels[(currentIndex + 1) % levels.length];
    updateFeeLevel(nextLevel);
  };

  const getFeeLevelLabel = () => {
    const labels = {
      LOW: 'Low (Cheapest)',
      MEDIUM: 'Medium (Balanced)',
      HIGH: 'High (Fastest)',
    };
    return labels[settings.defaultFeeLevel];
  };

  return (
    <div className="flex flex-col h-full bg-dark-grey">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-grey/50 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-casper hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <div className="w-5" /> {/* Spacer for alignment */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Account Information */}
        <div className="bg-onyx rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-white text-sm">
            {settings.email || settings.displayName || 'Guest User'}
          </span>
          <span className="bg-casper/20 text-casper text-xs px-3 py-1 rounded-full">
            {settings.plan === 'pro' ? 'Pro' : 'Free'}
          </span>
        </div>

        {/* Upgrade Call-to-Action - Only show for Free users */}
        {settings.plan === 'free' && (
          <div className="bg-onyx rounded-xl px-4 py-4 space-y-3">
            <div>
              <h3 className="text-white font-medium mb-1">Want more ARCLE?</h3>
              <p className="text-casper/70 text-sm">Upgrade for unlimited transactions and advanced features.</p>
            </div>
            <Button className="w-full bg-white text-onyx hover:bg-white/90 border border-white/20">
              Coming Soon
            </Button>
          </div>
        )}

        {/* Settings Options */}
        <div className="space-y-1">
          {/* Profile */}
          <button 
            onClick={() => setShowProfileModal(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <User className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Profile</span>
          </button>

          {/* Capabilities */}
          <button 
            onClick={() => setShowCapabilitiesModal(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <SettingsIcon className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Capabilities</div>
              <div className="text-xs text-casper/70">{getEnabledCapabilitiesCount()} enabled</div>
            </div>
          </button>

          {/* Permissions */}
          <button 
            onClick={() => setShowPermissionsModal(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <Shield className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Permissions</span>
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <Moon className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Color mode</div>
              <div className="text-xs text-casper/70">{getThemeLabel()}</div>
            </div>
          </button>

          {/* Fee Level */}
          <button 
            onClick={cycleFeeLevel}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <Zap className="w-5 h-5 text-casper" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Transaction speed</div>
              <div className="text-xs text-casper/70">{getFeeLevelLabel()}</div>
            </div>
          </button>

          {/* Haptic Feedback */}
          <button 
            onClick={toggleHapticFeedback}
            className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <Bell className="w-5 h-5 text-casper" />
              <span className="text-sm font-medium">Haptic feedback</span>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.hapticFeedback ? 'bg-white' : 'bg-white/20'
            }`}>
              <div className={`absolute w-5 h-5 bg-onyx rounded-full transition-transform top-0.5 ${
                settings.hapticFeedback ? 'right-0.5' : 'left-0.5'
              }`} />
            </div>
          </button>

          {/* Privacy */}
          <button 
            onClick={() => setShowPrivacyModal(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-white hover:bg-onyx transition-colors"
          >
            <Shield className="w-5 h-5 text-casper" />
            <span className="text-sm font-medium flex-1 text-left">Privacy</span>
          </button>

          {/* Log out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-500 hover:bg-onyx transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium flex-1 text-left">Log out</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        email={settings.email}
        displayName={settings.displayName}
        avatarUrl={settings.avatarUrl}
        walletAddress={settings.walletAddress}
        onUpdateEmail={updateEmail}
        onUpdateDisplayName={updateDisplayName}
      />

      <CapabilitiesModal
        isOpen={showCapabilitiesModal}
        onClose={() => setShowCapabilitiesModal(false)}
        capabilities={settings.capabilities}
        onToggleCapability={toggleCapability}
      />

      <PermissionsModal
        isOpen={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        autoApprove={settings.autoApproveSmallTransactions}
        transactionLimit={settings.transactionLimit}
        onToggleAutoApprove={toggleAutoApprove}
      />

      <PrivacyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        analyticsEnabled={settings.analyticsEnabled}
        errorReportingEnabled={settings.errorReportingEnabled}
        onToggleAnalytics={toggleAnalytics}
        onToggleErrorReporting={toggleErrorReporting}
      />
    </div>
  );
}

