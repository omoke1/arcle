/**
 * INERA Workflow Orchestration
 * 
 * Handles multi-step workflow execution, batching, and conditional logic
 */

import type { WorkflowDefinition, WorkflowStep, WorkflowResult } from '@/core/workflows/types';

export interface WorkflowExecutionContext {
  workflowId: string;
  currentStep: number;
  state: Record<string, any>;
  results: WorkflowStepResult[];
}

export interface WorkflowStepResult {
  stepIndex: number;
  agent: string;
  action: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
}

/**
 * Execute a workflow definition
 */
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  context: Record<string, any> = {}
): Promise<WorkflowResult> {
  const executionContext: WorkflowExecutionContext = {
    workflowId: workflow.id || `workflow-${Date.now()}`,
    currentStep: 0,
    state: { ...context },
    results: [],
  };

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      executionContext.currentStep = i;

      // Check conditions
      if (step.condition && !evaluateCondition(step.condition, executionContext.state)) {
        console.log(`[Workflow] Step ${i} skipped due to condition`);
        continue;
      }

      // Execute step
      const stepResult = await executeWorkflowStep(step, executionContext);
      executionContext.results.push(stepResult);

      // Update state with step result
      if (stepResult.success && stepResult.result) {
        executionContext.state[`step_${i}_result`] = stepResult.result;
        if (step.outputKey) {
          executionContext.state[step.outputKey] = stepResult.result;
        }
      }

      // Handle step failure
      if (!stepResult.success) {
        if (step.retryPolicy) {
          const retryResult = await retryStep(step, executionContext, step.retryPolicy);
          if (!retryResult.success) {
            return {
              success: false,
              workflowId: executionContext.workflowId,
              error: `Step ${i} failed after retries: ${retryResult.error}`,
              results: executionContext.results,
            };
          }
          executionContext.results[executionContext.results.length - 1] = retryResult;
        } else {
          return {
            success: false,
            workflowId: executionContext.workflowId,
            error: `Step ${i} failed: ${stepResult.error}`,
            results: executionContext.results,
          };
        }
      }
    }

    return {
      success: true,
      workflowId: executionContext.workflowId,
      results: executionContext.results,
      finalState: executionContext.state,
    };
  } catch (error: any) {
    return {
      success: false,
      workflowId: executionContext.workflowId,
      error: error.message || 'Workflow execution failed',
      results: executionContext.results,
    };
  }
}

/**
 * Execute a single workflow step
 */
async function executeWorkflowStep(
  step: WorkflowStep,
  context: WorkflowExecutionContext
): Promise<WorkflowStepResult> {
  try {
    // Import agent dynamically
    const agentModule = await import(`@/agents/${step.agent}/index`);
    const agent = agentModule.default || agentModule;

    // Execute agent action
    const result = await agent.execute(step.action, {
      ...step.params,
      ...context.state, // Merge workflow state
    });

    return {
      stepIndex: context.currentStep,
      agent: step.agent,
      action: step.action,
      success: true,
      result,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    return {
      stepIndex: context.currentStep,
      agent: step.agent,
      action: step.action,
      success: false,
      error: error.message || 'Step execution failed',
      timestamp: Date.now(),
    };
  }
}

/**
 * Evaluate a condition
 */
function evaluateCondition(condition: any, state: Record<string, any>): boolean {
  if (typeof condition === 'function') {
    return condition(state);
  }

  if (typeof condition === 'object' && condition.type) {
    switch (condition.type) {
      case 'equals':
        return state[condition.key] === condition.value;
      case 'greaterThan':
        return Number(state[condition.key]) > Number(condition.value);
      case 'lessThan':
        return Number(state[condition.key]) < Number(condition.value);
      case 'exists':
        return state[condition.key] !== undefined;
      default:
        return true;
    }
  }

  return true;
}

/**
 * Retry a failed step
 */
async function retryStep(
  step: WorkflowStep,
  context: WorkflowExecutionContext,
  retryPolicy: { maxRetries: number; delayMs?: number }
): Promise<WorkflowStepResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt++) {
    if (retryPolicy.delayMs && attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, retryPolicy.delayMs));
    }

    const result = await executeWorkflowStep(step, context);
    if (result.success) {
      return result;
    }
    lastError = result.error;
  }

  return {
    stepIndex: context.currentStep,
    agent: step.agent,
    action: step.action,
    success: false,
    error: `Failed after ${retryPolicy.maxRetries} retries: ${lastError}`,
    timestamp: Date.now(),
  };
}

/**
 * Batch multiple operations into a single workflow
 */
export function createBatchWorkflow(operations: Array<{ agent: string; action: string; params: any }>): WorkflowDefinition {
  return {
    id: `batch-${Date.now()}`,
    steps: operations.map((op, index) => ({
      agent: op.agent,
      action: op.action,
      params: op.params,
      outputKey: `batch_result_${index}`,
    })),
  };
}

