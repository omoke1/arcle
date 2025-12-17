/**
 * Notifications API Route
 * 
 * Handles notification management using Supabase
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getUserNotifications,
  getUnreadNotifications,
  getNotificationsByType,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAllAsRead,
  type Notification,
  type CreateNotificationData,
} from "@/lib/db/services/notifications";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Get user ID from request header
 */
async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const userId = request.headers.get("x-arcle-user-id");
  if (!userId) return null;

  // Verify user exists in Supabase
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 * 
 * Query params:
 * - unread: boolean (only unread notifications)
 * - type: 'transaction' | 'payment' | 'invoice' | 'remittance' | 'subscription' | 'system'
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - count: boolean (return unread count only)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Missing or invalid user ID." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const type = searchParams.get("type") as Notification["type"] | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const countOnly = searchParams.get("count") === "true";

    // Return unread count only
    if (countOnly) {
      const unreadCount = await getUnreadCount(userId);
      return NextResponse.json({
        success: true,
        count: unreadCount,
      });
    }

    // Get notifications based on filters
    let notifications: Notification[] = [];

    if (unreadOnly) {
      notifications = await getUnreadNotifications(userId, limit);
    } else if (type) {
      notifications = await getNotificationsByType(userId, type, limit);
    } else {
      notifications = await getUserNotifications(userId, limit, offset);
    }

    // Get unread count for metadata
    const unreadCount = await getUnreadCount(userId);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("[Notifications API] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification
 * 
 * Body:
 * - type: Notification type
 * - title: string
 * - message: string
 * - action_url?: string
 * - priority?: 'low' | 'normal' | 'high' | 'urgent'
 * - metadata?: any
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Missing or invalid user ID." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, title, message, action_url, priority, metadata } = body;

    // Validate required fields
    if (!type || !title || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: type, title, message",
        },
        { status: 400 }
      );
    }

    // Validate notification type
    const validTypes: Notification["type"][] = [
      "transaction",
      "payment",
      "invoice",
      "remittance",
      "subscription",
      "system",
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const notificationData: CreateNotificationData = {
      user_id: userId,
      type,
      title,
      message,
      action_url,
      priority,
      metadata,
    };

    const notification = await createNotification(notificationData);

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[Notifications API] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create notification",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark notification(s) as read
 * 
 * Body:
 * - id?: string (mark specific notification as read)
 * - all?: boolean (mark all notifications as read)
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Missing or invalid user ID." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, all } = body;

    if (all) {
      // Mark all notifications as read
      const success = await markAllAsRead(userId);
      if (!success) {
        return NextResponse.json(
          { success: false, error: "Failed to mark all notifications as read" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    } else if (id) {
      // Mark specific notification as read
      const notification = await markAsRead(id);
      return NextResponse.json({
        success: true,
        notification,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: id or all",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Notifications API] PATCH error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update notification",
      },
      { status: 500 }
    );
  }
}

