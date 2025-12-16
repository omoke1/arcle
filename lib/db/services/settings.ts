/**
 * Settings Service
 * 
 * Manages user preferences and settings
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

// Supabase table structure
export interface SettingsRecord {
  id: string;
  user_id: string;
  currency_preference: string;
  language: string;
  timezone: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  auto_approve_payments: boolean;
  auto_approve_limit: string;
  session_key_auto_renew: boolean;
  theme: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

// Full user settings (matches use-settings.ts interface)
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

  // Capabilities
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

  // Notification Preferences
  notificationPreferences: {
    transactionNotifications: boolean;
    balanceChangeNotifications: boolean;
    securityAlerts: boolean;
    systemNotifications: boolean;
    minBalanceChange: string;
    email: boolean;
    push: boolean;
    inApp: boolean;
  };

  // Privacy
  analyticsEnabled: boolean;
  errorReportingEnabled: boolean;
}

export interface CreateSettingsData {
  user_id: string;
  currency_preference?: string;
  language?: string;
  timezone?: string;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  auto_approve_payments?: boolean;
  auto_approve_limit?: string;
  session_key_auto_renew?: boolean;
  theme?: string;
  metadata?: any;
}

/**
 * Create default settings for a user
 */
export async function createSettings(data: CreateSettingsData | { user_id: string; settings?: Partial<UserSettings> }): Promise<UserSettings> {
  const supabase = getSupabaseAdmin();

  // If settings provided, use them; otherwise use defaults
  const defaultSettings: Partial<UserSettings> = {
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
    notificationPreferences: {
      transactionNotifications: true,
      balanceChangeNotifications: true,
      securityAlerts: true,
      systemNotifications: true,
      minBalanceChange: '10',
      email: false,
      push: false,
      inApp: true,
    },
    analyticsEnabled: true,
    errorReportingEnabled: true,
  };

  const userSettings = 'settings' in data ? { ...defaultSettings, ...data.settings } : defaultSettings;
  const recordData = mapUserSettingsToRecord(data.user_id, userSettings);

  const { data: settings, error } = await supabase
    .from('settings')
    .insert({
      user_id: data.user_id,
      currency_preference: 'currency_preference' in data ? data.currency_preference : 'USD',
      language: 'language' in data ? data.language : 'en',
      timezone: 'timezone' in data ? data.timezone : 'UTC',
      notifications_enabled: 'notifications_enabled' in data ? data.notifications_enabled : true,
      email_notifications: 'email_notifications' in data ? data.email_notifications : true,
      push_notifications: 'push_notifications' in data ? data.push_notifications : true,
      auto_approve_payments: recordData.auto_approve_payments ?? false,
      auto_approve_limit: recordData.auto_approve_limit || '100',
      session_key_auto_renew: 'session_key_auto_renew' in data ? data.session_key_auto_renew : true,
      theme: recordData.theme || 'dark',
      metadata: recordData.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Settings Service] Error creating settings:', error);
    throw new Error(`Failed to create settings: ${error.message}`);
  }

  return mapSettingsRecordToUserSettings(settings);
}

/**
 * Get settings for a user (returns full UserSettings interface)
 */
export async function getUserSettings(user_id: string): Promise<UserSettings | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', user_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Settings Service] Error getting user settings:', error);
    return null;
  }

  // Convert Supabase record to UserSettings interface
  return mapSettingsRecordToUserSettings(data);
}

/**
 * Map Supabase settings record to UserSettings interface
 */
