/**
 * Payment Roll API Route
 * 
 * GET /api/payment-roll - List all payment rolls
 * POST /api/payment-roll - Create new payment roll
 * GET /api/payment-roll/:id - Get payment roll by ID
 * PUT /api/payment-roll/:id - Update payment roll
 * DELETE /api/payment-roll/:id - Delete payment roll
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createPaymentRoll,
  getAllPaymentRolls,
  getPaymentRollById,
  updatePaymentRoll,
  deletePaymentRoll,
  getDuePaymentRolls,
  recordPaymentRollExecution,
  getExecutionsForPaymentRoll,
  parsePaymentRollFromText,
} from "@/lib/invoices/payment-roll";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const due = searchParams.get("due") === "true";
    const executions = searchParams.get("executions");
    
    // Get single payment roll
    if (id) {
      const roll = getPaymentRollById(id);
      if (!roll) {
        return NextResponse.json(
          { success: false, error: "Payment roll not found" },
          { status: 404 }
        );
      }
      
      // Include executions if requested
      if (executions === "true") {
        const rollExecutions = getExecutionsForPaymentRoll(id);
        return NextResponse.json({
          success: true,
          data: { ...roll, executions: rollExecutions },
        });
      }
      
      return NextResponse.json({ success: true, data: roll });
    }
    
    // Get due payment rolls
    if (due) {
      const rolls = getDuePaymentRolls();
      return NextResponse.json({ success: true, data: rolls });
    }
    
    // Get all payment rolls
    const rolls = getAllPaymentRolls();
    return NextResponse.json({ success: true, data: rolls });
  } catch (error) {
    console.error("Error fetching payment rolls:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch payment rolls",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if it's a natural language request
    if (body.text) {
      const parsed = parsePaymentRollFromText(body.text);
      
      // Validate required fields
      if (!parsed.recipients || parsed.recipients.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one recipient is required" },
          { status: 400 }
        );
      }
      
      // Create payment roll with parsed data
      const roll = createPaymentRoll({
        name: parsed.name || "Payment Roll",
        description: parsed.description,
        recipients: parsed.recipients,
        frequency: parsed.frequency || "monthly",
        nextPaymentDate: parsed.nextPaymentDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        currency: parsed.currency || "USDC",
        metadata: parsed.metadata,
      });
      
      return NextResponse.json({ success: true, data: roll });
    }
    
    // Direct payment roll creation
    const { name, description, recipients, frequency, nextPaymentDate, currency, metadata } = body;
    
    if (!name || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "name and recipients array are required" },
        { status: 400 }
      );
    }
    
    const roll = createPaymentRoll({
      name,
      description,
      recipients,
      frequency: frequency || "monthly",
      nextPaymentDate: nextPaymentDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      currency: currency || "USDC",
      metadata,
    });
    
    return NextResponse.json({ success: true, data: roll });
  } catch (error) {
    console.error("Error creating payment roll:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create payment roll",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Special handling for recording execution
    if (body.recordExecution) {
      const execution = recordPaymentRollExecution({
        paymentRollId: id,
        status: body.status || "pending",
        transactions: body.transactions || [],
      });
      return NextResponse.json({ success: true, data: execution });
    }
    
    const roll = updatePaymentRoll(id, body);
    if (!roll) {
      return NextResponse.json(
        { success: false, error: "Payment roll not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: roll });
  } catch (error) {
    console.error("Error updating payment roll:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update payment roll",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: "id parameter is required" },
        { status: 400 }
      );
    }
    
    const deleted = deletePaymentRoll(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Payment roll not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: "Payment roll deleted" });
  } catch (error) {
    console.error("Error deleting payment roll:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete payment roll",
      },
      { status: 500 }
    );
  }
}

