/**
 * Invoices API Route
 * 
 * GET /api/invoices - List all invoices
 * POST /api/invoices - Create new invoice
 * GET /api/invoices/:id - Get invoice by ID
 * PUT /api/invoices/:id - Update invoice
 * DELETE /api/invoices/:id - Delete invoice
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getInvoicesByStatus,
  getOverdueInvoices,
  getOutstandingInvoices,
  markInvoiceAsPaid,
  parseInvoiceFromText,
} from "@/lib/invoices/invoice-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const overdue = searchParams.get("overdue") === "true";
    const outstanding = searchParams.get("outstanding") === "true";
    
    // Get single invoice
    if (id) {
      const invoice = getInvoiceById(id);
      if (!invoice) {
        return NextResponse.json(
          { success: false, error: "Invoice not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: invoice });
    }
    
    // Get invoices by status
    if (status) {
      const invoices = getInvoicesByStatus(status as any);
      return NextResponse.json({ success: true, data: invoices });
    }
    
    // Get overdue invoices
    if (overdue) {
      const invoices = getOverdueInvoices();
      return NextResponse.json({ success: true, data: invoices });
    }
    
    // Get outstanding invoices
    if (outstanding) {
      const invoices = getOutstandingInvoices();
      return NextResponse.json({ success: true, data: invoices });
    }
    
    // Get all invoices
    const invoices = getAllInvoices();
    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch invoices",
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
      const parsed = parseInvoiceFromText(body.text);
      
      // Validate required fields
      if (!parsed.amount || !parsed.recipient) {
        return NextResponse.json(
          { success: false, error: "Missing required fields: amount and recipient" },
          { status: 400 }
        );
      }
      
      // Create invoice with parsed data
      const invoice = createInvoice({
        recipient: parsed.recipient!,
        recipientAddress: parsed.recipientAddress,
        amount: parsed.amount!,
        currency: parsed.currency || "USDC",
        description: parsed.description,
        dueDate: parsed.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days
        earlyPaymentDiscount: parsed.earlyPaymentDiscount,
        metadata: parsed.metadata,
      });
      
      return NextResponse.json({ success: true, data: invoice });
    }
    
    // Direct invoice creation
    const { recipient, recipientAddress, amount, currency, description, dueDate, earlyPaymentDiscount, metadata } = body;
    
    if (!recipient || !amount) {
      return NextResponse.json(
        { success: false, error: "recipient and amount are required" },
        { status: 400 }
      );
    }
    
    const invoice = createInvoice({
      recipient,
      recipientAddress,
      amount,
      currency: currency || "USDC",
      description,
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      earlyPaymentDiscount,
      metadata,
    });
    
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create invoice",
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
    
    // Special handling for marking as paid
    if (body.markAsPaid && body.paymentHash) {
      const invoice = markInvoiceAsPaid(id, body.paymentHash);
      if (!invoice) {
        return NextResponse.json(
          { success: false, error: "Invoice not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: invoice });
    }
    
    const invoice = updateInvoice(id, body);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update invoice",
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
    
    const deleted = deleteInvoice(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Invoice not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: "Invoice deleted" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete invoice",
      },
      { status: 500 }
    );
  }
}

