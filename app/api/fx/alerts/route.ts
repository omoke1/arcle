/**
 * FX Rate Alerts API Route
 * 
 * GET /api/fx/alerts - List all alerts
 * POST /api/fx/alerts - Create new alert
 * DELETE /api/fx/alerts/:id - Cancel alert
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createFXRateAlert,
  getAllFXAlerts,
  cancelFXAlert,
  checkFXAlerts,
} from "@/lib/fx/fx-market-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get("check") === "true";
    
    // Check and trigger alerts
    if (check) {
      const triggered = await checkFXAlerts();
      return NextResponse.json({
        success: true,
        data: {
          triggered,
          message: triggered.length > 0 ? `${triggered.length} alert(s) triggered` : "No alerts triggered",
        },
      });
    }
    
    // Get all alerts
    const alerts = getAllFXAlerts();
    return NextResponse.json({ success: true, data: alerts });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch alerts",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pair, targetRate, direction } = body;
    
    if (!pair || !targetRate || !direction) {
      return NextResponse.json(
        { success: false, error: "pair, targetRate, and direction are required" },
        { status: 400 }
      );
    }
    
    if (direction !== "above" && direction !== "below") {
      return NextResponse.json(
        { success: false, error: "direction must be 'above' or 'below'" },
        { status: 400 }
      );
    }
    
    const alert = createFXRateAlert(pair, targetRate, direction);
    
    return NextResponse.json({ success: true, data: alert });
  } catch (error) {
    console.error("Error creating alert:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create alert",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    const cancelled = cancelFXAlert(id);
    if (!cancelled) {
      return NextResponse.json(
        { success: false, error: "Alert not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: "Alert cancelled" });
  } catch (error) {
    console.error("Error cancelling alert:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel alert",
      },
      { status: 500 }
    );
  }
}

