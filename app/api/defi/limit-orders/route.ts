/**
 * Limit Orders API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createLimitOrder, checkLimitOrders, cancelLimitOrder, getLimitOrders } from "@/lib/defi/limit-orders";

export async function GET(request: NextRequest) {
  try {
    const orders = getLimitOrders();
    return NextResponse.json({ success: true, data: orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, fromToken, toToken, amount, targetPrice, chain, orderType, expiresInDays, orderId } = body;
    
    if (action === "create" && fromToken && toToken && amount && targetPrice && chain && orderType) {
      const order = createLimitOrder(
        fromToken,
        toToken,
        amount,
        targetPrice,
        chain,
        orderType,
        expiresInDays
      );
      return NextResponse.json({ success: true, data: order });
    }
    
    if (action === "check") {
      const executed = await checkLimitOrders();
      return NextResponse.json({ success: true, data: executed });
    }
    
    if (action === "cancel" && orderId) {
      const success = cancelLimitOrder(orderId);
      return NextResponse.json({ success, data: { orderId } });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

