import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId } from '../utils/generateId';
import { createHydrationGatedStorage } from '../utils/hydrationGatedStorage';
import { validateTaskPlan, type TaskPlan } from '../services/planner/taskPlan';
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
  type TaskPlanRun,
} from '../services/planner/taskPlanRun';
import type { TaskPlanStep } from '../services/planner/taskPlan';

interface TaskPlanStoreState {
  plans: TaskPlan[];
  runs: Record<string, TaskPlanRun>;
  createPlan: (draft: Omit<TaskPlan, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => TaskPlan | null;
  updateDraft: (id: string, updates: Partial<Pick<TaskPlan, 'title' | 'objective' | 'steps'>>) => boolean;
  activatePlan: (id: string) => boolean;
  deletePlan: (id: string) => boolean;
  claimNextStep: (id: string, requiresApproval: (skillId: string) => boolean) => TaskPlanStep | null;
  resolveApproval: (id: string, stepId: string, approved: boolean) => boolean;
  completeStep: (id: string, stepId: string, output: unknown) => boolean;
  failStep: (id: string, stepId: string, error: string) => boolean;
  retryStep: (id: string, stepId: string) => boolean;
  pausePlan: (id: string) => boolean;
  resumePlan: (id: string) => boolean;
  cancelPlan: (id: string) => boolean;
  getPlan: (id: string) => TaskPlan | undefined;
  getRun: (id: string) => TaskPlanRun | undefined;
}

type PersistedTaskPlanState = Pick<TaskPlanStoreState, 'plans' | 'runs'>;

// Personal plans may contain private context. Keep them local-only by default;
// cross-device sync must be an explicit, separately reviewed opt-in.
const planStorage = createHydrationGatedStorage<PersistedTaskPlanState>();

export const useTaskPlanStore = create<TaskPlanStoreState>()(
  persist(
    (set, get) => ({
      plans: [],
      runs: {},

      createPlan: draft => {
        if (!draft || !Array.isArray(draft.steps)) return null;
        const now = new Date().toISOString();
        const candidate = {
          ...draft,
          id: 'draft-validation',
          version: 1 as const,
          status: 'draft' as const,
          createdAt: now,
          updatedAt: now,
        } as TaskPlan;
        if (!validateTaskPlan(candidate).valid) return null;
        const plan: TaskPlan = {
          ...candidate,
          id: generateId(),
          steps: candidate.steps.map(step => ({
            ...step,
            input: { ...step.input },
            dependsOn: [...step.dependsOn],
          })),
        };
        set(state => ({ plans: [...state.plans, plan] }));
        return plan;
      },

      updateDraft: (id, updates) => {
        const existing = get().plans.find(plan => plan.id === id);
        if (!existing || existing.status !== 'draft') return false;
        const candidate: TaskPlan = {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        if (!validateTaskPlan(candidate).valid) return false;
        const updated: TaskPlan = {
          ...candidate,
          steps: candidate.steps.map(step => ({
            ...step,
            input: { ...step.input },
            dependsOn: [...step.dependsOn],
          })),
        };
        set(state => ({ plans: state.plans.map(plan => plan.id === id ? updated : plan) }));
        return true;
      },

      activatePlan: id => {
        const plan = get().plans.find(item => item.id === id);
        if (!plan || plan.status !== 'draft' || !validateTaskPlan(plan).valid) return false;
        const ready = { ...plan, status: 'ready' as const, updatedAt: new Date().toISOString() };
        const run = createTaskPlanRun(ready);
        set(state => ({
          plans: state.plans.map(item => item.id === id ? ready : item),
          runs: { ...state.runs, [id]: run },
        }));
        return true;
      },

      deletePlan: id => {
        const run = get().runs[id];
        if (run && (run.status === 'running' || run.status === 'awaiting-approval')) return false;
        set(state => {
          const runs = { ...state.runs };
          delete runs[id];
          return {
            plans: state.plans.filter(plan => plan.id !== id),
            runs,
          };
        });
        return true;
      },

      claimNextStep: (id, requiresApproval) => {
        const plan = get().plans.find(item => item.id === id);
        const run = get().runs[id];
        if (!plan || !run) return null;
        const transition = claimNextTaskStep(plan, run, requiresApproval);
        if (transition.error) return null;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return transition.step ?? null;
      },

      resolveApproval: (id, stepId, approved) => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = resolveTaskStepApproval(run, stepId, approved);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      completeStep: (id, stepId, output) => {
        const plan = get().plans.find(item => item.id === id);
        const run = get().runs[id];
        if (!plan || !run) return false;
        const transition = completeTaskStep(run, stepId, output, plan);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      failStep: (id, stepId, error) => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = failTaskStep(run, stepId, error);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      retryStep: (id, stepId) => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = retryFailedTaskStep(run, stepId);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      pausePlan: id => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = pauseTaskPlanRun(run);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      resumePlan: id => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = resumeTaskPlanRun(run);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      cancelPlan: id => {
        const run = get().runs[id];
        if (!run) return false;
        const transition = cancelTaskPlanRun(run);
        if (transition.error) return false;
        set(state => ({ runs: { ...state.runs, [id]: transition.run } }));
        return true;
      },

      getPlan: id => get().plans.find(plan => plan.id === id),
      getRun: id => get().runs[id],
    }),
    {
      name: 'jarvis-task-plan-storage',
      storage: planStorage.storage,
      onRehydrateStorage: planStorage.onRehydrateStorage(),
      merge: planStorage.merge<TaskPlanStoreState>(),
      partialize: state => ({ plans: state.plans, runs: state.runs }),
    },
  ),
);

planStorage.attach(useTaskPlanStore);
