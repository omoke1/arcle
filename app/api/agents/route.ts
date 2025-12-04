/**
 * Agents API Route
 * 
 * Routes requests to appropriate agents via Agent Router
 */

import { NextRequest, NextResponse } from 'next/server';
import { routeToAgent } from '@/core/routing/agentRouter';
import type { AgentRequest } from '@/core/routing/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { message, intent, entities, context, sessionId } = body;

    // Build agent request
    const agentRequest: AgentRequest = {
      intent: intent || message || '',
      entities: entities || {},
      context: context || {},
      sessionId: sessionId || undefined,
    };

    // Route to appropriate agent
    const response = await routeToAgent(agentRequest);

    return NextResponse.json({
      success: response.success,
      message: response.message,
      agent: response.agent,
      action: response.action,
      requiresConfirmation: response.requiresConfirmation,
      data: response.data,
      error: response.error,
    });
  } catch (error: any) {
    console.error('[Agents API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'An error occurred while processing your request',
        agent: 'inera',
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
