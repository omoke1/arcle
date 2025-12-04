/**
 * Circle MSCA Session Keys
 * 
 * Wrapper for Circle's MSCA (Modular Smart Contract Account) session key APIs
 * Circle handles all security, approval, and limits on-chain
 */

// getUserCircleClient is dynamically imported to avoid SSR issues
import type { CircleSessionKey, SessionPermissions, CircleSessionKeyConfig } from './sessionPermissions';

// Re-export for convenience
export type { CircleSessionKeyConfig } from './sessionPermissions';

export interface CreateSessionKeyRequest {
  walletId: string;
  userId: string;
  userToken: string;
  permissions: SessionPermissions;
}

export interface CreateSessionKeyResponse {
  success: boolean;
  sessionKey?: CircleSessionKey;
  challengeId?: string; // If user approval is required
  error?: string;
}

/**
 * Create a Circle MSCA session key
 * 
 * Uses our custom SessionKeyModule smart contract deployed on-chain
 * This integrates with Circle's MSCA infrastructure via ERC-6900
 */
export async function createCircleSessionKey(
  config: CircleSessionKeyConfig
): Promise<CreateSessionKeyResponse> {
  try {
    console.log('[Circle MSCA] Creating session key:', { 
      walletId: config.walletId, 
      userId: config.userId,
      hasUserToken: !!config.userToken 
    });
    
    // Validate required parameters
    if (!config.walletId) {
      return {
        success: false,
        error: 'walletId is required',
      };
    }
    
    if (!config.userToken) {
      return {
        success: false,
        error: 'userToken is required',
      };
    }
    
    // Get wallet address (needed for contract interaction)
    // Dynamically import to avoid SSR issues with Circle SDK
    const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
    const client = getUserCircleClient();
    
    console.log('[Circle MSCA] Calling getWallet with:', { 
      id: config.walletId,
      hasUserToken: !!config.userToken 
    });
    
    const walletResponse = await (client as any).getWallet({
      userToken: config.userToken,
      id: config.walletId, // Circle SDK expects 'id', not 'walletId'
    });
    
    // Log full response structure for debugging
    console.log('[Circle MSCA] getWallet full response:', JSON.stringify(walletResponse, null, 2));
    console.log('[Circle MSCA] getWallet response keys:', Object.keys(walletResponse || {}));
    console.log('[Circle MSCA] getWallet data keys:', Object.keys(walletResponse?.data || {}));
    
    if (walletResponse.error) {
      console.error('[Circle MSCA] getWallet error:', walletResponse.error);
      return {
        success: false,
        error: `Failed to get wallet: ${walletResponse.error.message || walletResponse.error}`,
      };
    }

    // Check multiple possible response structures
    let walletAddress: string | undefined;
    let chainId: string | undefined;
    
    // Try addresses array (plural) - User-Controlled Wallets format
    if (walletResponse.data?.addresses && Array.isArray(walletResponse.data.addresses) && walletResponse.data.addresses.length > 0) {
      walletAddress = walletResponse.data.addresses[0].address;
      chainId = walletResponse.data.addresses[0].chain;
      console.log('[Circle MSCA] Found address in addresses array:', { walletAddress, chainId });
    }
    // Try address (singular) - Legacy format
    else if (walletResponse.data?.address) {
      walletAddress = walletResponse.data.address;
      chainId = walletResponse.data.chain || '5042002';
      console.log('[Circle MSCA] Found address in address field:', { walletAddress, chainId });
    }
    // Try direct response structure
    else if (walletResponse.address) {
      walletAddress = walletResponse.address;
      chainId = walletResponse.chain || '5042002';
      console.log('[Circle MSCA] Found address in root response:', { walletAddress, chainId });
    }

    // If still no address, try REST API as fallback
    if (!walletAddress) {
      console.log('[Circle MSCA] SDK response had no address, trying REST API fallback...');
      try {
        const { circleApiRequest } = await import('@/lib/circle');
        const restResponse = await circleApiRequest<any>(`/v1/w3s/wallets/${config.walletId}`, {
          method: 'GET',
        });
        
        console.log('[Circle MSCA] REST API response:', JSON.stringify(restResponse, null, 2));
        
        // Try REST API response structure
        if (restResponse.data?.addresses && Array.isArray(restResponse.data.addresses) && restResponse.data.addresses.length > 0) {
          walletAddress = restResponse.data.addresses[0].address;
          chainId = restResponse.data.addresses[0].chain;
          console.log('[Circle MSCA] Found address via REST API:', { walletAddress, chainId });
        } else if (restResponse.data?.address) {
          walletAddress = restResponse.data.address;
          chainId = restResponse.data.chain || '5042002';
          console.log('[Circle MSCA] Found address via REST API (singular):', { walletAddress, chainId });
        }
      } catch (restError: any) {
        console.error('[Circle MSCA] REST API fallback also failed:', restError);
      }
    }

    if (!walletAddress) {
      console.error('[Circle MSCA] No addresses found in wallet response. Full SDK response:', JSON.stringify(walletResponse, null, 2));
      return {
        success: false,
        error: 'Wallet address not found. Wallet may need to be initialized or the response format is unexpected. Please ensure the wallet has been created and initialized.',
      };
    }

    // walletAddress and chainId are now set above from the response parsing
    // Default chainId if not found
    if (!chainId) {
      chainId = '5042002'; // Default to Arc Testnet
    }

    // Create session key on-chain via our custom module
    const { createSessionKeyOnChain } = await import('../msca/sessionKeyContract');
    const result = await createSessionKeyOnChain(
      config.walletId,
      config.userId,
      config.userToken,
      walletAddress,
      config,
      chainId
    );

    if (!result.success || !result.sessionKeyAddress) {
      return {
        success: false,
        challengeId: result.challengeId,
        error: result.error || 'Failed to create session key',
      };
    }

    // Create session key object
    const sessionKey: CircleSessionKey = {
      sessionKeyId: result.sessionKeyAddress, // Use on-chain address as ID
      walletId: config.walletId,
      userId: config.userId,
      permissions: {
        allowedActions: config.allowedActions,
        spendingLimit: config.spendingLimit,
        spendingUsed: '0',
        expiryTime: config.expiryTime,
        autoRenew: config.autoRenew || false,
        maxRenewals: 10,
        renewalsUsed: 0,
        allowedChains: config.allowedChains,
        allowedTokens: config.allowedTokens,
        maxAmountPerTransaction: config.maxAmountPerTransaction,
      },
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: config.expiryTime,
      status: 'active',
      mscaAddress: walletAddress,
    };

    return {
      success: true,
      sessionKey,
      challengeId: result.challengeId, // User needs to approve the transaction
    };
  } catch (error: any) {
    console.error('[Circle MSCA] Error creating session key:', error);
    return {
      success: false,
      error: error.message || 'Failed to create session key',
    };
  }
}

