import {
  getReadyTaskSteps,
  type TaskPlan,
  type TaskPlanStep,
  type TaskPlanStatus,
  type TaskStepStatus,
} from './taskPlan';

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
