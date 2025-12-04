/**
 * Workflow Engine
 * 
 * Executes multi-step workflows, handles batching, conditional logic, and retries
 */

import { executeWorkflow, createBatchWorkflow } from '@/agents/inera/workflows';
import type { WorkflowDefinition, WorkflowResult, BatchOperation } from './types';

/**
 * Execute a workflow definition
 */
export async function runWorkflow(workflow: WorkflowDefinition, context?: Record<string, any>): Promise<WorkflowResult> {
  return await executeWorkflow(workflow, context);
}

/**
 * Create and execute a batch workflow
 */
export async function executeBatch(operations: BatchOperation[], context?: Record<string, any>): Promise<WorkflowResult> {
  const workflow = createBatchWorkflow(operations);
  return await executeWorkflow(workflow, context);
}

/**
 * Create a workflow from steps
 */
export function createWorkflow(
  steps: Array<{ agent: string; action: string; params: any; condition?: any }>,
  options?: { id?: string; name?: string; description?: string }
): WorkflowDefinition {
  return {
    id: options?.id || `workflow-${Date.now()}`,
    name: options?.name,
    description: options?.description,
    steps: steps.map((step) => ({
      agent: step.agent,
      action: step.action,
      params: step.params,
      condition: step.condition,
    })),
  };
}

/**
 * Execute workflow with error handling and logging
 */
export async function executeWorkflowWithLogging(
  workflow: WorkflowDefinition,
  context?: Record<string, any>
): Promise<WorkflowResult> {
  console.log(`[Workflow Engine] Starting workflow: ${workflow.id}`);
  
  try {
    const result = await executeWorkflow(workflow, context);
    
    if (result.success) {
      console.log(`[Workflow Engine] Workflow ${workflow.id} completed successfully`);
    } else {
      console.error(`[Workflow Engine] Workflow ${workflow.id} failed:`, result.error);
    }
    
    return result;
  } catch (error: any) {
    console.error(`[Workflow Engine] Workflow ${workflow.id} threw error:`, error);
    return {
      success: false,
      workflowId: workflow.id,
      error: error.message || 'Workflow execution error',
    };
  }
}

