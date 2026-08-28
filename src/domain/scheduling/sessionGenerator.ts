import type { PromptMode } from '../repertoire/types';
import type { SchedulerState } from './schedulerPort';

export const ADAPTIVE_SESSION_GENERATOR_VERSION = 'adaptive-generator-v1';
export const CONTRAST_CONFUSION_THRESHOLD = 2;
export const CONTRAST_WINDOW_DAYS = 30;

export interface TrainingCandidateSnapshot {
  trainingItemId: string;
  contextIds: readonly string[];
  promptMode: PromptMode;
  schedulerState: SchedulerState;
  retrievability: number;
  depth: number;
  prefixKey: string;
  recentFailureAt?: string;
  lastTargetedAt?: string;
  confusionCount: number;
  lastConfusionAt?: string;
  obligation?: 'retest' | 'replacement';
}

export interface AdaptiveSessionRequest {
  repertoireId: string;
  playlistId?: string;
  mode: 'guided' | 'normal' | 'strict' | 'contrast';
  targetCount: number;
  newItemLimit: number;
  now: Date;
  seed: string;
  allowReinforcement?: boolean;
}

export type AdaptiveCandidateClass =
  | 'repair'
  | 'weak-due'
  | 'due'
  | 'new'
  | 'contrast'
  | 'reinforcement';

export interface SelectedTrainingCandidate extends TrainingCandidateSnapshot {
  selectionClass: AdaptiveCandidateClass;
}

export interface AdaptiveSessionSelection {
  generatorVersion: typeof ADAPTIVE_SESSION_GENERATOR_VERSION;
  request: AdaptiveSessionRequest;
  selected: readonly SelectedTrainingCandidate[];
  available: {
    due: number;
    new: number;
    contrast: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function eligibleContrast(candidate: TrainingCandidateSnapshot, now: Date): boolean {
  if (candidate.confusionCount < CONTRAST_CONFUSION_THRESHOLD) return false;
  if (!candidate.lastConfusionAt) return false;
  return now.getTime() - new Date(candidate.lastConfusionAt).getTime() <=
    CONTRAST_WINDOW_DAYS * DAY_MS;
}

function isNew(candidate: TrainingCandidateSnapshot): boolean {
  return candidate.schedulerState.stage === 'new';
}

function isDue(candidate: TrainingCandidateSnapshot, now: Date): boolean {
  return !isNew(candidate) && new Date(candidate.schedulerState.dueAt).getTime() <= now.getTime();
}

function recentFailure(candidate: TrainingCandidateSnapshot, now: Date): boolean {
  if (!candidate.recentFailureAt) return false;
  return now.getTime() - new Date(candidate.recentFailureAt).getTime() <= 14 * DAY_MS;
}

function candidateClass(
  candidate: TrainingCandidateSnapshot,
  request: AdaptiveSessionRequest,
): AdaptiveCandidateClass | null {
  if (request.mode === 'contrast') {
    return eligibleContrast(candidate, request.now) ? 'contrast' : null;
  }
  if (candidate.obligation) return 'repair';
  if (isDue(candidate, request.now)) {
    if (candidate.retrievability < 0.82 || recentFailure(candidate, request.now)) {
      return 'weak-due';
    }
    return 'due';
  }
  if (isNew(candidate)) return 'new';
  return request.allowReinforcement ? 'reinforcement' : null;
}

const CLASS_RANK: Readonly<Record<AdaptiveCandidateClass, number>> = {
  repair: 0,
  'weak-due': 1,
  due: 2,
  new: 3,
  contrast: 4,
  reinforcement: 5,
};

function compareRecentFirst(
  left: string | undefined,
  right: string | undefined,
): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return new Date(right).getTime() - new Date(left).getTime();
}

function compareOldestFirst(
  left: string | undefined,
  right: string | undefined,
): number {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareCandidates(
  left: SelectedTrainingCandidate,
  right: SelectedTrainingCandidate,
  request: AdaptiveSessionRequest,
  previousPrefix: string | undefined,
): number {
  const classOrder = CLASS_RANK[left.selectionClass] - CLASS_RANK[right.selectionClass];
  if (classOrder !== 0) return classOrder;

  const leftDue = request.now.getTime() - new Date(left.schedulerState.dueAt).getTime();
  const rightDue = request.now.getTime() - new Date(right.schedulerState.dueAt).getTime();
  if (leftDue !== rightDue) return rightDue - leftDue;
  if (left.retrievability !== right.retrievability) {
    return left.retrievability - right.retrievability;
  }
  const failureOrder = compareRecentFirst(
    left.recentFailureAt,
    right.recentFailureAt,
  );
  if (failureOrder !== 0) return failureOrder;

  const leftPrefixPenalty = previousPrefix && left.prefixKey === previousPrefix ? 1 : 0;
  const rightPrefixPenalty = previousPrefix && right.prefixKey === previousPrefix ? 1 : 0;
  if (leftPrefixPenalty !== rightPrefixPenalty) {
    return leftPrefixPenalty - rightPrefixPenalty;
  }

  const cooldownOrder = compareOldestFirst(
    left.lastTargetedAt,
    right.lastTargetedAt,
  );
  if (cooldownOrder !== 0) return cooldownOrder;
  if (left.depth !== right.depth) return right.depth - left.depth;

  return (
    stableHash(`${request.seed}:${left.trainingItemId}`) -
    stableHash(`${request.seed}:${right.trainingItemId}`)
  );
}

export function generateAdaptiveSessionSelection(
  candidates: readonly TrainingCandidateSnapshot[],
  request: AdaptiveSessionRequest,
): AdaptiveSessionSelection {
  if (!Number.isInteger(request.targetCount) || request.targetCount < 1) {
    throw new Error('Adaptive targetCount must be a positive integer.');
  }
  if (!Number.isInteger(request.newItemLimit) || request.newItemLimit < 0) {
    throw new Error('Adaptive newItemLimit must be a non-negative integer.');
  }

  const classified = candidates
    .map((candidate) => {
      const selectionClass = candidateClass(candidate, request);
      return selectionClass ? ({ ...candidate, selectionClass } as const) : null;
    })
    .filter((candidate): candidate is SelectedTrainingCandidate => candidate !== null);

  const available = {
    due: classified.filter((candidate) =>
      ['repair', 'weak-due', 'due'].includes(candidate.selectionClass),
    ).length,
    new: classified.filter((candidate) => candidate.selectionClass === 'new').length,
    contrast: classified.filter((candidate) => candidate.selectionClass === 'contrast')
      .length,
  };

  const remaining = [...classified];
  const selected: SelectedTrainingCandidate[] = [];
  let newCount = 0;
  let previousPrefix: string | undefined;

  while (remaining.length > 0 && selected.length < request.targetCount) {
    remaining.sort((left, right) =>
      compareCandidates(left, right, request, previousPrefix),
    );
    const index = remaining.findIndex(
      (candidate) =>
        candidate.selectionClass !== 'new' || newCount < request.newItemLimit,
    );
    if (index < 0) break;
    const [next] = remaining.splice(index, 1);
    if (!next) break;
    selected.push(next);
    if (next.selectionClass === 'new') newCount += 1;
    previousPrefix = next.prefixKey;
  }

  return {
    generatorVersion: ADAPTIVE_SESSION_GENERATOR_VERSION,
    request,
    selected,
    available,
  };
}
