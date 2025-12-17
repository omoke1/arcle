/**
 * Remittances API Route
 * 
 * GET /api/remittances - List all remittances
 * POST /api/remittances - Create new remittance
 * GET /api/remittances/:id - Get remittance by ID
 * PUT /api/remittances/:id - Update remittance
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createRemittance,
  getAllRemittances,
  getRemittanceById,
  updateRemittance,
  markRemittanceAsCompleted,
  getAllRemittanceRecipients,
  saveRemittanceRecipient,
  parseRemittanceFromText,
} from "@/lib/remittances/remittance-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const recipients = searchParams.get("recipients") === "true";
    const userId = searchParams.get("userId") || request.headers.get("x-user-id");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }
    
    // Get recipients
    if (recipients) {
      const recipientList = await getAllRemittanceRecipients(userId);
      return NextResponse.json({ success: true, data: recipientList });
    }
    
    // Get single remittance
    if (id) {
      const remittance = await getRemittanceById(id);
      if (!remittance) {
        return NextResponse.json(
          { success: false, error: "Remittance not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: remittance });
    }
    
    // Get all remittances
    const remittances = await getAllRemittances(userId);
    return NextResponse.json({ success: true, data: remittances });
  } catch (error) {
    console.error("Error fetching remittances:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch remittances",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.userId || request.headers.get("x-user-id");
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }
    
    // Check if it's a natural language request
    if (body.text) {
      const parsed = parseRemittanceFromText(body.text);
      
      // Validate required fields
      if (!parsed.amount || !parsed.recipientName || !parsed.recipientCountry) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: amount, recipientName, and recipientCountry" },
          { status: 400 }
        );
      }
      
      // Create remittance with parsed data
      const remittance = await createRemittance({
        userId,
        recipientName: parsed.recipientName!,
        recipientAddress: parsed.recipientAddress,
        recipientCountry: parsed.recipientCountry!,
        ...(parsed.recipientCurrency && { recipientCurrency: parsed.recipientCurrency }),
        amount: parsed.amount!,
        metadata: parsed.metadata,
      });
      
      return NextResponse.json({ success: true, data: remittance });
    }
    
    // Direct remittance creation
    const { recipientName, recipientAddress, recipientCountry, recipientCurrency, amount, metadata } = body;
    
    if (!recipientName || !recipientCountry || !amount) {
      return NextResponse.json(
        { success: false, error: "recipientName, recipientCountry, and amount are required" },
        { status: 400 }
      );
    }
    
    const remittance = await createRemittance({
      userId,
      recipientName,
      recipientAddress,
      recipientCountry,
      recipientCurrency,
      amount,
      metadata,
    });
    
    return NextResponse.json({ success: true, data: remittance });
  } catch (error) {
    console.error("Error creating remittance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create remittance",
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
    
    // Special handling for marking as completed
    if (body.markAsCompleted && body.transactionHash) {
      const remittance = await markRemittanceAsCompleted(id, body.transactionHash);
      if (!remittance) {
        return NextResponse.json(
          { success: false, error: "Remittance not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: remittance });
    }
    
    const remittance = await updateRemittance(id, body);
    if (!remittance) {
      return NextResponse.json(
        { success: false, error: "Remittance not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: remittance });
  } catch (error) {
    console.error("Error updating remittance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update remittance",
      },
      { status: 500 }
    );
  }
}

