export const SCHEDULER_STATE_SCHEMA_VERSION = 1;

export type SchedulerGrade = 'Again' | 'Hard' | 'Good' | 'Easy';
export type SchedulerStage = 'new' | 'learning' | 'review' | 'relearning';

export interface SchedulerState {
  schemaVersion: typeof SCHEDULER_STATE_SCHEMA_VERSION;
  dueAt: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  stage: SchedulerStage;
  lastReviewAt?: string;
}

export interface SchedulerPreview {
  dueAt: string;
  stage: SchedulerStage;
  retrievability: number;
}

export interface SchedulerReviewResult {
  state: SchedulerState;
  retrievability: number;
}

export interface SchedulerPort {
  readonly adapterVersion: string;
  readonly parametersVersion: string;
  createNew(now: Date): SchedulerState;
  preview(state: SchedulerState, now: Date): SchedulerPreview;
  review(
    state: SchedulerState,
    grade: SchedulerGrade,
    now: Date,
  ): SchedulerReviewResult;
  isDue(state: SchedulerState, now: Date): boolean;
  retrievability(state: SchedulerState, now: Date): number;
  serializeConfiguration(): string;
}

export function createEmptySchedulerState(now: Date): SchedulerState {
  return {
    schemaVersion: SCHEDULER_STATE_SCHEMA_VERSION,
    dueAt: now.toISOString(),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    stage: 'new',
  };
}

export function schedulerStateIsMature(state: SchedulerState): boolean {
  return state.stage === 'review' && state.reps >= 3 && state.stability >= 3;
}
