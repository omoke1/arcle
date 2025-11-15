/**
 * Limit Orders API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createLimitOrder, monitorAndExecuteOrders, cancelOrder, getOrdersByWallet, getPendingOrders } from "@/lib/defi/limit-orders";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");
    
    if (walletId) {
      const orders = getOrdersByWallet(walletId);
      return NextResponse.json({ success: true, data: orders });
    } else {
      const orders = getPendingOrders();
      return NextResponse.json({ success: true, data: orders });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, walletId, type, fromToken, toToken, amount, targetPrice, blockchain, expiryHours, slippageTolerance, orderId } = body;
    
    if (action === "create" && walletId && type && fromToken && toToken && amount && targetPrice && blockchain) {
      const order = createLimitOrder({
        walletId,
        type,
        fromToken,
        toToken,
        amount,
        targetPrice,
        blockchain,
        expiryHours,
        slippageTolerance,
      });
      return NextResponse.json({ success: true, data: order });
    }
    
    if (action === "check") {
      const executed = await monitorAndExecuteOrders();
      return NextResponse.json({ success: true, data: executed });
    }
    
    if (action === "cancel" && orderId) {
      const success = cancelOrder(orderId);
      return NextResponse.json({ success, data: { orderId } });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

