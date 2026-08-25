import type { ChessMoveInput } from '../chess/chessAdapter';
import {
  fix01White,
  fix02Black,
  type TrainingFixture,
} from '../../fixtures/trainingFixtures';
import {
  compileTrainingFixture,
  type TrainingExercisePlan,
} from './exercisePlan';
import {
  createTrainingSession,
  currentExerciseStep,
  hintDisclosure,
  readyRetestCount,
  reduceTrainingSession,
  type TrainingSessionState,
} from './session';

function planFor(fixture: TrainingFixture): TrainingExercisePlan {
  return compileTrainingFixture(fixture);
}

function expectedMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
): ChessMoveInput {
  const step = currentExerciseStep(state, plan);
  const move = step?.acceptedMoves.find(
    (candidate) => candidate.uci === step.selectedMoveUci,
  );
  if (!move) throw new Error('Expected an active selected move.');
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion ? { promotion: move.promotion } : {}),
  };
}

function playToPly(
  plan: TrainingExercisePlan,
  targetPly: number,
  startedAtMs = 0,
) {
  let state = createTrainingSession(plan, startedAtMs);
  let now = startedAtMs + 10;
  while (state.plyIndex < targetPly) {
    if (state.status === 'opponent-moving') {
      state = reduceTrainingSession(state, plan, {
        type: 'opponent-tick',
        nowMs: now,
      });
    } else if (state.status === 'correct-feedback') {
      state = reduceTrainingSession(state, plan, { type: 'continue', nowMs: now });
    } else if (state.status === 'awaiting-user-move') {
      state = reduceTrainingSession(state, plan, {
        type: 'user-move',
        move: expectedMove(state, plan),
        nowMs: now,
      });
    } else {
      throw new Error(`Unexpected status ${state.status}`);
    }
    now += 10;
  }
  if (state.status === 'correct-feedback') {
    state = reduceTrainingSession(state, plan, { type: 'continue', nowMs: now });
  }
  return state;
}

function playLineCorrectly(plan: TrainingExercisePlan, startedAtMs = 0) {
  let state = createTrainingSession(plan, startedAtMs);
  let now = startedAtMs + 10;
  let guard = 0;
  while (state.status !== 'line-complete' && guard < 100) {
    guard += 1;
    if (state.status === 'opponent-moving') {
      state = reduceTrainingSession(state, plan, {
        type: 'opponent-tick',
        nowMs: now,
      });
    } else if (state.status === 'correct-feedback') {
      state = reduceTrainingSession(state, plan, { type: 'continue', nowMs: now });
    } else if (state.status === 'awaiting-user-move') {
      state = reduceTrainingSession(state, plan, {
        type: 'user-move',
        move: expectedMove(state, plan),
        nowMs: now,
      });
    } else {
      throw new Error(`Unexpected status ${state.status}`);
    }
    now += 10;
  }
  if (guard >= 100) throw new Error('Exercise did not complete.');
  return state;
}

