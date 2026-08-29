import { tryApplyMove } from '../chess/chessAdapter';
import {
  createTrainingSession,
  reduceTrainingSession,
  type TrainingSessionEvent,
  type TrainingSessionState,
} from '../training/session';
import { exerciseStep, type TrainingExercisePlan } from '../training/exercisePlan';

const MAX_REPLACEMENT_RETURNS = 2;

function correctGraphPly(
  previous: TrainingSessionState,
  next: TrainingSessionState,
  plan: TrainingExercisePlan,
): TrainingSessionState {
  const targetPly = exerciseStep(plan, next.targetStepId)?.ply ?? next.targetPly;
  const current = exerciseStep(plan, next.currentStepId);
  if (current) return { ...next, plyIndex: current.ply, targetPly };
  const prior = exerciseStep(plan, previous.currentStepId);
  return prior
    ? { ...next, plyIndex: prior.ply + 1, targetPly }
    : { ...next, targetPly };
}

export function createGraphTrainingSession(
  plan: TrainingExercisePlan,
  nowMs: number,
  options: { sessionId?: string } = {},
): TrainingSessionState {
  const state = createTrainingSession(plan, nowMs, options);
  const start = exerciseStep(plan, state.currentStepId);
  return start
    ? {
        ...state,
        plyIndex: start.ply,
        targetPly: exerciseStep(plan, plan.targetStepId)?.ply ?? state.targetPly,
      }
    : state;
}

function queueDisplacedTargets(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  displacedTargetStepIds: readonly string[],
): TrainingSessionState {
  let next = state;
  const sourceObservationId = state.evidence.at(-1)?.id;
  if (!sourceObservationId) return state;

  for (const targetStepId of displacedTargetStepIds) {
    if (state.currentStepId === targetStepId) continue;
    const targetStep = exerciseStep(plan, targetStepId);
    if (
      targetStep &&
      next.evidence.some(
        (observation) =>
          observation.evidenceRole === 'targeted' &&
          observation.trainingItemId === targetStep.trainingItemId,
      )
    ) {
      continue;
    }
    if (next.retestQueue.some((ticket) => ticket.targetStepId === targetStepId)) {
      continue;
    }
    const attempts = next.retestAttemptsByStep[targetStepId] ?? 0;
    if (attempts >= MAX_REPLACEMENT_RETURNS) continue;
    const attempt = attempts + 1;
    next = {
      ...next,
      retestQueue: [
        ...next.retestQueue,
        {
          id: `replacement-${sourceObservationId}-${targetStepId}-${attempt}`,
          targetStepId,
          separationRemaining: 1,
          sourceObservationId,
          attempt,
        },
      ],
      retestAttemptsByStep: {
        ...next.retestAttemptsByStep,
        [targetStepId]: attempt,
      },
    };
  }

  if (next.retestQueue.length === state.retestQueue.length) return next;
  return {
    ...next,
    feedback: next.feedback
      ? {
          ...next.feedback,
          message: `${next.feedback.message} The selected accepted branch diverts from scheduled target work, so replacement target work has been queued.`,
        }
      : next.feedback,
  };
}

export function reduceGraphTrainingSession(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  event: TrainingSessionEvent,
): TrainingSessionState {
  const step = exerciseStep(plan, state.currentStepId);
  const applied =
    event.type === 'user-move' && step?.actor === 'user'
      ? tryApplyMove(state.fen, event.move)
      : null;
  let next = correctGraphPly(state, reduceTrainingSession(state, plan, event), plan);

  if (applied?.kind !== 'applied' || !step?.acceptedUci.includes(applied.move.uci)) {
    return next;
  }

  const chosenTreeItemId = step.treeItemIdByAcceptedUci?.[applied.move.uci];
  if (chosenTreeItemId && chosenTreeItemId !== step.treeItemId) {
    const before = new Set(state.treeRevealedItemIds);
    next = {
      ...next,
      treeRevealedItemIds: next.treeRevealedItemIds
        .filter((id) => id !== step.treeItemId || before.has(id))
        .concat(
          next.treeRevealedItemIds.includes(chosenTreeItemId) ? [] : [chosenTreeItemId],
        ),
    };
  }

  const displaced =
    step.displacedTargetStepIdsByAcceptedUci?.[applied.move.uci] ??
    (step.targetDispositionByAcceptedUci?.[applied.move.uci] === 'displaced'
      ? [state.targetStepId]
      : []);
  return displaced.length > 0 ? queueDisplacedTargets(next, plan, displaced) : next;
}
