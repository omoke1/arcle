/**
 * Vendor Agent
 *
 * Handles vendor inventory queries, order status updates, and vendor operations.
 * This agent can be used by vendors to manage their orders and inventory.
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import {
  getActiveVendors,
  getVendorById,
  getVendorItems,
  getVendorOrderById,
  updateVendorOrderStatus,
  type Vendor,
  type VendorItem,
  type VendorOrder,
} from '@/lib/db/services/vendors';

class VendorAgent {
  /**
   * Handle vendor-related intents.
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const intentText = request.intent.toLowerCase();
    const entities = request.entities || {};
    const context = request.context || {};

    // Check for vendor-related keywords
    const isInventory = intentText.includes('inventory') || intentText.includes('items') || intentText.includes('menu');
    const isOrderStatus = intentText.includes('order') && (intentText.includes('status') || intentText.includes('update'));
    const isAccept = intentText.includes('accept') && intentText.includes('order');
    const isReady = intentText.includes('ready') && intentText.includes('order');
    const vendorId = (entities as any).vendorId || (entities as any).vendor_id;
    const orderId = (entities as any).orderId || (entities as any).order_id;
    const orderNumber = (entities as any).orderNumber || (entities as any).order_number;

    // Get inventory/menu
    if (isInventory && vendorId) {
      return await this.handleGetInventory(vendorId);
    }

    // Get order status
    if (isOrderStatus && (orderId || orderNumber)) {
      return await this.handleGetOrderStatus(orderId || orderNumber);
    }

    // Accept order
    if (isAccept && (orderId || orderNumber)) {
      return await this.handleAcceptOrder(orderId || orderNumber);
    }

    // Mark order as ready
    if (isReady && (orderId || orderNumber)) {
      return await this.handleMarkReady(orderId || orderNumber);
    }

    // Fallback - help message
    return {
      success: true,
      message:
        "I can help with vendor operations. Try:\n" +
        "- \"Show inventory for vendor [id]\"\n" +
        "- \"Get order status for order #123\"\n" +
        "- \"Accept order #123\"\n" +
        "- \"Mark order #123 as ready\"",
      agent: 'vendor',
      action: 'vendor-help',
      requiresConfirmation: false,
    };
  }

  /**
   * Get vendor inventory/menu.
   */
  private async handleGetInventory(vendorId: string): Promise<AgentResponse> {
    try {
      const vendor = await getVendorById(vendorId);
      if (!vendor) {
        return {
          success: false,
          message: `Vendor ${vendorId} not found.`,
          agent: 'vendor',
          error: 'Vendor not found',
        };
      }

      const items = await getVendorItems(vendorId, { onlyAvailable: true });

      if (items.length === 0) {
        return {
          success: true,
          message: `**${vendor.name}**\n\nNo available items at the moment.`,
          agent: 'vendor',
          action: 'get-inventory',
          data: { vendor, items: [] },
        };
      }

      // Group items by category
      const byCategory: Record<string, VendorItem[]> = {};
      items.forEach((item) => {
        const cat = item.category || 'Other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      });

      const lines: string[] = [];
      lines.push(`**${vendor.name}** - Available Items\n`);

      Object.entries(byCategory).forEach(([category, categoryItems]) => {
        lines.push(`\n**${category}**`);
        categoryItems.forEach((item) => {
          lines.push(`- ${item.name} - ${item.price} ${item.currency}${item.prep_time_minutes ? ` (${item.prep_time_minutes} min)` : ''}`);
        });
      });

      return {
        success: true,
        message: lines.join('\n'),
        agent: 'vendor',
        action: 'get-inventory',
        data: { vendor, items },
      };
    } catch (error: any) {
      console.error('[VendorAgent] Error getting inventory:', error);
      return {
        success: false,
        message: 'Failed to get inventory. Please try again.',
        agent: 'vendor',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get order status.
   */
  private async handleGetOrderStatus(orderIdOrNumber: string): Promise<AgentResponse> {
    try {
      // Try by ID first, then by order number
      let order = await getVendorOrderById(orderIdOrNumber);
      if (!order) {
        const { getVendorOrderByNumber } = await import('@/lib/db/services/vendors');
        order = await getVendorOrderByNumber(orderIdOrNumber);
      }

      if (!order) {
        return {
          success: false,
          message: `Order ${orderIdOrNumber} not found.`,
          agent: 'vendor',
          error: 'Order not found',
        };
      }

      const statusMessages: Record<string, string> = {
        pending: '⏳ Waiting for vendor acceptance',
        accepted: '✅ Order accepted, preparing...',
        preparing: '👨‍🍳 Order is being prepared',
        ready: '✅ Order is ready for pickup',
        dispatched: '🚚 Order is out for delivery',
        delivered: '✅ Order has been delivered',
        cancelled: '❌ Order was cancelled',
      };

      const lines: string[] = [];
      lines.push(`**Order ${order.order_number}**`);
      lines.push(`Status: ${statusMessages[order.status] || order.status}`);
      lines.push(`Total: ${order.subtotal} ${order.currency}`);
      lines.push(`\n**Items:**`);
      order.items.forEach((item) => {
        lines.push(`- ${item.quantity}x ${item.name} - ${item.price} ${order.currency}`);
      });

      if (order.delivery_address) {
        lines.push(`\n**Delivery Address:** ${order.delivery_address}`);
      }

      if (order.estimated_delivery_time) {
        const eta = new Date(order.estimated_delivery_time);
        lines.push(`\n**Estimated Delivery:** ${eta.toLocaleString()}`);
      }

      return {
        success: true,
        message: lines.join('\n'),
        agent: 'vendor',
        action: 'get-order-status',
        data: { order },
      };
    } catch (error: any) {
      console.error('[VendorAgent] Error getting order status:', error);
      return {
        success: false,
        message: 'Failed to get order status. Please try again.',
        agent: 'vendor',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Accept an order.
   */
  private async handleAcceptOrder(orderIdOrNumber: string): Promise<AgentResponse> {
    try {
      let order = await getVendorOrderById(orderIdOrNumber);
      if (!order) {
        const { getVendorOrderByNumber } = await import('@/lib/db/services/vendors');
        order = await getVendorOrderByNumber(orderIdOrNumber);
      }

      if (!order) {
        return {
          success: false,
          message: `Order ${orderIdOrNumber} not found.`,
          agent: 'vendor',
          error: 'Order not found',
        };
      }

      if (order.status !== 'pending') {
        return {
          success: false,
          message: `Order ${order.order_number} is already ${order.status}. Cannot accept.`,
          agent: 'vendor',
          error: 'Invalid order status',
        };
      }

      await updateVendorOrderStatus({
        orderId: order.id,
        status: 'accepted',
      });

      return {
        success: true,
        message: `✅ Order ${order.order_number} has been accepted! You can now start preparing it.`,
        agent: 'vendor',
        action: 'accept-order',
        data: { orderId: order.id, orderNumber: order.order_number },
      };
    } catch (error: any) {
      console.error('[VendorAgent] Error accepting order:', error);
      return {
        success: false,
        message: 'Failed to accept order. Please try again.',
        agent: 'vendor',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Mark order as ready for dispatch.
   */
  private async handleMarkReady(orderIdOrNumber: string): Promise<AgentResponse> {
    try {
      let order = await getVendorOrderById(orderIdOrNumber);
      if (!order) {
        const { getVendorOrderByNumber } = await import('@/lib/db/services/vendors');
        order = await getVendorOrderByNumber(orderIdOrNumber);
      }

      if (!order) {
        return {
          success: false,
          message: `Order ${orderIdOrNumber} not found.`,
          agent: 'vendor',
          error: 'Order not found',
        };
      }

      if (order.status !== 'accepted' && order.status !== 'preparing') {
        return {
          success: false,
          message: `Order ${order.order_number} must be accepted or preparing before marking as ready. Current status: ${order.status}.`,
          agent: 'vendor',
          error: 'Invalid order status',
        };
      }

      await updateVendorOrderStatus({
        orderId: order.id,
        status: 'ready',
      });

      return {
        success: true,
        message: `✅ Order ${order.order_number} is now ready for dispatch! A rider will be assigned shortly.`,
        agent: 'vendor',
        action: 'mark-ready',
        data: { orderId: order.id, orderNumber: order.order_number },
      };
    } catch (error: any) {
      console.error('[VendorAgent] Error marking order as ready:', error);
      return {
        success: false,
        message: 'Failed to mark order as ready. Please try again.',
        agent: 'vendor',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Check if this agent can handle the intent.
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    const vendorKeywords = [
      'vendor',
      'inventory',
      'menu',
      'items',
      'accept order',
      'ready order',
      'order status',
    ];
    const lower = intent.toLowerCase();
    return vendorKeywords.some((keyword) => lower.includes(keyword));
  }
}

const vendorAgent = new VendorAgent();

export default vendorAgent;
export { VendorAgent };

