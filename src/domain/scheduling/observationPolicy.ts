import type { ReviewObservation } from '../training/session';
import {
  schedulerStateIsMature,
  type SchedulerGrade,
  type SchedulerState,
} from './schedulerPort';

export const SCHEDULER_MAPPING_POLICY_VERSION = 'chess-fsrs-v1';
export const RESPONSE_TIME_POLICY_VERSION = 'response-bands-v1';

export type ResponseTimeBand = 'fast' | 'ordinary' | 'hesitant';
export type SchedulerObservationAction = 'review' | 'none' | 'promote-target';

export interface ObservationSchedulingDecision {
  action: SchedulerObservationAction;
  policyVersion: typeof SCHEDULER_MAPPING_POLICY_VERSION;
  responsePolicyVersion: typeof RESPONSE_TIME_POLICY_VERSION;
  responseBand: ResponseTimeBand;
  reason: string;
  grade?: SchedulerGrade;
}

const GRADE_RANK: Readonly<Record<SchedulerGrade, number>> = {
  Again: 0,
  Hard: 1,
  Good: 2,
  Easy: 3,
};

function responseBand(responseTimeMs: number, state: SchedulerState): ResponseTimeBand {
  const fastLimit = state.stage === 'review' ? 3_500 : 5_000;
  const ordinaryLimit = state.stage === 'review' ? 12_000 : 15_000;
  if (responseTimeMs <= fastLimit) return 'fast';
  if (responseTimeMs <= ordinaryLimit) return 'ordinary';
  return 'hesitant';
}

function minimumGrade(left: SchedulerGrade, right: SchedulerGrade): SchedulerGrade {
  return GRADE_RANK[left] <= GRADE_RANK[right] ? left : right;
}

function positiveGrade(
  observation: ReviewObservation,
  state: SchedulerState,
  band: ResponseTimeBand,
): SchedulerGrade {
  if (observation.outcome === 'hesitant-correct') return 'Hard';
  if (
    observation.outcome === 'instant-correct' &&
    observation.hintLevel === 0 &&
    schedulerStateIsMature(state)
  ) {
    return 'Easy';
  }
  if (band === 'hesitant') return 'Hard';
  if (band === 'fast' && schedulerStateIsMature(state)) return 'Easy';
  return 'Good';
}

function cappedPositiveGrade(
  grade: SchedulerGrade,
  observation: ReviewObservation,
  state: SchedulerState,
): SchedulerGrade {
  let result = grade;
  if (observation.hintLevel === 1) result = minimumGrade(result, 'Good');
  if (observation.hintLevel >= 2) result = minimumGrade(result, 'Hard');
  if (observation.illegalAttemptCount === 1) result = minimumGrade(result, 'Good');
  if (observation.illegalAttemptCount >= 2) result = minimumGrade(result, 'Hard');
  if (result === 'Easy' && state.stage !== 'review') result = 'Good';
  return result;
}

function isNegative(outcome: ReviewObservation['outcome']): boolean {
  return ['wrong-variation', 'outside-repertoire', 'revealed'].includes(outcome);
}

function isPositive(outcome: ReviewObservation['outcome']): boolean {
  return ['instant-correct', 'correct', 'hesitant-correct', 'hinted-correct'].includes(
    outcome,
  );
}

export function mapObservationToSchedulerDecision(
  observation: ReviewObservation,
  state: SchedulerState,
): ObservationSchedulingDecision {
  const band = responseBand(observation.responseTimeMs, state);
  const base = {
    policyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
    responsePolicyVersion: RESPONSE_TIME_POLICY_VERSION,
    responseBand: band,
  } as const;

  if (observation.evidenceRole === 'incidental') {
    if (isNegative(observation.outcome)) {
      return {
        ...base,
        action: 'promote-target',
        reason: 'Incidental failure is preserved and promoted to targeted work.',
      };
    }
    return {
      ...base,
      action: 'none',
      reason: 'Incidental evidence does not advance FSRS intervals.',
    };
  }

  if (observation.outcome === 'repair-correct') {
    return {
      ...base,
      action: 'none',
      reason: 'Repair evidence never overwrites the original lapse.',
    };
  }

  if (observation.hintLevel === 4 || observation.outcome === 'revealed') {
    return {
      ...base,
      action: 'review',
      grade: 'Again',
      reason: 'A full reveal is a targeted failure.',
    };
  }

  if (isNegative(observation.outcome)) {
    return {
      ...base,
      action: 'review',
      grade: 'Again',
      reason: 'Targeted repertoire failure records a lapse before repair.',
    };
  }

  if (isPositive(observation.outcome)) {
    const grade = cappedPositiveGrade(
      positiveGrade(observation, state, band),
      observation,
      state,
    );
    return {
      ...base,
      action: 'review',
      grade,
      reason: `Targeted positive recall mapped through ${band} response and hint/attempt caps.`,
    };
  }

  return {
    ...base,
    action: 'none',
    reason: 'Observation does not represent a terminal scheduler review.',
  };
}
