import type { TrainingExercisePlan } from '../training/exercisePlan';
import type {
  ReviewObservation,
  TrainingSessionEvent,
  TrainingSessionState,
} from '../training/session';
import { reduceGraphTrainingSession } from '../repertoire/trainingIntegration';

export type ContextualReviewObservation = ReviewObservation & { contextId?: string };

export function contextualReview(review: ReviewObservation): ContextualReviewObservation {
  return review as ContextualReviewObservation;
}

export function reducePhase6TrainingSession(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  event: TrainingSessionEvent,
): TrainingSessionState {
  const contextId = state.currentStepId;
  const before = state.evidence.length;
  const next = reduceGraphTrainingSession(state, plan, event);
  if (!contextId || next.evidence.length <= before) {
    return next;
  }
  return {
    ...next,
    evidence: next.evidence.map((review, index) =>
      index < before ? review : ({ ...review, contextId } as ContextualReviewObservation),
    ),
  };
}
