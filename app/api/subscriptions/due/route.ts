import { NextRequest, NextResponse } from "next/server";
import {
  findDueSubscriptions,
  findDueReminders,
} from "@/lib/db/services/subscriptions";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const type = request.nextUrl.searchParams.get("type") || "charge";

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    if (type === "reminder") {
      const reminders = await findDueReminders(undefined, undefined, userId);
      return NextResponse.json({ subscriptions: reminders });
    }

    const charges = await findDueSubscriptions(undefined, userId);
    return NextResponse.json({ subscriptions: charges });
  } catch (error: any) {
    console.error("[API] Failed to fetch due subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch due subscriptions" },
      { status: 500 }
    );
  }
}

