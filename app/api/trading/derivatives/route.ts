/**
 * Derivatives Trading API Route
 * 
 * GET /api/trading/derivatives - List positions/orders
 * POST /api/trading/derivatives - Open position or create order
 * PUT /api/trading/derivatives - Close position or update order
 */

import { NextRequest, NextResponse } from "next/server";
import {
  openPerpetualPosition,
  closePerpetualPosition,
  getAllPerpetualPositions,
  getAllOptionsPositions,
  getAllTradingOrders,
  createTradingOrder,
  createOptionsPosition,
  checkLiquidations,
} from "@/lib/trading/derivatives";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "perpetual", "options", "orders"
    const checkLiquidationsParam = searchParams.get("checkLiquidations") === "true";
    
    // Check for liquidations
    if (checkLiquidationsParam) {
      const liquidated = checkLiquidations();
      return NextResponse.json({
        success: true,
        data: {
          liquidated,
          count: liquidated.length,
        },
      });
    }
    
    // Get perpetual positions
    if (!type || type === "perpetual") {
      const positions = getAllPerpetualPositions();
      return NextResponse.json({ success: true, data: positions });
    }
    
    // Get options positions
    if (type === "options") {
      const positions = getAllOptionsPositions();
      return NextResponse.json({ success: true, data: positions });
    }
    
    // Get trading orders
    if (type === "orders") {
      const orders = getAllTradingOrders();
      return NextResponse.json({ success: true, data: orders });
    }
    
    return NextResponse.json(
      { success: false, error: "Invalid type parameter" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching derivatives data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch derivatives data",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;
    
    // Open perpetual position
    if (type === "perpetual") {
      const { pair, side, size, leverage, margin } = params;
      
      if (!pair || !side || !size || !leverage || !margin) {
        return NextResponse.json(
          { success: false, error: "pair, side, size, leverage, and margin are required" },
          { status: 400 }
        );
      }
      
      const position = openPerpetualPosition(pair, side, size, leverage, margin);
      return NextResponse.json({ success: true, data: position });
    }
    
    // Create options position
    if (type === "options") {
      const { optionType, underlying, strikePrice, expiryDate, premium, quantity } = params;
      
      if (!optionType || !underlying || !strikePrice || !expiryDate || !premium || !quantity) {
        return NextResponse.json(
          { success: false, error: "optionType, underlying, strikePrice, expiryDate, premium, and quantity are required" },
          { status: 400 }
        );
      }
      
      const position = createOptionsPosition(
        optionType,
        underlying,
        strikePrice,
        expiryDate,
        premium,
        quantity
      );
      return NextResponse.json({ success: true, data: position });
    }
    
    // Create trading order
    if (type === "order") {
      const { orderType, pair, side, amount, price, stopLoss, takeProfit } = params;
      
      if (!orderType || !pair || !side || !amount) {
        return NextResponse.json(
          { success: false, error: "orderType, pair, side, and amount are required" },
          { status: 400 }
        );
      }
      
      const order = createTradingOrder({
        type: orderType,
        pair,
        side,
        amount,
        price,
        stopLoss,
        takeProfit,
      });
      return NextResponse.json({ success: true, data: order });
    }
    
    return NextResponse.json(
      { success: false, error: "Invalid type. Use 'perpetual', 'options', or 'order'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error creating derivatives position/order:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create position/order",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action"); // "close"
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    if (action === "close") {
      const body = await request.json();
      const { exitPrice } = body;
      
      const position = closePerpetualPosition(id, exitPrice);
      if (!position) {
        return NextResponse.json(
          { success: false, error: "Position not found or already closed" },
          { status: 404 }
        );
      }
      
      return NextResponse.json({ success: true, data: position });
    }
    
    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating position:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update position",
      },
      { status: 500 }
    );
  }
}

