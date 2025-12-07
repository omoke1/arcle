/**
 * Commerce Agent
 *
 * Handles high-level commerce intents like placing orders.
 * For now this focuses on understanding the user's request and
 * guiding them into a payments / invoice flow that already exists.
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import { getActiveVendors, createVendorOrder, type Vendor } from '@/lib/db/services/vendors';

type CommerceCategory = "food" | "shopping" | "services";

// Fallback in-memory catalog (used if Supabase is not available)
const FALLBACK_VENDORS = [
  {
    id: "food-urban-bites",
    name: "Urban Bites Kitchen",
    category: "food",
    description: "Fast casual meals, rice bowls, and grilled protein plates.",
  },
  {
    id: "food-green-garden",
    name: "Green Garden Salads",
    category: "food",
    description: "Healthy salads, grain bowls, and smoothies.",
  },
  {
    id: "food-night-owl-pizza",
    name: "Night Owl Pizza",
    category: "food",
    description: "Artisan pizzas, wings, and late-night snacks.",
  },
  {
    id: "shopping-arc-market",
    name: "Arc Market",
    category: "shopping",
    description: "General store for everyday items and digital goods.",
  },
];

class CommerceAgent {
  /**
   * Execute a low-level commerce action.
   * This is a simple wrapper today that can be expanded later to call
   * specific commerce workflows (marketplace, delivery, etc).
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'place-order':
      default:
        // For now we just echo back the structured intention.
        return {
          action: 'place-order',
          params,
        };
    }
  }

  /**
   * Handle a routed commerce request from the Agent Router.
   * This should NEVER throw – always return a friendly, helpful message.
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const intentText = request.intent.toLowerCase();

    // Basic classification inside commerce – can be extended later
    const isOrder =
      intentText.includes("order") ||
      intentText.includes("buy") ||
      intentText.includes("purchase");

    // Extract any entities we already have (amount, currency, etc.)
    const entities = request.entities || {};
    const amount = entities.amount;
    const currency = entities.currency || "USDC";
    const merchant = (entities as any).merchant || (entities as any).vendor;
    const context = request.context || {};

    if (isOrder) {
      // Try to get vendors from Supabase, fallback to in-memory list
      let vendors: Vendor[] = [];
      try {
        vendors = await getActiveVendors();
      } catch (error) {
        console.warn('[CommerceAgent] Failed to fetch vendors from Supabase, using fallback');
      }

      const lines: string[] = [];

      lines.push(
        "Got it – you want to place an order. I can help you pay one of our partner vendors or any other business using your ARCLE wallet."
      );

      if (vendors.length > 0 || FALLBACK_VENDORS.length > 0) {
        const vendorList = vendors.length > 0 ? vendors : FALLBACK_VENDORS;
        const byCategory: Record<string, any[]> = {
          food: [],
          shopping: [],
          services: [],
          other: [],
        };
        
        for (const v of vendorList) {
          const cat = (v.category || 'other').toLowerCase();
          const category = cat === 'food' || cat === 'shopping' || cat === 'services' ? cat : 'other';
          byCategory[category].push(v);
        }

        const categoryOrder: string[] = ["food", "shopping", "services", "other"];
        lines.push("Here are some of our current partner vendors:");
        categoryOrder.forEach((cat) => {
          if (!byCategory[cat].length) return;
          const label =
            cat === "food" ? "Food" : cat === "shopping" ? "Shopping" : cat === "services" ? "Services" : "Other";
          lines.push(`**${label}**`);
          byCategory[cat].forEach((v) => {
            const name = v.name || 'Unknown';
            const desc = v.description || '';
            lines.push(`- ${name}${desc ? ` – ${desc}` : ''}`);
          });
        });

        lines.push(
          "Tell me **what you want to order** (for example: a meal, groceries, a subscription, or a service), **which vendor** you'd like to pay, and the **amount**.\n\nExamples:\n" +
            "- \"Order from Night Owl Pizza for $25\"\n" +
            "- \"Buy tools from Arc Market for $40\"\n" +
            "- \"Pay a service provider $100\""
        );
      } else {
        lines.push(
          "I don't have specific partner vendors configured yet, but I can still help you pay any business. Just tell me who you're paying and for what."
        );
      }

      // Check if we have enough info to create an order
      const hasVendor = merchant || (entities as any).vendorId || (entities as any).vendor_id;
      const hasItems = (entities as any).items || (entities as any).orderItems;
      const hasDeliveryLocation = (entities as any).deliveryAddress || (entities as any).delivery_location;
      const userId = (context as any)?.userId;

      if (amount && hasVendor && userId) {
        // We have enough info - offer to create the order
        lines.push(
          `\n✅ I have all the details! I can create this order now:\n` +
          `- Vendor: ${merchant || 'Selected vendor'}\n` +
          `- Amount: ${amount} ${currency}\n` +
          (hasDeliveryLocation ? `- Delivery location: Provided\n` : '') +
          `\nSay "confirm" or "yes" to create the order and process payment.`
        );

        return {
          success: true,
          message: lines.join("\n\n"),
          agent: "commerce",
          action: "place-order",
          requiresConfirmation: true,
          data: {
            type: "order",
            amount,
            currency,
            merchant: merchant || hasVendor,
            vendorId: (entities as any).vendorId || (entities as any).vendor_id,
            items: hasItems || [{ name: 'Order', quantity: 1, price: amount }],
            deliveryAddress: hasDeliveryLocation,
            userId: userId,
            rawEntities: entities,
          },
        };
      }

      if (!amount) {
        lines.push(
          "To get started, tell me the **amount** for this order and who you are paying (name or business)."
        );
      } else if (!hasVendor) {
        lines.push(
          `I see an order amount of **${amount} ${currency}**. Which vendor would you like to order from?`
        );
      } else {
        lines.push(
          `I see an order amount of **${amount} ${currency}** for **${merchant}**. ` +
          (hasDeliveryLocation ? 'Delivery location provided. ' : 'Please share your delivery location. ') +
          `Say "confirm" to proceed.`
        );
      }

      return {
        success: true,
        message: lines.join("\n\n"),
        agent: "commerce",
        action: "place-order",
        requiresConfirmation: false,
        data: {
          type: "order",
          amount: amount || null,
          currency,
          merchant: merchant || null,
          vendors: vendors.length > 0 ? vendors : FALLBACK_VENDORS,
          rawEntities: entities,
        },
      };
    }

    // Fallback – commerce keywords matched but we don't understand the exact flow
    return {
      success: true,
      message:
        "You’re in ARCLE’s commerce flow. I can help you **place orders, create payment links, or send invoices**.\n\n" +
        "Try something like:\n" +
        "- \"Order food from a partner vendor\"\n" +
        "- \"Place an order for $50 to Nike\"\n" +
        "- \"Create a payment link for a client\"\n" +
        "- \"Send an invoice for design work\"",
      agent: "commerce",
      action: "commerce-help",
      requiresConfirmation: false,
    };
  }

  /**
   * Quick filter used by `canAgentHandle` helper –
   * helps avoid loading this agent for unrelated intents.
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    const commerceKeywords = [
      "order",
      "purchase",
      "buy",
      "delivery",
      "shipment",
      "food",
      "restaurant",
      "meal",
    ];
    const lower = intent.toLowerCase();
    return commerceKeywords.some((keyword) => lower.includes(keyword));
  }
}

const commerceAgent = new CommerceAgent();

export default commerceAgent;
export { CommerceAgent };

