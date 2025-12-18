/**
 * Settings Hook - Manages user settings and preferences
 * 
 * This hook provides:
 * - User profile (email, display name, avatar)
 * - Theme preferences (light/dark/system)
 * - Feature capabilities
 * - Subscription status
 * - Haptic feedback
 * - All other user preferences
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { loadPreference, savePreference } from "@/lib/supabase-data";

export interface UserSettings {
  // Profile
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  walletAddress: string | null;
  
  // Subscription
  plan: 'free' | 'pro';
  
  // Preferences
  theme: 'light' | 'dark' | 'system';
  hapticFeedback: boolean;
  defaultFeeLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Capabilities (enabled features)
  capabilities: {
    voiceCommands: boolean;
    crossChainBridging: boolean;
    defiOperations: boolean;
    yieldFarming: boolean;
    savingsGoals: boolean;
    multiTokenSupport: boolean;
  };
  
  // Permissions
  autoApproveSmallTransactions: boolean;
  transactionLimit: number;
  
  // Privacy
  analyticsEnabled: boolean;
  errorReportingEnabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  email: null,
  displayName: null,
  avatarUrl: null,
  walletAddress: null,
  plan: 'free',
  theme: 'dark',
  hapticFeedback: true,
  defaultFeeLevel: 'MEDIUM',
  capabilities: {
    voiceCommands: true,
    crossChainBridging: true,
    defiOperations: true,
    yieldFarming: true,
    savingsGoals: true,
    multiTokenSupport: true,
  },
  autoApproveSmallTransactions: false,
  transactionLimit: 100,
  analyticsEnabled: true,
  errorReportingEnabled: true,
};

export function useSettings(userId?: string) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  // Load settings from Supabase (if userId provided)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // If we don't have a user yet, just ensure defaults are applied once
        if (!userId) {
          if (!hasLoadedRef.current) {
            setSettings(DEFAULT_SETTINGS);
            setIsLoading(false);
            hasLoadedRef.current = true;
          }
          return;
        }

        const preference = await loadPreference({ userId, key: "user_settings" });
        if (preference?.value) {
          setSettings({ ...DEFAULT_SETTINGS, ...preference.value });
        } else {
          await savePreference({ userId, key: "user_settings", value: DEFAULT_SETTINGS });
          setSettings(DEFAULT_SETTINGS);
        }
        
        setIsLoading(false);
        hasLoadedRef.current = true;
      } catch (error) {
        console.error("[Settings] Error loading settings:", error);
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [userId]);

  // Apply theme on initial load and whenever settings.theme changes
  useEffect(() => {
    if (isLoading) return;
    if (typeof window === "undefined") return;

    const theme = settings.theme;

    if (theme === "light") {
      document.documentElement.classList.remove("dark");
    } else if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      // System preference
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [settings.theme, isLoading]);

  // Save settings to Supabase (if userId provided)
  const saveSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      if (userId) {
        savePreference({ userId, key: "user_settings", value: updated }).catch((error) => {
          console.error("[Settings] Error saving to Supabase:", error);
        });
      }
      
      return updated;
    });
  }, [userId]);

  // Update email
  const updateEmail = useCallback((email: string) => {
    saveSettings({ email });
  }, [saveSettings]);

  // Update display name
  const updateDisplayName = useCallback((displayName: string) => {
    saveSettings({ displayName });
  }, [saveSettings]);

  // Update avatar
  const updateAvatar = useCallback((avatarUrl: string) => {
    saveSettings({ avatarUrl });
  }, [saveSettings]);

  // Update theme
  const updateTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    saveSettings({ theme });
    
    // Apply theme to document
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      // System preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [saveSettings]);

  // Toggle haptic feedback
  const toggleHapticFeedback = useCallback(() => {
    saveSettings({ hapticFeedback: !settings.hapticFeedback });
    
    // Trigger haptic if enabling
    if (!settings.hapticFeedback && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [settings.hapticFeedback, saveSettings]);

  // Update fee level
  const updateFeeLevel = useCallback((feeLevel: 'LOW' | 'MEDIUM' | 'HIGH') => {
    saveSettings({ defaultFeeLevel: feeLevel });
  }, [saveSettings]);

  // Update capability
  const toggleCapability = useCallback((capability: keyof UserSettings['capabilities']) => {
    saveSettings({
      capabilities: {
        ...settings.capabilities,
        [capability]: !settings.capabilities[capability],
      },
    });
  }, [settings.capabilities, saveSettings]);

  // Get enabled capabilities count
  const getEnabledCapabilitiesCount = useCallback(() => {
    return Object.values(settings.capabilities).filter(Boolean).length;
  }, [settings.capabilities]);

  // Toggle auto-approve
  const toggleAutoApprove = useCallback(() => {
    saveSettings({ autoApproveSmallTransactions: !settings.autoApproveSmallTransactions });
  }, [settings.autoApproveSmallTransactions, saveSettings]);

  // Toggle analytics
  const toggleAnalytics = useCallback(() => {
    saveSettings({ analyticsEnabled: !settings.analyticsEnabled });
  }, [settings.analyticsEnabled, saveSettings]);

  // Toggle error reporting
  const toggleErrorReporting = useCallback(() => {
    saveSettings({ errorReportingEnabled: !settings.errorReportingEnabled });
  }, [settings.errorReportingEnabled, saveSettings]);

  // Upgrade to pro
  const upgradeToPro = useCallback(() => {
    // TODO: Implement actual payment flow
    saveSettings({ plan: 'pro' });
  }, [saveSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    if (userId) {
      savePreference({ userId, key: "user_settings", value: DEFAULT_SETTINGS }).catch((error) => {
        console.error("[Settings] Error resetting settings:", error);
      });
    }
  }, [userId]);

  return {
    settings,
    isLoading,
    updateEmail,
    updateDisplayName,
    updateAvatar,
    updateTheme,
    toggleHapticFeedback,
    updateFeeLevel,
    toggleCapability,
    getEnabledCapabilitiesCount,
    toggleAutoApprove,
    toggleAnalytics,
    toggleErrorReporting,
    upgradeToPro,
    resetToDefaults,
    saveSettings,
  };
}

