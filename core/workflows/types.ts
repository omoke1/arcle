/**
 * Workflow Type Definitions
 * 
 * Defines types for multi-step workflow execution
 */

export interface WorkflowDefinition {
  id: string;
  name?: string;
  description?: string;
  steps: WorkflowStep[];
  metadata?: Record<string, any>;
}

export interface WorkflowStep {
  agent: string;
  action: string;
  params: Record<string, any>;
  condition?: WorkflowCondition;
  retryPolicy?: RetryPolicy;
  outputKey?: string; // Key to store result in workflow state
}

export interface WorkflowCondition {
  type?: 'equals' | 'greaterThan' | 'lessThan' | 'exists' | 'custom';
  key?: string;
  value?: any;
  evaluate?: (state: Record<string, any>) => boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

export interface WorkflowResult {
  success: boolean;
  workflowId: string;
  results?: WorkflowStepResult[];
  finalState?: Record<string, any>;
  error?: string;
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

export interface BatchOperation {
  agent: string;
  action: string;
  params: Record<string, any>;
}