function mapSettingsRecordToUserSettings(record: SettingsRecord): UserSettings {
  const metadata = record.metadata || {};

  return {
    email: metadata.email || null,
    displayName: metadata.displayName || null,
    avatarUrl: metadata.avatarUrl || null,
    walletAddress: metadata.walletAddress || null,
    plan: metadata.plan || 'free',
    theme: (record.theme as 'light' | 'dark' | 'system') || 'dark',
    hapticFeedback: metadata.hapticFeedback ?? true,
    defaultFeeLevel: (metadata.defaultFeeLevel as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM',
    capabilities: {
      voiceCommands: metadata.capabilities?.voiceCommands ?? true,
      crossChainBridging: metadata.capabilities?.crossChainBridging ?? true,
      defiOperations: metadata.capabilities?.defiOperations ?? true,
      yieldFarming: metadata.capabilities?.yieldFarming ?? true,
      savingsGoals: metadata.capabilities?.savingsGoals ?? true,
      multiTokenSupport: metadata.capabilities?.multiTokenSupport ?? true,
    },
    autoApproveSmallTransactions: record.auto_approve_payments || false,
    transactionLimit: parseInt(record.auto_approve_limit || '100', 10),
    notificationPreferences: {
      transactionNotifications: metadata.notificationPreferences?.transactionNotifications ?? true,
      balanceChangeNotifications: metadata.notificationPreferences?.balanceChangeNotifications ?? true,
      securityAlerts: metadata.notificationPreferences?.securityAlerts ?? true,
      systemNotifications: metadata.notificationPreferences?.systemNotifications ?? true,
      minBalanceChange: metadata.notificationPreferences?.minBalanceChange || '10',
      email: metadata.notificationPreferences?.email ?? false,
      push: metadata.notificationPreferences?.push ?? false,
      inApp: metadata.notificationPreferences?.inApp ?? true,
    },
    analyticsEnabled: metadata.analyticsEnabled ?? true,
    errorReportingEnabled: metadata.errorReportingEnabled ?? true,
  };
}

/**
 * Map UserSettings to Supabase settings record
 */
function mapUserSettingsToRecord(user_id: string, settings: Partial<UserSettings>): Partial<CreateSettingsData> {
  return {
    user_id,
    theme: settings.theme || 'dark',
    auto_approve_payments: settings.autoApproveSmallTransactions || false,
    auto_approve_limit: (settings.transactionLimit || 100).toString(),
    metadata: {
      email: settings.email,
      displayName: settings.displayName,
      avatarUrl: settings.avatarUrl,
      walletAddress: settings.walletAddress,
      plan: settings.plan || 'free',
      hapticFeedback: settings.hapticFeedback,
      defaultFeeLevel: settings.defaultFeeLevel,
      capabilities: settings.capabilities,
      notificationPreferences: settings.notificationPreferences,
      analyticsEnabled: settings.analyticsEnabled,
      errorReportingEnabled: settings.errorReportingEnabled,
    },
  };
}

/**
 * Get or create settings for a user
 */
export async function getOrCreateSettings(user_id: string): Promise<UserSettings> {
  const existing = await getUserSettings(user_id);
  if (existing) {
    return existing;
  }

  return await createSettings({ user_id });
}

/**
 * Update settings (accepts UserSettings interface)
 */
export async function updateSettings(
  user_id: string,
  updates: Partial<UserSettings>
): Promise<UserSettings> {
  const supabase = getSupabaseAdmin();

  // Ensure settings exist
  await getOrCreateSettings(user_id);

  // Get existing settings to merge
  const existing = await getUserSettings(user_id);
  const merged = { ...existing, ...updates } as UserSettings;

  // Convert to Supabase format
  const recordUpdates = mapUserSettingsToRecord(user_id, merged);

  // Convert to Supabase record format
  const supabaseUpdates: Partial<SettingsRecord> = {
    theme: recordUpdates.theme,
    auto_approve_payments: recordUpdates.auto_approve_payments,
    auto_approve_limit: recordUpdates.auto_approve_limit,
    metadata: recordUpdates.metadata,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('settings')
    .update(supabaseUpdates)
    .eq('user_id', user_id)
    .select()
    .single();

  if (error) {
    console.error('[Settings Service] Error updating settings:', error);
    throw new Error(`Failed to update settings: ${error.message}`);
  }

  return mapSettingsRecordToUserSettings(data);
}

/**
 * Update currency preference
 * Note: Currency preference is stored in Supabase metadata column
 */
export async function updateCurrencyPreference(
  user_id: string,
  currency: string
): Promise<UserSettings> {
  const supabase = getSupabaseAdmin();
  const existing = await getUserSettings(user_id);

  // Get existing metadata from Supabase record
  const { data: record } = await supabase
    .from('settings')
    .select('metadata')
    .eq('user_id', user_id)
    .single();

  const metadata = record?.metadata || {};

  // Update metadata in Supabase
  await supabase
    .from('settings')
    .update({
      metadata: { ...metadata, currencyPreference: currency },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id);

  // Return updated settings
  return await getUserSettings(user_id) || await getOrCreateSettings(user_id);
}

/**
 * Update language
 * Note: Language is stored in Supabase metadata column
 */
export async function updateLanguage(
  user_id: string,
  language: string
): Promise<UserSettings> {
  const supabase = getSupabaseAdmin();

  // Get existing metadata from Supabase record
  const { data: record } = await supabase
    .from('settings')
    .select('metadata')
    .eq('user_id', user_id)
    .single();

  const metadata = record?.metadata || {};

  // Update metadata in Supabase
  await supabase
    .from('settings')
    .update({
      metadata: { ...metadata, language },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id);

  // Return updated settings
  return await getUserSettings(user_id) || await getOrCreateSettings(user_id);
}

/**
 * Update theme
 */
export async function updateTheme(
  user_id: string,
  theme: string
): Promise<UserSettings> {
  return await updateSettings(user_id, { theme: theme as 'light' | 'dark' | 'system' });
}

/**
 * Toggle notifications
 * Note: Notifications settings are stored in Supabase metadata column
 */
export async function toggleNotifications(
  user_id: string,
  enabled: boolean
): Promise<UserSettings> {
  const supabase = getSupabaseAdmin();

  // Get existing metadata from Supabase record
  const { data: record } = await supabase
    .from('settings')
    .select('metadata')
    .eq('user_id', user_id)
    .single();

  const metadata = record?.metadata || {};

  // Update metadata in Supabase
  await supabase
    .from('settings')
    .update({
      metadata: { ...metadata, notificationsEnabled: enabled },
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user_id);

  // Return updated settings
  return await getUserSettings(user_id) || await getOrCreateSettings(user_id);
}

/**
 * Toggle auto-approve payments
 */
export async function toggleAutoApprovePayments(
  user_id: string,
  enabled: boolean,
  limit?: string
): Promise<UserSettings> {
  return await updateSettings(user_id, {
    autoApproveSmallTransactions: enabled,
    transactionLimit: limit ? parseInt(limit, 10) : 100,
  });
}

/**
 * Delete settings (cascade delete handled by DB)
 */
export async function deleteSettings(user_id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('settings')
    .delete()
    .eq('user_id', user_id);

  if (error) {
    console.error('[Settings Service] Error deleting settings:', error);
    return false;
  }

  return true;
}

