import { tryApplyMove } from '../chess/chessAdapter';
import {
  createTrainingSession,
  reduceTrainingSession,
  type TrainingSessionEvent,
  type TrainingSessionState,
} from '../training/session';
import { exerciseStep, type TrainingExercisePlan } from '../training/exercisePlan';

const MAX_REPLACEMENT_RETURNS = 2;

function correctPly(
  previous: TrainingSessionState,
  next: TrainingSessionState,
  plan: TrainingExercisePlan,
): TrainingSessionState {
  const current = exerciseStep(plan, next.currentStepId);
  if (current) return { ...next, plyIndex: current.ply };
  const prior = exerciseStep(plan, previous.currentStepId);
  return prior ? { ...next, plyIndex: prior.ply + 1 } : next;
}

export function createGraphTrainingSession(
  plan: TrainingExercisePlan,
  nowMs: number,
  options: { sessionId?: string } = {},
): TrainingSessionState {
  const state = createTrainingSession(plan, nowMs, options);
  const start = exerciseStep(plan, state.currentStepId);
  return start ? { ...state, plyIndex: start.ply, targetPly: exerciseStep(plan, plan.targetStepId)?.ply ?? state.targetPly } : state;
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
  let next = correctPly(state, reduceTrainingSession(state, plan, event), plan);

  if (applied?.kind !== 'applied' || !step?.acceptedUci.includes(applied.move.uci)) return next;

  const chosenTreeItemId = step.treeItemIdByAcceptedUci?.[applied.move.uci];
  if (chosenTreeItemId && chosenTreeItemId !== step.treeItemId) {
    const before = new Set(state.treeRevealedItemIds);
    next = {
      ...next,
      treeRevealedItemIds: next.treeRevealedItemIds
        .filter((id) => id !== step.treeItemId || before.has(id))
        .concat(next.treeRevealedItemIds.includes(chosenTreeItemId) ? [] : [chosenTreeItemId]),
    };
  }

  if (step.targetDispositionByAcceptedUci?.[applied.move.uci] !== 'displaced') return next;
  if (state.currentStepId === state.targetStepId) return next;
  if (next.retestQueue.some((ticket) => ticket.targetStepId === state.targetStepId)) return next;
  const attempts = next.retestAttemptsByStep[state.targetStepId] ?? 0;
  if (attempts >= MAX_REPLACEMENT_RETURNS) return next;
  const sourceObservationId = next.evidence.at(-1)?.id;
  if (!sourceObservationId) return next;
  const attempt = attempts + 1;
  return {
    ...next,
    retestQueue: [
      ...next.retestQueue,
      {
        id: `replacement-${sourceObservationId}-${attempt}`,
        targetStepId: state.targetStepId,
        separationRemaining: 1,
        sourceObservationId,
        attempt,
      },
    ],
    retestAttemptsByStep: {
      ...next.retestAttemptsByStep,
      [state.targetStepId]: attempt,
    },
    feedback: next.feedback
      ? {
          ...next.feedback,
          message: `${next.feedback.message} The selected accepted branch diverts from the deeper target, so replacement target work has been queued.`,
        }
      : next.feedback,
  };
}
