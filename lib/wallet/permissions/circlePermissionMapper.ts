/**
 * Circle Permission Mapper
 * 
 * Maps Arcle action scopes to Circle MSCA permission types
 * Circle handles on-chain enforcement, this provides the mapping layer
 */

import type { WalletAction } from '../sessionKeys/sessionPermissions';

/**
 * Map Arcle action to Circle MSCA permission type
 * 
 * Note: This mapping will need to be updated based on Circle's actual MSCA API structure
 */
export function mapActionToCirclePermission(action: WalletAction): string {
  const mapping: Record<WalletAction, string> = {
    transfer: 'TRANSFER',
    approve: 'APPROVE',
    swap: 'SWAP',
    bridge: 'BRIDGE',
    cctp: 'CCTP',
    gateway: 'GATEWAY',
  };

  return mapping[action] || 'UNKNOWN';
}

/**
 * Map Circle permission type to Arcle action
 */
export function mapCirclePermissionToAction(circlePermission: string): WalletAction | null {
  const mapping: Record<string, WalletAction> = {
    TRANSFER: 'transfer',
    APPROVE: 'approve',
    SWAP: 'swap',
    BRIDGE: 'bridge',
    CCTP: 'cctp',
    GATEWAY: 'gateway',
  };

  return mapping[circlePermission] || null;
}

/**
 * Convert Arcle permissions to Circle MSCA permission format
 * 
 * This will need to be updated when Circle MSCA APIs are available
 */
export function convertToCirclePermissions(
  allowedActions: WalletAction[]
): any {
  // TODO: Update this based on Circle's actual MSCA permission structure
  return {
    actions: allowedActions.map(mapActionToCirclePermission),
    // Circle may have additional fields like:
    // - allowedContracts
    // - allowedRecipients
    // - rateLimits
    // etc.
  };
}

