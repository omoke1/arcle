/**
 * Token Refresh Utility
 * 
 * Handles automatic token refresh for User-Controlled Wallets.
 * Tokens expire after 60 minutes, so we need to refresh them automatically.
 */

import { loadPreference, savePreference, loadUserCredentials, saveUserCredentials } from "@/lib/supabase-data";

export interface RefreshTokenResult {
  userToken: string;
  encryptionKey?: string;
  refreshToken?: string;
}

/**
 * Refresh user token automatically
 * 
 * Tries to use refreshToken if available, otherwise falls back to createUserToken
 * 
 * @param userId Optional userId - if not provided, will try to load from Supabase
 * @returns New token data or null if refresh failed
 */
export async function refreshUserToken(userId?: string): Promise<RefreshTokenResult | null> {
  if (typeof window === 'undefined') return null;

  // Try to get userId from parameter or Supabase
  let finalUserId = userId;
  if (!finalUserId) {
    // Migration: Try localStorage first, then Supabase
    const legacyUserId = localStorage.getItem('arcle_user_id');
    if (legacyUserId) {
      finalUserId = legacyUserId;
    } else {
      // Try to get from a "current_user_id" preference (if set)
      try {
        const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
        if (currentUserPref?.value) {
          finalUserId = currentUserPref.value;
        }
      } catch (error) {
        // Ignore - will return null below
      }
    }
  }

  if (!finalUserId) {
    console.warn('[TokenRefresh] No userId found');
    return null;
  }

  // Load refreshToken and deviceId from Supabase
  let refreshToken: string | null = null;
  let deviceId: string | null = null;

  try {
    const [refreshPref, devicePref] = await Promise.all([
      loadPreference({ userId: finalUserId, key: "refresh_token" }).catch(() => null),
      loadPreference({ userId: finalUserId, key: "device_id" }).catch(() => null),
    ]);
    refreshToken = refreshPref?.value ?? null;
    deviceId = devicePref?.value ?? null;
  } catch (error) {
    console.warn('[TokenRefresh] Failed to load preferences from Supabase, trying localStorage migration:', error);
    // Migration fallback
    refreshToken = localStorage.getItem('arcle_refresh_token');
    deviceId = localStorage.getItem('arcle_device_id');
  }

  // Generate deviceId if not found
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  try {
    console.log('[TokenRefresh] Refreshing user token...', {
      hasRefreshToken: !!refreshToken,
      hasDeviceId: !!deviceId,
    });

    const response = await fetch('/api/circle/users/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, refreshToken, deviceId }),
    });

    const data = await response.json();
    
    if (!data.success) {
      console.error('[TokenRefresh] Token refresh failed:', data.error);
      return null;
    }

    // Save new tokens to Supabase
    try {
      await saveUserCredentials(finalUserId, {
        userToken: data.data.userToken,
        encryptionKey: data.data.encryptionKey,
      });
      
      if (data.data.refreshToken) {
        await savePreference({ userId: finalUserId, key: "refresh_token", value: data.data.refreshToken });
      }
      
      if (deviceId) {
        await savePreference({ userId: finalUserId, key: "device_id", value: deviceId });
      }
    } catch (error) {
      console.error('[TokenRefresh] Failed to save tokens to Supabase:', error);
      // Migration fallback: also save to localStorage
      localStorage.setItem('arcle_user_token', data.data.userToken);
      if (data.data.encryptionKey) {
        localStorage.setItem('arcle_encryption_key', data.data.encryptionKey);
      }
      if (data.data.refreshToken) {
        localStorage.setItem('arcle_refresh_token', data.data.refreshToken);
      }
      if (deviceId) {
        localStorage.setItem('arcle_device_id', deviceId);
      }
    }

    console.log('[TokenRefresh] ✅ Token refreshed successfully');
    
    return {
      userToken: data.data.userToken,
      encryptionKey: data.data.encryptionKey,
      refreshToken: data.data.refreshToken,
    };
  } catch (error) {
    console.error('[TokenRefresh] Error refreshing token:', error);
    return null;
  }
}

/**
 * Check if token is expired or expiring soon
 * 
 * @param token JWT token string
 * @param bufferMinutes Minutes before expiration to consider "expiring soon" (default: 5)
 * @returns Object with isExpired, isExpiringSoon, and expiresAt
 */
export function checkTokenExpiry(token: string | null, bufferMinutes: number = 5): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiresAt: number | null;
} {
  if (!token) {
    return { isExpired: true, isExpiringSoon: true, expiresAt: null };
  }

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const bufferMs = bufferMinutes * 60 * 1000;

    return {
      isExpired: timeUntilExpiry <= 0,
      isExpiringSoon: timeUntilExpiry < bufferMs,
      expiresAt,
    };
  } catch (error) {
    console.error('[TokenRefresh] Error parsing token:', error);
    return { isExpired: true, isExpiringSoon: true, expiresAt: null };
  }
}

