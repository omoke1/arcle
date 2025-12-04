import { NextRequest, NextResponse } from "next/server";
import { findUserDuePayments } from "@/lib/db/services/scheduledPayments";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const beforeParam = request.nextUrl.searchParams.get("before");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const beforeDate =
    beforeParam && !isNaN(Number(beforeParam))
      ? new Date(Number(beforeParam))
      : new Date();

  try {
    const payments = await findUserDuePayments(userId, beforeDate);
    return NextResponse.json({ payments });
  } catch (error: any) {
    console.error("[API] Failed to fetch due scheduled payments:", error);
    return NextResponse.json(
      { error: "Failed to fetch due scheduled payments" },
      { status: 500 }
    );
  }
}

