/**
 * Savings Management API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createSavingsAccount, depositToSavings, getSavingsAccounts, calculateInterest } from "@/lib/defi/savings-management";

export async function GET(request: NextRequest) {
  try {
    const accounts = getSavingsAccounts();
    return NextResponse.json({ success: true, data: accounts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, name, initialDeposit, riskTolerance, accountId, amount } = body;
    
    if (action === "create" && name && initialDeposit) {
      const account = await createSavingsAccount(name, initialDeposit, riskTolerance || "low");
      return NextResponse.json({ success: true, data: account });
    }
    
    if (action === "deposit" && accountId && amount) {
      const result = await depositToSavings(accountId, amount);
      return NextResponse.json({ success: result.success, data: result });
    }
    
    if (action === "calculate-interest" && accountId) {
      const accounts = getSavingsAccounts();
      const account = accounts.find(a => a.id === accountId);
      if (!account) {
        return NextResponse.json({ success: false, error: "Account not found" }, { status: 404 });
      }
      const interest = calculateInterest(account);
      return NextResponse.json({ success: true, data: { interest, account } });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