/**
 * Get session key status from Circle
 */
export async function getCircleSessionKeyStatus(
  sessionKeyId: string,
  userToken: string,
  walletId: string
): Promise<CircleSessionKey | null> {
  try {
    const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
    const client = getUserCircleClient();
    
    // TODO: Replace with actual Circle MSCA API
    // const response = await (client as any).getMSCASessionKey({
    //   userToken,
    //   walletId,
    //   sessionKeyId,
    // });
    
    // For now, return null (will need to implement when Circle APIs are available)
    console.warn('[Circle MSCA] getSessionKeyStatus not yet implemented - waiting for Circle MSCA APIs');
    return null;
  } catch (error: any) {
    console.error('[Circle MSCA] Error getting session key status:', error);
    return null;
  }
}

/**
 * Revoke a Circle session key
 * 
 * Uses our custom SessionKeyModule smart contract to revoke on-chain
 */
export async function revokeCircleSessionKey(
  sessionKeyId: string,
  userToken: string,
  walletId: string,
  userId?: string,
  chainId?: string
): Promise<{ success: boolean; challengeId?: string; error?: string }> {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'userId is required',
      };
    }

    // Get wallet to determine chain
    const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
    const client = getUserCircleClient();
    const walletResponse = await (client as any).getWallet({
      userToken,
      id: walletId, // Circle SDK expects 'id', not 'walletId'
    });

    if (!walletResponse.data?.addresses || walletResponse.data.addresses.length === 0) {
      return {
        success: false,
        error: 'Wallet address not found',
      };
    }

    const detectedChainId = walletResponse.data.addresses[0].chain || chainId || '5042002';

    // Revoke session key on-chain
    const { revokeSessionKeyOnChain } = await import('../msca/sessionKeyContract');
    const result = await revokeSessionKeyOnChain(
      walletId,
      userId,
      userToken,
      sessionKeyId,
      detectedChainId
    );

    return result;
  } catch (error: any) {
    console.error('[Circle MSCA] Error revoking session key:', error);
    return {
      success: false,
      error: error.message || 'Failed to revoke session key',
    };
  }
}

/**
 * Renew a Circle session key
 */
export async function renewCircleSessionKey(
  sessionKeyId: string,
  userToken: string,
  walletId: string,
  newExpiryTime: number
): Promise<{ success: boolean; sessionKey?: CircleSessionKey; error?: string }> {
  try {
    const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
    const client = getUserCircleClient();
    
    // TODO: Replace with actual Circle MSCA API
    // const response = await (client as any).renewMSCASessionKey({
    //   userToken,
    //   walletId,
    //   sessionKeyId,
    //   newExpiryTime,
    // });
    
    console.log('[Circle MSCA] Renewing session key:', sessionKeyId);
    
    // For now, return success (will need to implement when Circle APIs are available)
    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[Circle MSCA] Error renewing session key:', error);
    return {
      success: false,
      error: error.message || 'Failed to renew session key',
    };
  }
}

