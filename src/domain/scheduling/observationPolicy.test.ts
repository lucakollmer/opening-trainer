import type { ReviewObservation } from '../training/session';
import { createEmptySchedulerState, type SchedulerState } from './schedulerPort';
import { mapObservationToSchedulerDecision } from './observationPolicy';

function observation(patch: Partial<ReviewObservation> = {}): ReviewObservation {
  return {
    id: 'obs-1',
    trainingItemId: 'item-1',
    sessionId: 'session-1',
    observedAt: '2026-08-28T10:00:00.000Z',
    evidenceRole: 'targeted',
    outcome: 'correct',
    responseTimeMs: 6_000,
    hintLevel: 0,
    illegalAttemptCount: 0,
    expectedMoveSetKey: 'e2e4',
    ...patch,
  };
}

function mature(): SchedulerState {
  return {
    ...createEmptySchedulerState(new Date('2026-08-01T10:00:00.000Z')),
    dueAt: '2026-08-28T09:00:00.000Z',
    stage: 'review',
    stability: 14,
    difficulty: 4,
    reps: 8,
    lastReviewAt: '2026-08-14T10:00:00.000Z',
  };
}

describe('chess-to-FSRS policy v1', () => {
  it('maps new Again/Hard/Good and keeps Easy conservative', () => {
    const state = createEmptySchedulerState(new Date('2026-08-28T10:00:00.000Z'));
    expect(
      mapObservationToSchedulerDecision(
        observation({ outcome: 'outside-repertoire' }),
        state,
      ).grade,
    ).toBe('Again');
    expect(
      mapObservationToSchedulerDecision(
        observation({ outcome: 'hesitant-correct', responseTimeMs: 30_000 }),
        state,
      ).grade,
    ).toBe('Hard');
    expect(mapObservationToSchedulerDecision(observation(), state).grade).toBe('Good');
    expect(
      mapObservationToSchedulerDecision(
        observation({ outcome: 'instant-correct', responseTimeMs: 500 }),
        state,
      ).grade,
    ).toBe('Good');
  });

  it('permits Easy only for mature fast unhinted recall', () => {
    expect(
      mapObservationToSchedulerDecision(
        observation({ outcome: 'instant-correct', responseTimeMs: 900 }),
        mature(),
      ).grade,
    ).toBe('Easy');
    expect(
      mapObservationToSchedulerDecision(
        observation({ responseTimeMs: 2_000 }),
        mature(),
      ).grade,
    ).toBe('Easy');
  });

  it.each([
    [1, 'Good'],
    [2, 'Hard'],
    [3, 'Hard'],
    [4, 'Again'],
  ] as const)('applies hint level %i cap %s', (hintLevel, expected) => {
    const outcome = hintLevel === 4 ? 'revealed' : 'hinted-correct';
    expect(
      mapObservationToSchedulerDecision(
        observation({
          outcome,
          hintLevel,
          responseTimeMs: 500,
        }),
        mature(),
      ).grade,
    ).toBe(expected);
  });

  it('keeps repair and positive incidental evidence scheduler-neutral', () => {
    expect(
      mapObservationToSchedulerDecision(
        observation({ outcome: 'repair-correct' }),
        mature(),
      ).action,
    ).toBe('none');
    expect(
      mapObservationToSchedulerDecision(
        observation({ evidenceRole: 'incidental', responseTimeMs: 300 }),
        mature(),
      ).action,
    ).toBe('none');
  });

  it('promotes incidental failure instead of advancing FSRS', () => {
    const result = mapObservationToSchedulerDecision(
      observation({ evidenceRole: 'incidental', outcome: 'wrong-variation' }),
      mature(),
    );
    expect(result.action).toBe('promote-target');
    expect(result.grade).toBeUndefined();
  });

  it('caps several illegal attempts at Hard on eventual success', () => {
    expect(
      mapObservationToSchedulerDecision(
        observation({ responseTimeMs: 700, illegalAttemptCount: 3 }),
        mature(),
      ).grade,
    ).toBe('Hard');
  });
});
