/**
 * Token Refresh Utility
 * 
 * Handles automatic token refresh for User-Controlled Wallets.
 * Tokens expire after 60 minutes, so we need to refresh them automatically.
 */

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
 * @returns New token data or null if refresh failed
 */
export async function refreshUserToken(): Promise<RefreshTokenResult | null> {
  if (typeof window === 'undefined') return null;

  const userId = localStorage.getItem('arcle_user_id');
  const refreshToken = localStorage.getItem('arcle_refresh_token');
  const deviceId = localStorage.getItem('arcle_device_id') || `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (!userId) {
    console.warn('[TokenRefresh] No userId found in localStorage');
    return null;
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

    // Update localStorage with new tokens
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

