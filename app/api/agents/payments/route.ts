/**
 * Payments Agent API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaymentsAgent } from '@/agents/payments';

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

    const paymentsAgent = new PaymentsAgent();
    const result = await paymentsAgent.execute(action, params);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Payments API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Payments execution failed',
      },
      { status: 500 }
    );
  }
}

