/**
 * Dispatch Agent
 *
 * Handles order dispatch, rider assignment, and delivery tracking.
 * Works with vendor orders to assign dispatchers and track delivery status.
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import {
  findAvailableDispatcher,
  createDispatchJob,
  updateDispatchJobStatus,
  type Dispatcher,
  type DispatchJob,
} from '@/lib/db/services/dispatch';
import {
  getVendorOrderById,
  updateVendorOrderStatus,
  type VendorOrder,
} from '@/lib/db/services/vendors';

class DispatchAgent {
  /**
   * Handle dispatch-related intents.
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const intentText = request.intent.toLowerCase();
    const entities = request.entities || {};
    const context = request.context || {};

    // Check for dispatch-related keywords
    const isAssign = intentText.includes('assign') || intentText.includes('dispatch');
    const isTrack = intentText.includes('track') || intentText.includes('delivery') || intentText.includes('rider');
    const isUpdate = intentText.includes('update') || intentText.includes('status');
    const orderId = (entities as any).orderId || (entities as any).order_id;

    // Assign dispatcher to an order
    if (isAssign && orderId) {
      return await this.handleAssignDispatcher(orderId, context);
    }

    // Track delivery status
    if (isTrack && orderId) {
      return await this.handleTrackDelivery(orderId);
    }

    // Update dispatch status (for dispatchers/riders)
    if (isUpdate && orderId) {
      return await this.handleUpdateStatus(orderId, entities, context);
    }

    // Fallback - help message
    return {
      success: true,
      message:
        "I can help with dispatch and delivery tracking. Try:\n" +
        "- \"Assign a rider to order #123\"\n" +
        "- \"Track delivery for order #123\"\n" +
        "- \"Update delivery status for order #123\"",
      agent: 'dispatch',
      action: 'dispatch-help',
      requiresConfirmation: false,
    };
  }

  /**
   * Assign a dispatcher to an order.
   */
  private async handleAssignDispatcher(
    orderId: string,
    context: AgentRequest['context']
  ): Promise<AgentResponse> {
    try {
      // Get the order
      const order = await getVendorOrderById(orderId);
      if (!order) {
        return {
          success: false,
          message: `Order ${orderId} not found.`,
          agent: 'dispatch',
          error: 'Order not found',
        };
      }

      // Check if order is ready for dispatch
      if (order.status !== 'ready') {
        return {
          success: false,
          message: `Order ${order.order_number} is not ready for dispatch. Current status: ${order.status}.`,
          agent: 'dispatch',
          error: 'Order not ready',
        };
      }

      // Find available dispatcher
      const dispatcher = await findAvailableDispatcher(order.delivery_address ? undefined : undefined);
      if (!dispatcher) {
        return {
          success: false,
          message: 'No available dispatchers at the moment. Please try again later.',
          agent: 'dispatch',
          error: 'No dispatchers available',
        };
      }

      // Create dispatch job
      const dispatchJob = await createDispatchJob({
        orderId: order.id,
        dispatcherId: dispatcher.id,
        deliveryLatitude: order.delivery_latitude ? parseFloat(order.delivery_latitude) : undefined,
        deliveryLongitude: order.delivery_longitude ? parseFloat(order.delivery_longitude) : undefined,
        estimatedArrivalTime: this.calculateETA(order, dispatcher),
      });

      // Update order status
      await updateVendorOrderStatus({
        orderId: order.id,
        status: 'dispatched',
        dispatcherId: dispatcher.id,
      });

      return {
        success: true,
        message: `✅ Rider assigned! Dispatcher **${dispatcher.name}** has been assigned to order ${order.order_number}.\n\n` +
          `Estimated delivery time: ${this.formatETA(dispatchJob.estimated_arrival_time)}`,
        agent: 'dispatch',
        action: 'assign-dispatcher',
        requiresConfirmation: false,
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          dispatcherId: dispatcher.id,
          dispatcherName: dispatcher.name,
          dispatchJobId: dispatchJob.id,
          estimatedArrival: dispatchJob.estimated_arrival_time,
        },
      };
    } catch (error: any) {
      console.error('[DispatchAgent] Error assigning dispatcher:', error);
      return {
        success: false,
        message: 'Failed to assign dispatcher. Please try again.',
        agent: 'dispatch',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Track delivery status for an order.
   */
  private async handleTrackDelivery(orderId: string): Promise<AgentResponse> {
    try {
      const order = await getVendorOrderById(orderId);
      if (!order) {
        return {
          success: false,
          message: `Order ${orderId} not found.`,
          agent: 'dispatch',
          error: 'Order not found',
        };
      }

      if (order.status === 'delivered') {
        return {
          success: true,
          message: `✅ Order ${order.order_number} has been delivered!`,
          agent: 'dispatch',
          action: 'track-delivery',
          data: { order, status: 'delivered' },
        };
      }

      if (order.status === 'dispatched' && order.dispatcher_id) {
        return {
          success: true,
          message: `🚚 Order ${order.order_number} is out for delivery!\n\n` +
            `Status: ${order.status}\n` +
            (order.estimated_delivery_time
              ? `Estimated arrival: ${this.formatETA(order.estimated_delivery_time)}\n`
              : '') +
            `You'll be notified when it arrives.`,
          agent: 'dispatch',
          action: 'track-delivery',
          data: { order, status: 'in-transit' },
        };
      }

      return {
        success: true,
        message: `Order ${order.order_number} status: **${order.status}**\n\n` +
          (order.status === 'pending' ? 'Waiting for vendor to accept...' : '') +
          (order.status === 'preparing' ? 'Vendor is preparing your order...' : '') +
          (order.status === 'ready' ? 'Order is ready! Waiting for dispatch...' : ''),
        agent: 'dispatch',
        action: 'track-delivery',
        data: { order, status: order.status },
      };
    } catch (error: any) {
      console.error('[DispatchAgent] Error tracking delivery:', error);
      return {
        success: false,
        message: 'Failed to track delivery. Please try again.',
        agent: 'dispatch',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Update dispatch status (for dispatchers updating their location/status).
   */
  private async handleUpdateStatus(
    orderId: string,
    entities: Record<string, any>,
    context: AgentRequest['context']
  ): Promise<AgentResponse> {
    try {
      const order = await getVendorOrderById(orderId);
      if (!order) {
        return {
          success: false,
          message: `Order ${orderId} not found.`,
          agent: 'dispatch',
          error: 'Order not found',
        };
      }

      const newStatus = (entities as any).status || (entities as any).newStatus;
      const latitude = (entities as any).latitude || (entities as any).lat;
      const longitude = (entities as any).longitude || (entities as any).lng;

      // Map status updates
      let dispatchStatus: 'picked_up' | 'in_transit' | 'delivered' | 'cancelled' | 'failed' | undefined;
      let orderStatus: 'dispatched' | 'delivered' | 'cancelled' | undefined;

      if (newStatus) {
        const statusLower = newStatus.toLowerCase();
        if (statusLower.includes('picked') || statusLower.includes('pickup')) {
          dispatchStatus = 'picked_up';
        } else if (statusLower.includes('transit') || statusLower.includes('on the way')) {
          dispatchStatus = 'in_transit';
        } else if (statusLower.includes('delivered') || statusLower.includes('arrived')) {
          dispatchStatus = 'delivered';
          orderStatus = 'delivered';
        } else if (statusLower.includes('cancel')) {
          dispatchStatus = 'cancelled';
          orderStatus = 'cancelled';
        }
      }

      // Update dispatch job if exists
      if (order.dispatcher_id) {
        // Find dispatch job for this order
        // Note: We'd need a helper function to get dispatch job by order_id
        // For now, we'll update the order status directly
      }

      if (orderStatus) {
        await updateVendorOrderStatus({
          orderId: order.id,
          status: orderStatus,
          deliveredAt: orderStatus === 'delivered' ? new Date().toISOString() : undefined,
        });
      }

      return {
        success: true,
        message: `✅ Order ${order.order_number} status updated to: **${orderStatus || order.status}**`,
        agent: 'dispatch',
        action: 'update-status',
        data: { orderId: order.id, status: orderStatus || order.status },
      };
    } catch (error: any) {
      console.error('[DispatchAgent] Error updating status:', error);
      return {
        success: false,
        message: 'Failed to update status. Please try again.',
        agent: 'dispatch',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Calculate estimated time of arrival.
   */
  private calculateETA(order: VendorOrder, dispatcher: Dispatcher): string | undefined {
    // Simple ETA calculation: 25-30 minutes for food delivery
    // In production, this would use actual distance/routing
    const minutes = 25 + Math.floor(Math.random() * 5); // 25-30 minutes
    const eta = new Date();
    eta.setMinutes(eta.getMinutes() + minutes);
    return eta.toISOString();
  }

  /**
   * Format ETA for display.
   */
  private formatETA(eta: string | null | undefined): string {
    if (!eta) return 'TBD';
    try {
      const date = new Date(eta);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);
      
      if (diffMins < 0) return 'Arriving soon';
      if (diffMins < 60) return `~${diffMins} minutes`;
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    } catch {
      return 'TBD';
    }
  }

  /**
   * Check if this agent can handle the intent.
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    const dispatchKeywords = [
      'dispatch',
      'rider',
      'delivery',
      'track',
      'assign',
      'dispatcher',
      'courier',
    ];
    const lower = intent.toLowerCase();
    return dispatchKeywords.some((keyword) => lower.includes(keyword));
  }
}

const dispatchAgent = new DispatchAgent();

export default dispatchAgent;
export { DispatchAgent };

