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

test('refuses to schedule a draft or malformed plan', () => {
  const plan = makePlan();
  plan.status = 'draft';
  assert.deepEqual(getReadyTaskSteps(plan, []), []);
  plan.status = 'ready';
  plan.steps[0].input = null;
  assert.deepEqual(getReadyTaskSteps(plan, []), []);
});