describe('hardened training session reducer', () => {
  it('plays complete white and black exercise plans from the initial position', () => {
    const white = planFor(fix01White);
    const black = planFor(fix02Black);
    expect(playLineCorrectly(white, 1000).plyIndex).toBe(white.totalPlies);
    expect(createTrainingSession(black, 2000).status).toBe('opponent-moving');
    expect(playLineCorrectly(black, 2000).status).toBe('line-complete');
  });

  it('accumulates illegal attempts without creating repeated full review observations', () => {
    const plan = planFor(fix01White);
    const start = createTrainingSession(plan, 3000);
    const illegal = reduceTrainingSession(start, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e5' },
      nowMs: 3100,
    });
    expect(illegal.status).toBe('illegal-feedback');
    expect(illegal.evidence).toHaveLength(0);
    expect(illegal.illegalAttemptCount).toBe(1);
    const correct = reduceTrainingSession(illegal, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 3200,
    });
    expect(correct.evidence).toHaveLength(1);
    expect(correct.evidence[0]?.illegalAttemptCount).toBe(1);
  });

  it('distinguishes invalid plan state from an illegal user move', () => {
    const plan = planFor(fix01White);
    const start = { ...createTrainingSession(plan, 3000), fen: 'not a fen' };
    const result = reduceTrainingSession(start, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 3100,
    });
    expect(result.status).toBe('error');
    expect(result.feedback?.title).toBe('Training position error');
  });

  it('distinguishes a known sibling variation from legal outside repertoire', () => {
    const plan = planFor(fix01White);
    const target = playToPly(plan, 2, 4000);
    const sibling = reduceTrainingSession(target, plan, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 4100,
    });
    expect(sibling.status).toBe('wrong-variation-feedback');
    expect(sibling.evidence.at(-1)?.confusionContextId).toBeDefined();
    const outside = reduceTrainingSession(target, plan, {
      type: 'user-move',
      move: { from: 'd2', to: 'd4' },
      nowMs: 4100,
    });
    expect(outside.status).toBe('outside-repertoire-feedback');
    expect(outside.evidence.at(-1)?.confusionContextId).toBeUndefined();
  });

  it('discloses hints progressively and reveals the selected route move only at level four', () => {
    const plan = planFor(fix01White);
    let state = playToPly(plan, 2, 5000);
    state = reduceTrainingSession(state, plan, { type: 'request-hint' });
    expect(hintDisclosure(state, plan)).toContain('kingside knight');
    expect(hintDisclosure(state, plan)).not.toContain('Nf3');
    state = reduceTrainingSession(state, plan, { type: 'request-hint' });
    state = reduceTrainingSession(state, plan, { type: 'request-hint' });
    expect(hintDisclosure(state, plan)).not.toContain('Move: Nf3');
    state = reduceTrainingSession(state, plan, { type: 'reveal', nowMs: 5300 });
    expect(hintDisclosure(state, plan)).toContain('Nf3');
    expect(state.evidence.at(-1)?.outcome).toBe('revealed');
  });

  it('preserves original failure, separate repair, and delayed retest', () => {
    const plan = planFor(fix01White);
    let state = playToPly(plan, 2, 6000);
    state = reduceTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 6100,
    });
    state = reduceTrainingSession(state, plan, { type: 'continue', nowMs: 6110 });
    state = reduceTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'g1', to: 'f3' },
      nowMs: 6200,
    });
    expect(state.evidence.map((item) => item.outcome)).toEqual([
      'correct',
      'wrong-variation',
      'repair-correct',
    ]);
    state = reduceTrainingSession(state, plan, { type: 'continue', nowMs: 6210 });
    state = reduceTrainingSession(state, plan, {
      type: 'opponent-tick',
      nowMs: 6220,
    });
    state = reduceTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'f1', to: 'b5' },
      nowMs: 6300,
    });
    expect(readyRetestCount(state)).toBe(1);
  });

  it('uses monotonic time for response duration and wall time for the timestamp', () => {
    const plan = planFor(fix01White);
    const start = createTrainingSession(plan, {
      wallMs: 10_000,
      monotonicMs: 500,
    });
    const correct = reduceTrainingSession(start, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: { wallMs: 10_900, monotonicMs: 850 },
    });
    expect(correct.evidence[0]?.responseTimeMs).toBe(350);
    expect(correct.evidence[0]?.observedAt).toBe(new Date(10_900).toISOString());
  });

  it('supports abandonment and deterministic restart with an injected session identity', () => {
    const plan = planFor(fix01White);
    const start = createTrainingSession(plan, 8000, { sessionId: 'session-a' });
    const abandoned = reduceTrainingSession(start, plan, { type: 'abandon' });
    const restarted = reduceTrainingSession(abandoned, plan, {
      type: 'restart',
      nowMs: 9000,
      sessionId: 'session-b',
    });
    expect(start.status).toBe('awaiting-user-move');
    expect(abandoned.status).toBe('abandoned');
    expect(restarted.sessionId).toBe('session-b');
    expect(restarted.evidence).toHaveLength(0);
  });
});
