import { NextRequest, NextResponse } from "next/server";
import {
  updateScheduledPayment,
  deleteScheduledPayment,
} from "@/lib/db/services/scheduledPayments";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { scheduleId } = params;

  if (!scheduleId) {
    return NextResponse.json({ error: "Missing scheduleId" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      status,
      transactionHash,
      failureReason,
      scheduledFor,
      amount,
      currency,
    } = body;

    const updates: any = {};
    if (status) updates.status = status;
    if (transactionHash) updates.transaction_hash = transactionHash;
    if (failureReason) updates.failure_reason = failureReason;
    if (scheduledFor) {
      const date =
        typeof scheduledFor === "number"
          ? new Date(scheduledFor)
          : new Date(scheduledFor);
      updates.scheduled_for = date.toISOString();
    }
    if (amount) updates.amount = amount;
    if (currency) updates.currency = currency;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid updates provided" },
        { status: 400 }
      );
    }

    const payment = await updateScheduledPayment(scheduleId, updates);
    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error("[API] Failed to update scheduled payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update scheduled payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  const { scheduleId } = params;

  if (!scheduleId) {
    return NextResponse.json({ error: "Missing scheduleId" }, { status: 400 });
  }

  try {
    await deleteScheduledPayment(scheduleId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API] Failed to delete scheduled payment:", error);
    return NextResponse.json(
      { error: "Failed to delete scheduled payment" },
      { status: 500 }
    );
  }
}

