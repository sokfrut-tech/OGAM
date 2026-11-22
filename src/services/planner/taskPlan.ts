/**
 * Declarative task plans for Jarvis.
 *
 * The model may propose this graph, but it cannot execute it. A deterministic
 * scheduler checks dependencies and resolves every skill against the installed
 * skill registry before an execution broker can claim a step.
 */

export type TaskPlanStatus = 'draft' | 'ready' | 'running' | 'paused' | 'awaiting-approval' | 'completed' | 'failed' | 'cancelled';
export type TaskStepStatus = 'pending' | 'running' | 'awaiting-approval' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface TaskPlanStep {
  id: string;
  title: string;
  description: string;
  skillId: string;
  input: Record<string, unknown>;
  dependsOn: string[];
}

export interface TaskPlan {
  id: string;
  version: 1;
  title: string;
  objective: string;
  status: TaskPlanStatus;
  steps: TaskPlanStep[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskPlanValidation {
  valid: boolean;
  errors: string[];
  topologicalOrder: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function visit(
  id: string,
  byId: Map<string, TaskPlanStep>,
  temporary: Set<string>,
  permanent: Set<string>,
  order: string[],
): boolean {
  if (permanent.has(id)) return true;
  if (temporary.has(id)) return false;
  temporary.add(id);
  const step = byId.get(id);
  if (!step) return false;
  for (const dependency of step.dependsOn) {
    if (!visit(dependency, byId, temporary, permanent, order)) return false;
  }
  temporary.delete(id);
  permanent.add(id);
  order.push(id);
  return true;
}

/** Validate the complete plan graph before it is shown as executable. */
export function validateTaskPlan(value: unknown): TaskPlanValidation {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { valid: false, errors: ['Plan must be an object.'], topologicalOrder: [] };
  }

  if (typeof value.id !== 'string' || !value.id.trim()) errors.push('Plan id is required.');
  if (value.version !== 1) errors.push('Unsupported plan version.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 120) {
    errors.push('Plan title must contain 1 to 120 characters.');
  }
  if (typeof value.objective !== 'string' || !value.objective.trim() || value.objective.length > 2000) {
    errors.push('Plan objective must contain 1 to 2000 characters.');
  }
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 50) {
    errors.push('Plan must contain between 1 and 50 steps.');
    return { valid: false, errors, topologicalOrder: [] };
  }

  const byId = new Map<string, TaskPlanStep>();
  for (const candidate of value.steps) {
    if (!isRecord(candidate)) {
      errors.push('Every plan step must be an object.');
      continue;
    }
    const step = candidate as unknown as TaskPlanStep;
    if (typeof step.id !== 'string' || !step.id.trim()) {
      errors.push('Every step requires an id.');
      continue;
    }
    if (byId.has(step.id)) errors.push(`Duplicate step id: ${step.id}.`);
    if (typeof step.title !== 'string' || !step.title.trim() || step.title.length > 120) {
      errors.push(`Invalid title for step: ${step.id}.`);
    }
    if (typeof step.description !== 'string' || step.description.length > 2000) {
      errors.push(`Invalid description for step: ${step.id}.`);
    }
    if (typeof step.skillId !== 'string' || !step.skillId.trim()) {
      errors.push(`Missing skill id for step: ${step.id}.`);
    }
    if (!isRecord(step.input)) errors.push(`Input for step ${step.id} must be an object.`);
    if (!Array.isArray(step.dependsOn) || step.dependsOn.some(dep => typeof dep !== 'string')) {
      errors.push(`Dependencies for step ${step.id} must be a string array.`);
    }
    byId.set(step.id, step);
  }

  for (const step of byId.values()) {
    if (!Array.isArray(step.dependsOn) || step.dependsOn.some(dep => typeof dep !== 'string')) {
      continue;
    }
    const unique = new Set(step.dependsOn);
    if (unique.size !== step.dependsOn.length) {
      errors.push(`Duplicate dependencies for step: ${step.id}.`);
    }
    for (const dependency of step.dependsOn) {
      if (!byId.has(dependency)) errors.push(`Unknown dependency ${dependency} in step ${step.id}.`);
      if (dependency === step.id) errors.push(`Step cannot depend on itself: ${step.id}.`);
    }
  }

  if (errors.length > 0) return { valid: false, errors, topologicalOrder: [] };

  const order: string[] = [];
  const permanent = new Set<string>();
  const temporary = new Set<string>();
  for (const id of byId.keys()) {
    if (!visit(id, byId, temporary, permanent, order)) {
      errors.push('Plan dependencies contain a cycle.');
      break;
    }
  }

  return { valid: errors.length === 0, errors, topologicalOrder: errors.length === 0 ? order : [] };
}

/**
 * Return currently runnable steps in stable plan order. Completion is supplied
 * by the execution ledger; merely asking for readiness never changes state.
 */
export function getReadyTaskSteps(
  plan: TaskPlan,
  completedStepIds: readonly string[],
): TaskPlanStep[] {
  if (plan.status !== 'ready' && plan.status !== 'running') return [];
  const completed = new Set(completedStepIds);
  const validation = validateTaskPlan(plan);
  if (!validation.valid) return [];
  return validation.topologicalOrder
    .map(id => plan.steps.find(step => step.id === id)!)
    .filter(step => !completed.has(step.id) && step.dependsOn.every(id => completed.has(id)));
}


export interface TaskPlanRun {
  planId: string;
  status: TaskPlanStatus;
  stepStates: Record<string, TaskStepStatus>;
  stepOutputs: Record<string, unknown>;
  stepErrors: Record<string, string>;
  updatedAt: string;
}

export interface TaskPlanTransition {
  run: TaskPlanRun;
  step?: TaskPlanStep;
  error?: string;
}

export function createTaskPlanRun(plan: TaskPlan, now = new Date().toISOString()): TaskPlanRun {
  return {
    planId: plan.id,
    status: 'ready',
    stepStates: Object.fromEntries(plan.steps.map(step => [step.id, 'pending'])),
    stepOutputs: {},
    stepErrors: {},
    updatedAt: now,
  };
}

/**
 * Claim one dependency-ready step. Approval policy is resolved from the installed
 * skill contract, never from model-authored plan data.
 */
export function claimNextTaskStep(
  plan: TaskPlan,
  run: TaskPlanRun,
  requiresApproval: (skillId: string) => boolean,
  now = new Date().toISOString(),
): TaskPlanTransition {
  if (run.planId !== plan.id) return { run, error: 'Plan/run identity mismatch.' };
  if (run.status !== 'ready' && run.status !== 'running') {
    return { run, error: `Plan cannot claim a step while ${run.status}.` };
  }
  const completed = Object.entries(run.stepStates)
    .filter(([, status]) => status === 'completed')
    .map(([id]) => id);
  const next = getReadyTaskSteps({ ...plan, status: run.status }, completed)
    .find(step => run.stepStates[step.id] === 'pending');
  if (!next) {
    const allCompleted = plan.steps.every(step => run.stepStates[step.id] === 'completed');
    return allCompleted
      ? { run: { ...run, status: 'completed', updatedAt: now } }
      : { run, error: 'No dependency-ready step is available.' };
  }
  const approval = requiresApproval(next.skillId);
  const stepStates = {
    ...run.stepStates,
    [next.id]: approval ? 'awaiting-approval' as const : 'running' as const,
  };
  return {
    step: next,
    run: {
      ...run,
      status: approval ? 'awaiting-approval' : 'running',
      stepStates,
      updatedAt: now,
    },
  };
}

export function resolveTaskStepApproval(
  run: TaskPlanRun,
  stepId: string,
  approved: boolean,
  now = new Date().toISOString(),
): TaskPlanTransition {
  if (run.status !== 'awaiting-approval' || run.stepStates[stepId] !== 'awaiting-approval') {
    return { run, error: 'This step is not awaiting approval.' };
  }
  if (!approved) {
    const stepStates = { ...run.stepStates, [stepId]: 'cancelled' as const };
    for (const [id, status] of Object.entries(stepStates)) {
      if (status === 'pending' || status === 'awaiting-approval') stepStates[id] = 'cancelled';
    }
    return {
      run: { ...run, status: 'cancelled', stepStates, updatedAt: now },
    };
  }
  return {
    run: {
      ...run,
      status: 'running',
      stepStates: { ...run.stepStates, [stepId]: 'running' },
      updatedAt: now,
    },
  };
}

export function completeTaskStep(
  run: TaskPlanRun,
  stepId: string,
  output: unknown,
  plan: TaskPlan,
  now = new Date().toISOString(),
): TaskPlanTransition {
  if (run.planId !== plan.id || run.status !== 'running' || run.stepStates[stepId] !== 'running') {
    return { run, error: 'Only the currently running step can be completed.' };
  }
  const stepStates = { ...run.stepStates, [stepId]: 'completed' as const };
  const allCompleted = plan.steps.every(step => stepStates[step.id] === 'completed');
  return {
    run: {
      ...run,
      status: allCompleted ? 'completed' : 'running',
      stepStates,
      stepOutputs: { ...run.stepOutputs, [stepId]: output },
      updatedAt: now,
    },
  };
}

export function failTaskStep(
  run: TaskPlanRun,
  stepId: string,
  error: string,
  now = new Date().toISOString(),
): TaskPlanTransition {
  if (run.status !== 'running' || run.stepStates[stepId] !== 'running') {
    return { run, error: 'Only a running step can fail.' };
  }
  return {
    run: {
      ...run,
      status: 'failed',
      stepStates: { ...run.stepStates, [stepId]: 'failed' },
      stepErrors: { ...run.stepErrors, [stepId]: error.slice(0, 2000) },
      updatedAt: now,
    },
  };
}

export function retryFailedTaskStep(
  run: TaskPlanRun,
  stepId: string,
  now = new Date().toISOString(),
): TaskPlanTransition {
  if (run.status !== 'failed' || run.stepStates[stepId] !== 'failed') {
    return { run, error: 'Only a failed step can be retried.' };
  }
  const stepStates = { ...run.stepStates, [stepId]: 'pending' as const };
  const stepErrors = { ...run.stepErrors };
  delete stepErrors[stepId];
  return {
    run: { ...run, status: 'ready', stepStates, stepErrors, updatedAt: now },
  };
}

/** Pause is allowed only between steps; active native work must be cancelled by its executor first. */
export function pauseTaskPlanRun(run: TaskPlanRun, now = new Date().toISOString()): TaskPlanTransition {
  if (run.status !== 'running' || Object.values(run.stepStates).includes('running')) {
    return { run, error: 'Pause is allowed only between completed execution steps.' };
  }
  return { run: { ...run, status: 'paused', updatedAt: now } };
}

export function resumeTaskPlanRun(run: TaskPlanRun, now = new Date().toISOString()): TaskPlanTransition {
  if (run.status !== 'paused') return { run, error: 'Only a paused plan can resume.' };
  return { run: { ...run, status: 'ready', updatedAt: now } };
}

/** Cancellation is accepted only when no native step is still executing. */
export function cancelTaskPlanRun(run: TaskPlanRun, now = new Date().toISOString()): TaskPlanTransition {
  if (Object.values(run.stepStates).includes('running')) {
    return { run, error: 'The active step must be cancelled by its executor first.' };
  }
  if (['completed', 'failed', 'cancelled'].includes(run.status)) {
    return { run, error: `A ${run.status} plan cannot be cancelled.` };
  }
  const stepStates = { ...run.stepStates };
  for (const [id, status] of Object.entries(stepStates)) {
    if (status === 'pending' || status === 'awaiting-approval') stepStates[id] = 'cancelled';
  }
  return { run: { ...run, status: 'cancelled', stepStates, updatedAt: now } };
}
