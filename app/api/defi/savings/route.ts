/**
 * Savings API Routes
 * Handles goal-based savings creation, contributions, and withdrawals
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createSavingsGoal,
  addContribution,
  breakSavingsEarly,
  matureSavingsGoal,
  getSavingsGoalsByUser,
  getSavingsGoal,
  calculateSavingsBreakdown,
  formatSavingsGoal,
  formatAllSavingsGoals,
  type SavingsFrequency,
} from "@/lib/defi/goal-based-savings";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const goalId = searchParams.get("goalId");

    if (goalId) {
      // Get single goal
      const goal = getSavingsGoal(goalId);
      
      if (!goal) {
        return NextResponse.json(
          { success: false, error: "Savings goal not found" },
          { status: 404 }
        );
      }

      const breakdown = calculateSavingsBreakdown(goal);
      const formatted = formatSavingsGoal(goal);

      return NextResponse.json({
        success: true,
        data: {
          goal,
          breakdown,
          formatted,
        },
      });
    }

    if (userId) {
      // Get all goals for user
      const goals = getSavingsGoalsByUser(userId);
      const formatted = formatAllSavingsGoals(goals);

      return NextResponse.json({
        success: true,
        data: {
          goals,
          count: goals.length,
          formatted,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Missing userId or goalId" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Savings API] Error:", error);
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
      goalName,
      goalCategory,
      targetAmount,
      initialDeposit,
      lockPeriod,
      contributionAmount,
      contributionFrequency,
      autoDeduct,
      reminderEnabled,
      goalId,
      amount,
    } = body;

    // Create new savings goal
    if (action === "create") {
      if (!userId || !walletId || !goalName || !targetAmount || !initialDeposit || !lockPeriod) {
        return NextResponse.json(
          { success: false, error: "Missing required fields" },
          { status: 400 }
        );
      }

      const goal = createSavingsGoal({
        userId,
        walletId,
        goalName,
        goalCategory,
        targetAmount,
        initialDeposit,
        lockPeriod,
        contributionAmount,
        contributionFrequency: contributionFrequency as SavingsFrequency,
        autoDeduct,
        reminderEnabled,
      });

      const breakdown = calculateSavingsBreakdown(goal);

      return NextResponse.json({
        success: true,
        data: {
          goal,
          breakdown,
          message: `Savings goal "${goalName}" created successfully!`,
        },
      });
    }

    // Add contribution
    if (action === "contribute") {
      if (!goalId || !amount) {
        return NextResponse.json(
          { success: false, error: "Missing goalId or amount" },
          { status: 400 }
        );
      }

      const result = addContribution(goalId, amount);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      const goal = getSavingsGoal(goalId);
      const breakdown = goal ? calculateSavingsBreakdown(goal) : null;

      return NextResponse.json({
        success: true,
        data: {
          newBalance: result.newBalance,
          breakdown,
          message: `Added $${amount} to your savings goal!`,
        },
      });
    }

    // Break savings early
    if (action === "break") {
      if (!goalId) {
        return NextResponse.json(
          { success: false, error: "Missing goalId" },
          { status: 400 }
        );
      }

      const breakdown = breakSavingsEarly(goalId);

      if (!breakdown) {
        return NextResponse.json(
          { success: false, error: "Could not break savings goal" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          breakdown,
          message: `Savings goal broken. You received $${breakdown.netAmount} (after $${breakdown.penalty} penalty).`,
        },
      });
    }

    // Mature savings
    if (action === "mature") {
      if (!goalId) {
        return NextResponse.json(
          { success: false, error: "Missing goalId" },
          { status: 400 }
        );
      }

      const breakdown = matureSavingsGoal(goalId);

      if (!breakdown) {
        return NextResponse.json(
          { success: false, error: "Could not mature savings goal (not yet matured?)" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          breakdown,
          message: `🎉 Savings goal matured! You received $${breakdown.netAmount} (Principal: $${breakdown.principal} + Yield: $${breakdown.yieldEarned})`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Savings API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
