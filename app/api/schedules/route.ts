import { NextRequest, NextResponse } from "next/server";
import {
  createScheduledPayment,
  getUserScheduledPayments,
} from "@/lib/db/services/scheduledPayments";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const payments = await getUserScheduledPayments(userId);
    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error("[API] Failed to fetch scheduled payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled payments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletId, amount, currency = "USDC", toAddress, scheduledFor } = body;

    if (!userId || !walletId || !amount || !toAddress || !scheduledFor) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const scheduledDate =
      typeof scheduledFor === "number"
        ? new Date(scheduledFor)
        : new Date(scheduledFor);

    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledFor value" },
        { status: 400 }
      );
    }

    const payment = await createScheduledPayment({
      user_id: userId,
      wallet_id: walletId,
      amount,
      currency,
      to_address: toAddress,
      scheduled_for: scheduledDate.toISOString(),
    });

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error("[API] Failed to create scheduled payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create scheduled payment" },
      { status: 500 }
    );
  }
}

