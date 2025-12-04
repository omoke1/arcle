import { NextRequest, NextResponse } from "next/server";
import {
  updateSubscription,
  deleteSubscription,
} from "@/lib/db/services/subscriptions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  const { subscriptionId } = params;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Missing subscriptionId" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const {
      paused,
      autoRenew,
      nextChargeAt,
      lastReminderShownAt,
      amount,
      merchant,
    } = body;

    const updates: any = {};
    if (typeof paused === "boolean") updates.paused = paused;
    if (typeof autoRenew === "boolean") updates.auto_renew = autoRenew;
    if (nextChargeAt) {
      const date =
        typeof nextChargeAt === "number"
          ? new Date(nextChargeAt)
          : new Date(nextChargeAt);
      updates.next_charge_at = date.toISOString();
    }
    if (lastReminderShownAt) {
      const date =
        typeof lastReminderShownAt === "number"
          ? new Date(lastReminderShownAt)
          : new Date(lastReminderShownAt);
      updates.last_reminder_shown_at = date.toISOString();
    }
    if (amount) updates.amount = amount;
    if (merchant) updates.merchant = merchant;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const subscription = await updateSubscription(subscriptionId, updates);
    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error("[API] Failed to update subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { subscriptionId: string } }
) {
  const { subscriptionId } = params;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Missing subscriptionId" },
      { status: 400 }
    );
  }

  try {
    await deleteSubscription(subscriptionId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Failed to delete subscription:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}

