/**
 * Notifications API Route
 * 
 * Handles notification management
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/notifications
 * Get all notifications
 */
export async function GET(request: NextRequest) {
  try {
    // This is a client-side only feature (localStorage)
    // For server-side, we'd need a database
    return NextResponse.json({
      success: true,
      message: "Notifications are managed client-side via localStorage. Use the notification service directly in the client.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      },
      { status: 500 }
    );
  }
}

