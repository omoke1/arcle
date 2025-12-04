/**
 * Remittance Agent API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { RemittanceAgent } from '@/agents/remittance';

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

    const remittanceAgent = new RemittanceAgent();
    const result = await remittanceAgent.execute(action, params);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Remittance API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Remittance execution failed',
      },
      { status: 500 }
    );
  }
}

