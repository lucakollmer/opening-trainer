import type { TrainingExercisePlan } from '../training/exercisePlan';
import {
  createTrainingSession,
  readyRetestCount,
  type AdaptiveExerciseDescriptor,
  type AdaptiveSessionMetadata,
  type TrainingSessionState,
} from '../training/session';

export interface AdaptiveExercisePlan {
  descriptor: AdaptiveExerciseDescriptor;
  plan: TrainingExercisePlan;
  targetTrainingItemIds: readonly string[];
}

export interface AdaptiveSessionPlan {
  generatorVersion: string;
  seed: string;
  requestedTargetCount: number;
  newItemLimit: number;
  exercises: readonly AdaptiveExercisePlan[];
}

export function createAdaptiveTrainingSession(
  sessionPlan: AdaptiveSessionPlan,
  nowMs: number,
  sessionId: string,
): { state: TrainingSessionState; plan: TrainingExercisePlan } {
  const first = sessionPlan.exercises[0];
  if (!first) throw new Error('Adaptive session requires at least one exercise.');
  const targetTrainingItemIds = [
    ...new Set(
      sessionPlan.exercises.flatMap((exercise) => exercise.targetTrainingItemIds),
    ),
  ];
  const adaptive: AdaptiveSessionMetadata = {
    generatorVersion: sessionPlan.generatorVersion,
    seed: sessionPlan.seed,
    exerciseIndex: 0,
    exercises: sessionPlan.exercises.map((exercise) => exercise.descriptor),
    targetTrainingItemIds,
    requestedTargetCount: sessionPlan.requestedTargetCount,
    newItemLimit: sessionPlan.newItemLimit,
  };
  return {
    plan: first.plan,
    state: {
      ...createTrainingSession(first.plan, nowMs, { sessionId }),
      adaptive,
    },
  };
}

export function hasNextAdaptiveExercise(state: TrainingSessionState): boolean {
  return Boolean(
    state.adaptive &&
    state.adaptive.exerciseIndex + 1 < state.adaptive.exercises.length,
  );
}

export function advanceAdaptiveTrainingSession(
  state: TrainingSessionState,
  nextPlan: TrainingExercisePlan,
  nowMs: number,
): TrainingSessionState {
  if (!state.adaptive) throw new Error('Session is not adaptive.');
  if (state.status !== 'line-complete') {
    throw new Error('Adaptive session can advance only after line completion.');
  }
  if (state.retestQueue.length > 0) {
    throw new Error('Resolve or explicitly end retest work before advancing.');
  }
  const nextIndex = state.adaptive.exerciseIndex + 1;
  if (nextIndex >= state.adaptive.exercises.length) {
    throw new Error('Adaptive session has no remaining exercise.');
  }
  const next = createTrainingSession(nextPlan, nowMs, {
    sessionId: state.sessionId,
  });
  const descriptor = state.adaptive.exercises[nextIndex];
  return {
    ...next,
    runKind: descriptor?.kind === 'retest' ? 'retest' : 'primary',
    evidence: state.evidence,
    retestAttemptsByStep: state.retestAttemptsByStep,
    adaptive: {
      ...state.adaptive,
      exerciseIndex: nextIndex,
    },
  };
}

export interface DeferredAdaptiveRetests {
  state: TrainingSessionState;
  descriptors: readonly AdaptiveExerciseDescriptor[];
}

function planCanReachStep(
  plan: TrainingExercisePlan,
  startStepId: string,
  targetStepId: string,
): boolean {
  const stack = [startStepId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const stepId = stack.pop()!;
    if (stepId === targetStepId) return true;
    if (visited.has(stepId)) continue;
    visited.add(stepId);
    const step = plan.steps.find((candidate) => candidate.id === stepId);
    if (!step) continue;
    const nextIds = new Set([
      ...(step.nextStepId ? [step.nextStepId] : []),
      ...Object.values(step.nextStepByAcceptedUci).filter((value): value is string =>
        Boolean(value),
      ),
    ]);
    nextIds.forEach((nextId) => stack.push(nextId));
  }
  return false;
}

