"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, User, LogOut, Bell, Moon, Zap, Mail, Wallet, Calendar } from "lucide-react";
import Image from "next/image";
import { useSettings } from "@/lib/settings/use-settings";

interface SettingsPageProps {
  onBack: () => void;
  onLogout?: () => void;
  showProfileOnMount?: boolean;
}

export function SettingsPage({ onBack, onLogout, showProfileOnMount = false }: SettingsPageProps) {
  const {
    settings,
    updateEmail,
    updateDisplayName,
    updateTheme,
    toggleHapticFeedback,
    updateFeeLevel,
  } = useSettings();

  const [showProfile, setShowProfile] = useState(showProfileOnMount);
  
  // Update showProfile when prop changes
  useEffect(() => {
    if (showProfileOnMount) {
      setShowProfile(true);
    }
  }, [showProfileOnMount]);

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

  // Show profile page if requested
  if (showProfile) {
    return (
      <ProfilePage
        onBack={() => setShowProfile(false)}
        email={settings.email}
        displayName={settings.displayName}
        avatarUrl={settings.avatarUrl}
        walletAddress={settings.walletAddress}
        onUpdateEmail={updateEmail}
        onUpdateDisplayName={updateDisplayName}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-graphite/30">
      {/* Header */}
      <div className="px-6 py-4 border-b border-graphite/50 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onBack}
          className="text-soft-mist/70 hover:text-signal-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-signal-white">Settings</h1>
        <div className="w-5" /> {/* Spacer for alignment */}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {/* Account Information */}
        <div className="bg-graphite/50 rounded-xl px-4 py-3 flex items-center justify-between border border-graphite/60">
          <span className="text-signal-white text-sm">
            {settings.email || settings.displayName || 'Guest User'}
          </span>
        </div>

        {/* Settings Options */}
        <div className="space-y-1">
          {/* Profile */}
          <button 
            onClick={() => setShowProfile(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors"
          >
            <User className="w-5 h-5 text-soft-mist/70" />
            <span className="text-sm font-medium flex-1 text-left">Profile</span>
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors"
          >
            <Moon className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Color mode</div>
              <div className="text-xs text-soft-mist/60">{getThemeLabel()}</div>
            </div>
          </button>

          {/* Fee Level */}
          <button 
            onClick={cycleFeeLevel}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors"
          >
            <Zap className="w-5 h-5 text-soft-mist/70" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Transaction speed</div>
              <div className="text-xs text-soft-mist/60">{getFeeLevelLabel()}</div>
            </div>
          </button>

          {/* Haptic Feedback */}
          <button 
            onClick={toggleHapticFeedback}
            className="w-full flex items-center justify-between px-3 py-3 rounded-lg text-signal-white hover:bg-graphite/50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              <Bell className="w-5 h-5 text-soft-mist/70" />
              <span className="text-sm font-medium">Haptic feedback</span>
            </div>
            <div className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.hapticFeedback ? 'bg-aurora' : 'bg-graphite/70'
            }`}>
              <div className={`absolute w-5 h-5 bg-carbon rounded-full transition-transform top-0.5 ${
                settings.hapticFeedback ? 'right-0.5' : 'left-0.5'
              }`} />
            </div>
          </button>

          {/* Log out */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-red-400 hover:bg-graphite/50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium flex-1 text-left">Log out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Profile Page Component - Renders within sidebar
interface ProfilePageProps {
  onBack: () => void;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  onUpdateEmail: (email: string) => void;
  onUpdateDisplayName: (name: string) => void;
}

function ProfilePage({
  onBack,
  email,
  displayName,
  avatarUrl,
  walletAddress,
  onUpdateEmail,
  onUpdateDisplayName,
}: ProfilePageProps) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempEmail, setTempEmail] = useState(email || '');
  const [tempName, setTempName] = useState(displayName || '');

  useEffect(() => {
    setTempEmail(email || '');
    setTempName(displayName || '');
  }, [email, displayName]);

  const handleSaveEmail = () => {
    onUpdateEmail(tempEmail);
    setEditingEmail(false);
  };

  const handleSaveName = () => {
    onUpdateDisplayName(tempName);
    setEditingName(false);
  };

  const createdDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col h-full bg-graphite/30">
      {/* Header */}
      <div className="px-6 py-4 border-b border-graphite/50 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onBack}
          className="text-soft-mist/70 hover:text-signal-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-signal-white">Profile Settings</h1>
        <div className="w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-aurora/80 to-aurora/40 flex items-center justify-center border-2 border-aurora/30">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Avatar" width={80} height={80} className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-carbon" />
            )}
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-soft-mist/80 mb-2">
            <User className="w-4 h-4" />
            Display Name
          </label>
          {editingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="flex-1 bg-graphite/70 border border-graphite/60 rounded-lg px-3 py-2 text-signal-white placeholder:text-soft-mist/50 focus:outline-none focus:ring-1 focus:ring-aurora/40"
                placeholder="Enter your name"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="px-4 py-2 bg-aurora text-carbon rounded-lg font-medium hover:bg-aurora/90 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempName(displayName || '');
                  setEditingName(false);
                }}
                className="px-4 py-2 bg-graphite/70 text-signal-white rounded-lg hover:bg-graphite/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="w-full bg-graphite/50 border border-graphite/60 rounded-lg px-3 py-2.5 text-left text-signal-white hover:bg-graphite/60 transition-colors"
            >
              {displayName || <span className="text-soft-mist/50">Click to set your name</span>}
            </button>
          )}
        </div>

        {/* Email Address */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-soft-mist/80 mb-2">
            <Mail className="w-4 h-4" />
            Email Address
          </label>
          {editingEmail ? (
            <div className="flex gap-2">
              <input
                type="email"
                value={tempEmail}
                onChange={(e) => setTempEmail(e.target.value)}
                className="flex-1 bg-graphite/70 border border-graphite/60 rounded-lg px-3 py-2 text-signal-white placeholder:text-soft-mist/50 focus:outline-none focus:ring-1 focus:ring-aurora/40"
                placeholder="Enter your email"
                autoFocus
              />
              <button
                onClick={handleSaveEmail}
                className="px-4 py-2 bg-aurora text-carbon rounded-lg font-medium hover:bg-aurora/90 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setTempEmail(email || '');
                  setEditingEmail(false);
                }}
                className="px-4 py-2 bg-graphite/70 text-signal-white rounded-lg hover:bg-graphite/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingEmail(true)}
              className="w-full bg-graphite/50 border border-graphite/60 rounded-lg px-3 py-2.5 text-left text-signal-white hover:bg-graphite/60 transition-colors"
            >
              {email || <span className="text-soft-mist/50">Click to add your email</span>}
            </button>
          )}
        </div>

        {/* Wallet Address */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-soft-mist/80 mb-2">
            <Wallet className="w-4 h-4" />
            Wallet Address
          </label>
          <div className="w-full bg-graphite/50 border border-graphite/60 rounded-lg px-3 py-2.5 text-soft-mist/50">
            {walletAddress ? (
              <span className="text-signal-white font-mono text-sm">{walletAddress}</span>
            ) : (
              "No wallet connected"
            )}
          </div>
        </div>

        {/* Member Since */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-soft-mist/80 mb-2">
            <Calendar className="w-4 h-4" />
            Member Since
          </label>
          <div className="w-full bg-graphite/50 border border-graphite/60 rounded-lg px-3 py-2.5 text-signal-white">
            {createdDate}
          </div>
        </div>

        {/* Done Button */}
        <div className="pt-4">
          <button
            onClick={onBack}
            className="w-full bg-aurora text-carbon rounded-lg px-4 py-3 font-medium hover:bg-aurora/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

