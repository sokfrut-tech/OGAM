import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaskPlan, getReadyTaskSteps } from '../../src/services/planner/taskPlan.ts';

const makePlan = () => ({
  id: 'plan-1',
  version: 1,
  title: 'Prepare a report',
  objective: 'Collect and summarize the requested information.',
  status: 'ready',
  createdAt: '2026-11-22T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
  steps: [
    { id: 'collect', title: 'Collect sources', description: 'Find source material.', skillId: 'research.search', input: { query: 'topic' }, dependsOn: [] },
    { id: 'summarize', title: 'Summarize', description: 'Summarize verified sources.', skillId: 'writing.summarize', input: { style: 'brief' }, dependsOn: ['collect'] },
    { id: 'format', title: 'Format', description: 'Format the summary.', skillId: 'writing.format', input: {}, dependsOn: ['summarize'] },
  ],
});

test('validates a plan and returns deterministic topological order', () => {
  const result = validateTaskPlan(makePlan());
  assert.equal(result.valid, true);
  assert.deepEqual(result.topologicalOrder, ['collect', 'summarize', 'format']);
});

test('does not expose downstream steps until every dependency is completed', () => {
  const plan = makePlan();
  assert.deepEqual(getReadyTaskSteps(plan, []).map(step => step.id), ['collect']);
  assert.deepEqual(getReadyTaskSteps(plan, ['collect']).map(step => step.id), ['summarize']);
  assert.deepEqual(getReadyTaskSteps(plan, ['collect', 'summarize']).map(step => step.id), ['format']);
});

test('rejects missing dependencies, duplicate IDs and dependency cycles', () => {
  const missing = makePlan();
  missing.steps[0].dependsOn = ['unknown'];
  assert.ok(validateTaskPlan(missing).errors.some(error => error.includes('Unknown dependency')));

  const duplicate = makePlan();
  duplicate.steps[1].id = 'collect';
  assert.ok(validateTaskPlan(duplicate).errors.some(error => error.includes('Duplicate step id')));

  const cycle = makePlan();
  cycle.steps[0].dependsOn = ['format'];
  assert.ok(validateTaskPlan(cycle).errors.some(error => error.includes('cycle')));
});

test('rejects malformed dependency arrays without throwing', () => {
  const plan = makePlan();
  plan.steps[0].dependsOn = null;
  const result = validateTaskPlan(plan);
  assert.equal(result.valid, false);
  assert.deepEqual(result.topologicalOrder, []);
});

test('refuses to schedule a draft or malformed plan', () => {
  const plan = makePlan();
  plan.status = 'draft';
  assert.deepEqual(getReadyTaskSteps(plan, []), []);
  plan.status = 'ready';
  plan.steps[0].input = null;
  assert.deepEqual(getReadyTaskSteps(plan, []), []);
});

import {
  createTaskPlanRun,
  claimNextTaskStep,
  resolveTaskStepApproval,
  completeTaskStep,
  failTaskStep,
  retryFailedTaskStep,
  pauseTaskPlanRun,
  resumeTaskPlanRun,
  cancelTaskPlanRun,
} from '../../src/services/planner/taskPlanRun.ts';

test('claims dependency-ready steps and waits for approval when required', () => {
  const plan = makePlan();
  let run = createTaskPlanRun(plan, '2026-11-22T10:00:00.000Z');
  let claimed = claimNextTaskStep(plan, run, skillId => skillId === 'research.search');
  assert.equal(claimed.step?.id, 'collect');
  assert.equal(claimed.run.status, 'awaiting-approval');
  assert.equal(claimed.run.stepStates.collect, 'awaiting-approval');

  const approved = resolveTaskStepApproval(claimed.run, 'collect', true);
  assert.equal(approved.run.status, 'running');
  assert.equal(approved.run.stepStates.collect, 'running');
  const completed = completeTaskStep(approved.run, 'collect', { count: 3 }, plan);
  assert.equal(completed.run.stepStates.collect, 'completed');
  assert.deepEqual(completed.run.stepOutputs.collect, { count: 3 });
  assert.equal(claimNextTaskStep(plan, completed.run, () => false).step?.id, 'summarize');
});

test('rejecting approval cancels all remaining pending steps', () => {
  const plan = makePlan();
  const run = createTaskPlanRun(plan);
  const pending = claimNextTaskStep(plan, run, () => true).run;
  const rejected = resolveTaskStepApproval(pending, 'collect', false);
  assert.equal(rejected.run.status, 'cancelled');
  assert.deepEqual(Object.values(rejected.run.stepStates), ['cancelled', 'cancelled', 'cancelled']);
});

test('failed steps can be retried without losing completed dependencies', () => {
  const plan = makePlan();
  let run = createTaskPlanRun(plan);
  run = claimNextTaskStep(plan, run, () => false).run;
  run = completeTaskStep(run, 'collect', 'sources', plan).run;
  run = claimNextTaskStep(plan, run, () => false).run;
  run = failTaskStep(run, 'summarize', 'temporary failure').run;
  assert.equal(run.status, 'failed');
  assert.equal(run.stepErrors.summarize, 'temporary failure');
  run = retryFailedTaskStep(run, 'summarize').run;
  assert.equal(run.status, 'ready');
  assert.equal(run.stepStates.collect, 'completed');
  assert.equal(run.stepStates.summarize, 'pending');
  assert.deepEqual(getReadyTaskSteps({ ...plan, status: run.status }, ['collect']).map(step => step.id), ['summarize']);
});

test('pause/resume and cancellation do not silently interrupt an active step', () => {
  const plan = makePlan();
  let run = createTaskPlanRun(plan);
  run = claimNextTaskStep(plan, run, () => false).run;
  const blockedPause = pauseTaskPlanRun(run);
  assert.ok(blockedPause.error);
  const blockedCancel = cancelTaskPlanRun(run);
  assert.ok(blockedCancel.error);

  run = completeTaskStep(run, 'collect', null, plan).run;
  const paused = pauseTaskPlanRun(run).run;
  assert.equal(paused.status, 'paused');
  assert.equal(resumeTaskPlanRun(paused).run.status, 'ready');
  assert.equal(cancelTaskPlanRun(paused).run.status, 'cancelled');
});
