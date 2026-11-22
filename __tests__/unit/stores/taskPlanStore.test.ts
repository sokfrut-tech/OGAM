import { useTaskPlanStore } from '../../../src/stores/taskPlanStore';

const draft = () => ({
  version: 1 as const,
  title: 'Prepare a report',
  objective: 'Collect and summarize sources.',
  steps: [
    { id: 'collect', title: 'Collect', description: 'Collect sources.', skillId: 'tool.web_search', input: { query: 'topic' }, dependsOn: [] },
    { id: 'summarize', title: 'Summarize', description: 'Summarize sources.', skillId: 'writing.summarize', input: {}, dependsOn: ['collect'] },
  ],
});

describe('useTaskPlanStore', () => {
  beforeEach(() => {
    useTaskPlanStore.setState({ plans: [], runs: {} });
  });

  it('stores a validated draft locally and rejects malformed plans', () => {
    const created = useTaskPlanStore.getState().createPlan(draft());
    expect(created?.status).toBe('draft');
    expect(useTaskPlanStore.getState().getPlan(created!.id)?.title).toBe('Prepare a report');

    const invalid = draft();
    invalid.steps[0].dependsOn = ['missing'];
    expect(useTaskPlanStore.getState().createPlan(invalid)).toBeNull();
  });

  it('allows editing only before activation', () => {
    const created = useTaskPlanStore.getState().createPlan(draft())!;
    expect(useTaskPlanStore.getState().updateDraft(created.id, { title: 'Updated report' })).toBe(true);
    expect(useTaskPlanStore.getState().activatePlan(created.id)).toBe(true);
    expect(useTaskPlanStore.getState().updateDraft(created.id, { title: 'Too late' })).toBe(false);
  });

  it('persists plan progress through guarded state transitions', () => {
    const created = useTaskPlanStore.getState().createPlan(draft())!;
    const store = useTaskPlanStore.getState();
    expect(store.activatePlan(created.id)).toBe(true);
    expect(store.claimNextStep(created.id, skillId => skillId === 'tool.web_search')?.id).toBe('collect');
    expect(store.getRun(created.id)?.status).toBe('awaiting-approval');
    expect(store.resolveApproval(created.id, 'collect', true)).toBe(true);
    expect(store.completeStep(created.id, 'collect', { sources: 2 })).toBe(true);
    expect(store.claimNextStep(created.id, () => false)?.id).toBe('summarize');
    expect(store.deletePlan(created.id)).toBe(false);
    expect(store.cancelPlan(created.id)).toBe(false);
  });

  it('does not delete a plan while approval is pending, but permits deleting drafts', () => {
    const created = useTaskPlanStore.getState().createPlan(draft())!;
    expect(useTaskPlanStore.getState().deletePlan(created.id)).toBe(true);
    const next = useTaskPlanStore.getState().createPlan(draft())!;
    useTaskPlanStore.getState().activatePlan(next.id);
    useTaskPlanStore.getState().claimNextStep(next.id, () => true);
    expect(useTaskPlanStore.getState().deletePlan(next.id)).toBe(false);
  });
});
