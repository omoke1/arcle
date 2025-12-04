/**
 * INERA Agent API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { INERAAgent } from '@/agents/inera';

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

    const inera = new INERAAgent();
    const result = await inera.execute({
      walletId: params.walletId || '',
      userId: params.userId || '',
      userToken: params.userToken || '',
      action,
      params: params || {},
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[INERA API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'INERA execution failed',
      },
      { status: 500 }
    );
  }
}