export function deferAdaptiveRetests(
  state: TrainingSessionState,
  currentPlan: TrainingExercisePlan,
): DeferredAdaptiveRetests {
  if (!state.adaptive || state.status !== 'line-complete') {
    return { state, descriptors: [] };
  }
  if (state.retestQueue.length === 0 || readyRetestCount(state) > 0) {
    return { state, descriptors: [] };
  }
  if (!hasNextAdaptiveExercise(state)) {
    return { state, descriptors: [] };
  }
  const currentDescriptor = state.adaptive.exercises[state.adaptive.exerciseIndex];
  if (!currentDescriptor) return { state, descriptors: [] };

  const targetStepIds = [
    ...new Set(
      state.retestQueue
        .map((ticket) => ticket.targetStepId)
        .filter((stepId) =>
          currentPlan.steps.some((step) => step.id === stepId && step.actor === 'user'),
        ),
    ),
  ];
  if (targetStepIds.length === 0) return { state, descriptors: [] };
  const remaining = [...targetStepIds];
  const descriptors: AdaptiveExerciseDescriptor[] = [];
  while (remaining.length > 0) {
    const anchorStepId = remaining[0]!;
    const chain = remaining.filter(
      (stepId) =>
        planCanReachStep(currentPlan, anchorStepId, stepId) ||
        planCanReachStep(currentPlan, stepId, anchorStepId),
    );
    const targetContextId = [...chain].sort((left, right) => {
      const leftPly = currentPlan.steps.find((step) => step.id === left)?.ply ?? -1;
      const rightPly = currentPlan.steps.find((step) => step.id === right)?.ply ?? -1;
      return rightPly - leftPly || left.localeCompare(right);
    })[0]!;
    descriptors.push({
      kind: 'retest',
      repertoireId: currentDescriptor.repertoireId,
      rootContextId: currentDescriptor.rootContextId,
      targetContextId,
      targetContextIds: chain,
      promptMode: currentDescriptor.promptMode,
      ...(currentDescriptor.playlistId
        ? { playlistId: currentDescriptor.playlistId }
        : {}),
    });
    const covered = new Set(chain);
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (covered.has(remaining[index]!)) remaining.splice(index, 1);
    }
  }
  return {
    descriptors,
    state: {
      ...state,
      retestQueue: [],
      adaptive: {
        ...state.adaptive,
        exercises: [...state.adaptive.exercises, ...descriptors],
      },
    },
  };
}

export function adaptiveSessionSummary(state: TrainingSessionState) {
  const targeted = state.evidence.filter(
    (observation) =>
      observation.evidenceRole === 'targeted' &&
      observation.outcome !== 'illegal-attempt',
  );
  const correctWithoutHint = targeted.filter(
    (observation) =>
      ['instant-correct', 'correct', 'hesitant-correct'].includes(
        observation.outcome,
      ) && observation.hintLevel === 0,
  ).length;
  const hinted = targeted.filter((observation) => observation.hintLevel > 0).length;
  const failed = targeted.filter((observation) =>
    ['wrong-variation', 'outside-repertoire', 'revealed'].includes(observation.outcome),
  ).length;
  const confusions = targeted.filter(
    (observation) => observation.confusionContextId,
  ).length;
  const repaired = targeted.filter(
    (observation) => observation.outcome === 'repair-correct',
  ).length;
  const deferredRetests = state.adaptive
    ? state.adaptive.exercises
        .slice(state.adaptive.exerciseIndex + 1)
        .filter((descriptor) => descriptor.kind === 'retest').length
    : 0;
  return {
    targeted: targeted.length,
    correctWithoutHint,
    hinted,
    failed,
    confusions,
    repaired,
    unresolved: state.retestQueue.length + deferredRetests,
  };
}
