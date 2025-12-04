/**
 * INERA - Core Finance Agent
 * 
 * Orchestrates all financial flows, executes via session keys
 */

import { executeViaSessionKey, getSessionKeyStatus } from './sessionKeys';
import { executeWorkflow } from './workflows';
import { formatExecutionResult, validateWalletActionParams } from './utils';
import type { WalletActionParams, ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import type { WorkflowDefinition, WorkflowResult } from '@/core/workflows/types';
import type { AgentRequest, AgentResponse } from '@/core/routing/types';

export interface INERAExecuteParams {
  walletId: string;
  userId: string;
  userToken: string;
  action: string;
  params: Record<string, any>;
  agentId?: string; // Which agent is requesting this (for per-agent session keys)
}

export interface INERABatchParams {
  walletId: string;
  userId: string;
  userToken: string;
  operations: Array<{ action: string; params: Record<string, any> }>;
}

class INERAAgent {
  /**
   * Execute a payment
   */
  async executePayment(params: {
    walletId: string;
    userId: string;
    userToken: string;
    amount: string;
    destinationAddress: string;
    agentId?: string; // Which agent is requesting this
  }): Promise<ExecutionResult> {
    const walletParams: WalletActionParams = {
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      action: 'transfer',
      amount: params.amount,
      destinationAddress: params.destinationAddress,
      agentId: params.agentId, // Pass agentId for per-agent session keys
    };

    return await executeViaSessionKey(walletParams);
  }

  /**
   * Execute a bridge operation
   */
  async executeBridge(params: {
    walletId: string;
    userId: string;
    userToken: string;
    amount: string;
    fromChain: string;
    toChain: string;
    destinationAddress: string;
  }): Promise<ExecutionResult> {
    const walletParams: WalletActionParams = {
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      action: 'bridge',
      amount: params.amount,
      fromChain: params.fromChain,
      toChain: params.toChain,
      destinationAddress: params.destinationAddress,
    };

    return await executeViaSessionKey(walletParams);
  }

  /**
   * Execute a batch of operations
   */
  async executeBatch(params: INERABatchParams): Promise<WorkflowResult> {
    const workflow: WorkflowDefinition = {
      id: `batch-${Date.now()}`,
      steps: params.operations.map((op) => ({
        agent: 'inera',
        action: op.action,
        params: {
          ...op.params,
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
        },
      })),
    };

    return await executeWorkflow(workflow);
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: WorkflowDefinition, context?: Record<string, any>): Promise<WorkflowResult> {
    return await executeWorkflow(workflow, context);
  }

  /**
   * Delegate to another agent
   */
  async delegateToAgent(agentName: string, action: string, params: Record<string, any>): Promise<any> {
    try {
      const agentModule = await import(`@/agents/${agentName}/index`);
      const agent = agentModule.default || agentModule;
      
      if (!agent || typeof agent.execute !== 'function') {
        throw new Error(`Agent ${agentName} not found or invalid`);
      }

      return await agent.execute(action, params);
    } catch (error: any) {
      throw new Error(`Failed to delegate to agent ${agentName}: ${error.message}`);
    }
  }

  /**
   * Execute a generic action
   */
  async execute(params: INERAExecuteParams): Promise<ExecutionResult> {
    const validation = validateWalletActionParams({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      action: params.action,
    });

    if (!validation.valid) {
      return {
        success: false,
        executedViaSessionKey: false,
        error: validation.error,
      };
    }

    const walletParams: WalletActionParams = {
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      action: params.action as any,
      agentId: params.agentId, // Pass agentId for per-agent session keys
      ...params.params,
    };

    return await executeViaSessionKey(walletParams);
  }

  /**
   * Handle agent request (for routing)
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    // INERA handles orchestration requests
    if (!request.context?.walletId || !request.context?.userId || !request.context?.userToken) {
      return {
        success: false,
        message: 'Wallet authentication required',
        agent: 'inera',
        error: 'Missing wallet context',
      };
    }

    // Check session key status
    const sessionStatus = await getSessionKeyStatus(
      request.context.walletId,
      request.context.userId,
      request.context.userToken
    );

    if (!sessionStatus.hasActiveSession) {
      return {
        success: false,
        message: 'No active session key. Please create a session key to enable automatic execution.',
        agent: 'inera',
        requiresConfirmation: true,
        error: 'No active session key',
      };
    }

    return {
      success: true,
      message: 'INERA is ready to orchestrate operations',
      agent: 'inera',
      data: {
        hasActiveSession: sessionStatus.hasActiveSession,
        canAutoExecute: sessionStatus.canAutoExecute,
      },
    };
  }

  /**
   * Check if INERA can handle a request
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    // INERA handles orchestration and multi-step flows
    const orchestrationKeywords = ['batch', 'workflow', 'multi-step', 'orchestrate'];
    return orchestrationKeywords.some((keyword) => intent.toLowerCase().includes(keyword));
  }
}

const ineraAgent = new INERAAgent();

export default ineraAgent;
export { INERAAgent };

