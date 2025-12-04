/**
 * Invoice Agent API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { InvoiceAgent } from '@/agents/invoice';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    const invoiceAgent = new InvoiceAgent();
    const result = await invoiceAgent.execute(action, params);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Invoice API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Invoice execution failed',
      },
      { status: 500 }
    );
  }
}

