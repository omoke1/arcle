/**
 * Cron Job: Process Auto-Deduct Contributions
 * 
 * Runs hourly to process pending auto-contributions for active savings goals.
 * 
 * To activate:
 * 1. Set CRON_SECRET in .env
 * 2. Add to vercel.json (see below)
 * 3. Or use Inngest/Trigger.dev for more reliability
 * 
 * vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-contributions",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
// NOTE: Prisma imports commented out until database is set up
// Uncomment these lines when activating database:
// import { prisma } from "@/lib/db/prisma";
// import { addContribution } from "@/lib/defi/goal-based-savings-db";
import { sendNotification } from "@/lib/notifications/notification-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret (security)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("[Cron] Unauthorized attempt to access cron job");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Starting contribution processing...");

  try {
    // TODO: Uncomment when database is activated
    /*
    // Find goals due for contribution
    const now = new Date();
    const { prisma } = await import("@/lib/db/prisma");
    const { addContribution } = await import("@/lib/defi/goal-based-savings-db");
    
    const dueGoals = await prisma.savingsGoal.findMany({
      where: {
        status: "active",
        autoDeduct: true,
        nextContributionAt: { lte: now },
        contributionAmount: { not: null },
      },
      include: {
        user: true,
      },
    });

    console.log(`[Cron] Found ${dueGoals.length} goals due for contribution`);
    */

    // Placeholder until database is activated
    const dueGoals: any[] = [];
    console.log(`[Cron] Database not activated yet - no goals to process`);

    const results: any[] = [];

    // TODO: Uncomment when database is activated
    /*
    for (const goal of dueGoals) {
      try {
        // Check user balance
        const balance = await getBalance(goal.walletId);
        const contributionAmount = parseFloat(goal.contributionAmount?.toString() || "0");

        if (parseFloat(balance) >= contributionAmount) {
          // Execute contribution
          console.log(`[Cron] Processing contribution for goal ${goal.id}: $${contributionAmount}`);
          
          // TODO: Actually transfer funds using Circle SDK
          // For now, just update database
          const result = await addContribution(goal.id, contributionAmount.toString());

          if (result.success) {
            // Send success notification
            await sendNotification(goal.userId, "contribution_success", {
              goalName: goal.goalName,
              amount: contributionAmount.toString(),
              goalId: goal.id,
            });

            results.push({
              goalId: goal.id,
              goalName: goal.goalName,
              amount: contributionAmount,
              status: "success",
            });

            console.log(`[Cron] ✅ Successfully processed contribution for goal ${goal.id}`);
          } else {
            throw new Error(result.error || "Failed to add contribution");
          }
        } else {
          // Insufficient balance
          console.log(`[Cron] ⚠️ Insufficient balance for goal ${goal.id}: $${balance} < $${contributionAmount}`);

          // Send low balance notification
          await sendNotification(goal.userId, "low_balance", {
            goalName: goal.goalName,
            amount: contributionAmount.toString(),
          });

          // Create pending contribution for retry
          await prisma.pendingContribution.create({
            data: {
              goalId: goal.id,
              userId: goal.userId,
              amount: contributionAmount,
              nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Retry in 24 hours
            },
          });

          results.push({
            goalId: goal.id,
            goalName: goal.goalName,
            amount: contributionAmount,
            status: "insufficient_balance",
          });
        }
      } catch (error: any) {
        console.error(`[Cron] ❌ Error processing goal ${goal.id}:`, error);

        // Send failure notification
        await sendNotification(goal.userId, "contribution_failed", {
          goalName: goal.goalName,
          amount: goal.contributionAmount?.toString() || "0",
          error: error.message,
        });

        results.push({
          goalId: goal.id,
          goalName: goal.goalName,
          status: "error",
          error: error.message,
        });
      }
    }
    */

    // TODO: Uncomment when database is activated
    /*
    // Check for matured goals (send notifications)
    const maturedGoals = await prisma.savingsGoal.findMany({
      where: {
        status: "active",
        maturityDate: { lte: now },
      },
      include: { user: true },
    });

    console.log(`[Cron] Found ${maturedGoals.length} matured goals`);

    for (const goal of maturedGoals) {
      await sendNotification(goal.userId, "goal_matured", {
        goalName: goal.goalName,
        goalId: goal.id,
      });
    }

    // Check for matured SafeLocks
    const maturedLocks = await prisma.safeLock.findMany({
      where: {
        status: "locked",
        maturityDate: { lte: now },
      },
      include: { user: true },
    });

    console.log(`[Cron] Found ${maturedLocks.length} matured SafeLocks`);

    for (const lock of maturedLocks) {
      await sendNotification(lock.userId, "safelock_matured", {
        safelockId: lock.id,
        amount: lock.amount.toString(),
      });
    }
    */

    // Placeholders
    const maturedGoals: any[] = [];
    const maturedLocks: any[] = [];

    console.log("[Cron] ✅ Contribution processing complete");

    return NextResponse.json({
      success: true,
      processed: results.length,
      maturedGoals: maturedGoals.length,
      maturedLocks: maturedLocks.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Cron] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Get wallet balance (helper)
 */
async function getBalance(walletId: string): Promise<string> {
  // TODO: Implement actual balance check using Circle API
  // For now, return mock balance
  
  // Example implementation:
  /*
  const response = await fetch(`${process.env.CIRCLE_API_URL}/v1/w3s/wallets/${walletId}/balances`, {
    headers: {
      'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
    },
  });
  const data = await response.json();
  const usdcBalance = data.tokenBalances?.find(t => t.token.symbol === 'USDC');
  return usdcBalance?.amount || '0';
  */
  
  return "1000"; // Mock balance for testing
}

