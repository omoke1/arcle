/**
 * Merchant Agent
 * 
 * Handles merchant operations, POS, settlements, and merchant account management
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { getActiveVendors, createVendorOrder, type Vendor } from '@/lib/db/services/vendors';

class MerchantAgent {
  /**
   * Execute a low-level merchant action
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'list-vendors': {
        return await getActiveVendors();
      }

      case 'create-order': {
        const { vendorId, orderNumber, subtotal, items, userId } = params;
        if (!vendorId || !orderNumber || !subtotal || !userId) {
          throw new Error('Missing required parameters for order creation');
        }
        return await createVendorOrder({
          vendor_id: vendorId,
          user_id: userId,
          order_number: orderNumber,
          subtotal: String(subtotal),
          items: items || [],
        });
      }

      case 'merchant-settings': {
        // TODO: Implement merchant settings management
        return { message: 'Merchant settings feature coming soon' };
      }

      default:
        throw new Error(`Unknown merchant action: ${action}`);
    }
  }

  /**
   * Handle a routed merchant request
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;
    const intentLower = intent.toLowerCase();
    const userId = (context as any)?.userId;

    // List vendors/merchants
    if (intentLower.includes('vendor') || intentLower.includes('merchant') || intentLower.includes('list')) {
      try {
        const vendors = await this.execute('list-vendors', {});
        if (vendors.length === 0) {
          return {
            success: true,
            message: 'No active vendors found. Vendors can be added through the admin panel.',
            agent: 'merchant',
            data: { vendors: [] },
          };
        }

        const lines = ['🏪 Active Vendors:\n'];
        vendors.forEach((v: Vendor, i: number) => {
          lines.push(`${i + 1}. ${v.name || 'Unknown'}`);
          if (v.description) {
            lines.push(`   ${v.description}`);
          }
          if (v.category) {
            lines.push(`   Category: ${v.category}`);
          }
        });

        return {
          success: true,
          message: lines.join('\n'),
          agent: 'merchant',
          data: { vendors },
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not fetch vendors: ${error.message}`,
          agent: 'merchant',
          error: error.message,
        };
      }
    }

    // Create merchant order
    if (intentLower.includes('order') || intentLower.includes('purchase') || intentLower.includes('buy')) {
      if (!userId) {
        return {
          success: false,
          message: 'I need your user ID to create an order. Please make sure you are signed in.',
          agent: 'merchant',
          error: 'Missing userId',
        };
      }

      const vendorId = entities.vendorId || entities.vendor_id;
      const amount = entities.amount;
      const items = entities.items || [];

      if (!vendorId || !amount) {
        return {
          success: false,
          message: 'To create an order, I need:\n• Vendor ID\n• Amount\n\nExample: "Create an order with vendor X for $50"',
          agent: 'merchant',
          error: 'Missing vendorId or amount',
        };
      }

      try {
        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        
        // Convert items to VendorOrderItem format if needed
        const orderItems = items.length > 0 ? items.map((item: any) => ({
          item_id: item.item_id || item.id || '',
          name: item.name || 'Item',
          quantity: item.quantity || 1,
          price: item.price || amount,
        })) : [{
          item_id: '',
          name: 'Order',
          quantity: 1,
          price: amount,
        }];

        const order = await this.execute('create-order', {
          vendorId,
          orderNumber,
          subtotal: amount,
          items: orderItems,
          userId,
        });

        return {
          success: true,
          message: `✅ Order created successfully!\n\nOrder ID: ${order.id}\nAmount: $${amount}\nStatus: ${order.status}`,
          agent: 'merchant',
          data: order,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `Could not create order: ${error.message}`,
          agent: 'merchant',
          error: error.message,
        };
      }
    }

    // POS / Settlement operations
    if (intentLower.includes('pos') || intentLower.includes('point of sale') || intentLower.includes('settlement')) {
      return {
        success: true,
        message: `💳 Merchant Operations:\n\n` +
          `• **POS**: Point of sale integration coming soon\n` +
          `• **Settlements**: Automatic settlement processing coming soon\n` +
          `• **Analytics**: Merchant dashboard and analytics coming soon\n\n` +
          `For now, you can list vendors and create orders.`,
        agent: 'merchant',
      };
    }

    // Default help
    return {
      success: true,
      message: `I can help you with merchant operations:\n\n` +
        `• **List Vendors**: "Show vendors" or "List merchants"\n` +
        `• **Create Order**: "Create an order with vendor X for $50"\n` +
        `• **POS**: Point of sale operations (coming soon)\n` +
        `• **Settlements**: Merchant settlement processing (coming soon)\n\n` +
        `What would you like to do?`,
      agent: 'merchant',
    };
  }

  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    if (typeof intent === 'string' && !intent.includes(' ')) {
      const merchantIntents: IntentType[] = ['merchant', 'pos', 'settlement'];
      if (merchantIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    const merchantKeywords = ['pos', 'point of sale', 'merchant', 'settlement', 'vendor', 'order'];
    return merchantKeywords.some((keyword) => intentStr.includes(keyword));
  }
}

const merchantAgent = new MerchantAgent();

export default merchantAgent;
export { MerchantAgent };

