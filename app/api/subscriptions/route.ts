import { NextRequest, NextResponse } from "next/server";
import {
  createSubscription,
  getUserSubscriptions,
} from "@/lib/db/services/subscriptions";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const subscriptions = await getUserSubscriptions(userId);
    return NextResponse.json({ subscriptions });
  } catch (error: any) {
    console.error("[API] Failed to fetch subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      walletId,
      merchant,
      amount,
      currency = "USDC",
      frequency,
      dayOfMonth,
      weekday,
      nextChargeAt,
      autoRenew = true,
      remindBeforeMs,
    } = body;

    if (!userId || !walletId || !merchant || !amount || !frequency || !nextChargeAt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const nextChargeDate =
      typeof nextChargeAt === "number"
        ? new Date(nextChargeAt)
        : new Date(nextChargeAt);

    if (isNaN(nextChargeDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid nextChargeAt value" },
        { status: 400 }
      );
    }

    const subscription = await createSubscription({
      user_id: userId,
      wallet_id: walletId,
      merchant,
      amount,
      currency,
      frequency,
      day_of_month: dayOfMonth,
      weekday,
      next_charge_at: nextChargeDate.toISOString(),
      auto_renew: autoRenew,
      remind_before_ms: remindBeforeMs,
    });

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error("[API] Failed to create subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create subscription" },
      { status: 500 }
    );
  }
}

