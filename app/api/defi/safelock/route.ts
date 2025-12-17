/**
 * SafeLock API Routes
 * Handles fixed deposit creation, early breaks, and maturity
 * Uses Supabase for persistence (production-ready)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createSafeLock,
  breakSafeLock,
  matureSafeLock,
  getSafeLocksByUser,
  getSafeLock,
  calculateSafeLockBreakdown,
  formatSafeLock,
  formatAllSafeLocks,
  getAvailableLockPeriods,
  formatAvailableLockPeriods,
  type SafeLockStatus,
} from "@/lib/defi/safelock-db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const safelockId = searchParams.get("safelockId");
    const status = searchParams.get("status") as SafeLockStatus | null;
    const action = searchParams.get("action");

    // Get available lock periods
    if (action === "periods") {
      const periods = getAvailableLockPeriods();
      const formatted = formatAvailableLockPeriods();

      return NextResponse.json({
        success: true,
        data: {
          periods,
          formatted,
        },
      });
    }

    // Get single SafeLock
    if (safelockId) {
      const safelock = await getSafeLock(safelockId);

      if (!safelock) {
        return NextResponse.json(
          { success: false, error: "SafeLock not found" },
          { status: 404 }
        );
      }

      const breakdown = calculateSafeLockBreakdown(safelock);
      const formatted = formatSafeLock(safelock);

      return NextResponse.json({
        success: true,
        data: {
          safelock,
          breakdown,
          formatted,
        },
      });
    }

    // Get all SafeLocks for user
    if (userId) {
      const safelocks = await getSafeLocksByUser(userId, status || undefined);
      const formatted = formatAllSafeLocks(safelocks);

      return NextResponse.json({
        success: true,
        data: {
          safelocks,
          count: safelocks.length,
          formatted,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Missing userId or safelockId" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[SafeLock API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      userId,
      walletId,
      amount,
      lockPeriod,
      safelockId,
    } = body;

    // Create new SafeLock
    if (action === "create") {
      if (!userId || !walletId || !amount || !lockPeriod) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: userId, walletId, amount, lockPeriod" },
          { status: 400 }
        );
      }

      const safelock = await createSafeLock({
        userId,
        walletId,
        amount,
        lockPeriod,
      });
      const breakdown = calculateSafeLockBreakdown(safelock);

      const maturityDate = new Date(safelock.maturity_date).toLocaleDateString();

      return NextResponse.json({
        success: true,
        data: {
          safelock,
          breakdown,
          message: `🔒 SafeLock created! $${amount} locked for ${lockPeriod} days at ${safelock.apy}% APY. Matures on ${maturityDate}.`,
        },
      });
    }

    // Break SafeLock early
    if (action === "break") {
      if (!safelockId) {
        return NextResponse.json(
          { success: false, error: "Missing safelockId" },
          { status: 400 }
        );
      }

      const breakdown = await breakSafeLock(safelockId);

      if (!breakdown) {
        return NextResponse.json(
          { success: false, error: "Could not break SafeLock" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          breakdown,
          message: `SafeLock broken. You received $${breakdown.netAmount} (Principal: $${breakdown.principal} - Penalty: $${breakdown.penalty} + Yield: $${breakdown.yieldEarned})`,
        },
      });
    }

    // Mature SafeLock
    if (action === "mature") {
      if (!safelockId) {
        return NextResponse.json(
          { success: false, error: "Missing safelockId" },
          { status: 400 }
        );
      }

      const breakdown = await matureSafeLock(safelockId);

      if (!breakdown) {
        return NextResponse.json(
          { success: false, error: "Could not mature SafeLock (not yet matured?)" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          breakdown,
          message: `🎉 SafeLock matured! You received $${breakdown.netAmount} (Principal: $${breakdown.principal} + Yield: $${breakdown.yieldEarned})`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[SafeLock API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}



