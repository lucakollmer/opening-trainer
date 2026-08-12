import type { ChessMoveInput } from '../chess/chessAdapter';
import {
  fix01White,
  fix02Black,
  type TrainingFixture,
} from '../../fixtures/trainingFixtures';
import {
  createTrainingSession,
  currentFixtureStep,
  hintDisclosure,
  readyRetestCount,
  reduceTrainingSession,
  type TrainingSessionState,
} from './session';

function expectedMove(
  state: TrainingSessionState,
  fixture: TrainingFixture,
): ChessMoveInput {
  const step = currentFixtureStep(state, fixture);
  if (!step) throw new Error('Expected an active fixture step.');
  return {
    from: step.from,
    to: step.to,
    ...(step.promotion ? { promotion: step.promotion } : {}),
  };
}

function continueCorrect(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  return reduceTrainingSession(state, fixture, { type: 'continue', nowMs });
}

function playToPly(
  fixture: TrainingFixture,
  targetPly: number,
  startedAtMs = 0,
): TrainingSessionState {
  let state = createTrainingSession(fixture, startedAtMs);
  let nowMs = startedAtMs + 10;

  while (state.plyIndex < targetPly) {
    if (state.status === 'opponent-moving') {
      state = reduceTrainingSession(state, fixture, { type: 'opponent-tick', nowMs });
      nowMs += 10;
      continue;
    }

    if (state.status === 'correct-feedback') {
      state = continueCorrect(state, fixture, nowMs);
      nowMs += 10;
      continue;
    }

    if (state.status !== 'awaiting-user-move') {
      throw new Error(`Unexpected status while advancing fixture: ${state.status}`);
    }

    state = reduceTrainingSession(state, fixture, {
      type: 'user-move',
      move: expectedMove(state, fixture),
      nowMs,
    });
    nowMs += 10;
  }

  if (state.status === 'correct-feedback') {
    state = continueCorrect(state, fixture, nowMs);
  }

  return state;
}

function playLineCorrectly(
  fixture: TrainingFixture,
  startedAtMs = 0,
): TrainingSessionState {
  let state = createTrainingSession(fixture, startedAtMs);
  let nowMs = startedAtMs + 10;
  let guard = 0;

  while (state.status !== 'line-complete' && guard < 100) {
    guard += 1;
    if (state.status === 'opponent-moving') {
      state = reduceTrainingSession(state, fixture, { type: 'opponent-tick', nowMs });
    } else if (state.status === 'correct-feedback') {
      state = reduceTrainingSession(state, fixture, { type: 'continue', nowMs });
    } else if (state.status === 'awaiting-user-move') {
      state = reduceTrainingSession(state, fixture, {
        type: 'user-move',
        move: expectedMove(state, fixture),
        nowMs,
      });
    } else {
      throw new Error(`Unexpected status in correct line: ${state.status}`);
    }
    nowMs += 10;
  }

  if (guard >= 100) throw new Error('Fixture line did not complete deterministically.');
  return state;
}

describe('PHASE-2 training session reducer', () => {
  it('plays the complete white fixture line from the initial position', () => {
    const state = playLineCorrectly(fix01White, 1000);

    expect(state.status).toBe('line-complete');
    expect(state.plyIndex).toBe(fix01White.route.length);
    expect(state.treeRevealedPlyCount).toBe(fix01White.route.length);
    expect(state.evidence.filter((item) => item.outcome === 'correct')).toHaveLength(4);
    expect(
      state.evidence.filter((item) => item.evidenceRole === 'targeted'),
    ).toHaveLength(1);
  });

  it('plays the black fixture with deterministic opponent-first actor assignment', () => {
    const start = createTrainingSession(fix02Black, 2000);
    expect(start.status).toBe('opponent-moving');
    expect(fix02Black.orientation).toBe('black');

    const complete = playLineCorrectly(fix02Black, 2000);
    expect(complete.status).toBe('line-complete');
    expect(complete.plyIndex).toBe(fix02Black.route.length);
  });

  it('keeps an illegal attempt in place and carries its count into the eventual recall evidence', () => {
    const start = createTrainingSession(fix01White, 3000);
    const illegal = reduceTrainingSession(start, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e5' },
      nowMs: 3100,
    });

    expect(illegal.status).toBe('illegal-feedback');
    expect(illegal.fen).toBe(fix01White.initialFen);
    expect(illegal.plyIndex).toBe(0);
    expect(illegal.evidence.at(-1)?.outcome).toBe('illegal-attempt');

    const correct = reduceTrainingSession(illegal, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 3200,
    });
    expect(correct.status).toBe('correct-feedback');
    expect(correct.evidence.at(-1)?.illegalAttemptCount).toBe(1);
  });

  it('distinguishes a known wrong sibling variation from a legal outside-repertoire move', () => {
    const target = playToPly(fix01White, 2, 4000);
    expect(target.status).toBe('awaiting-user-move');

    const sibling = reduceTrainingSession(target, fix01White, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 4100,
    });
    expect(sibling.status).toBe('wrong-variation-feedback');
    expect(sibling.evidence.at(-1)?.outcome).toBe('wrong-variation');
    expect(sibling.evidence.at(-1)?.confusionContextId).toBeDefined();

    const outside = reduceTrainingSession(target, fix01White, {
      type: 'user-move',
      move: { from: 'd2', to: 'd4' },
      nowMs: 4100,
    });
    expect(outside.status).toBe('outside-repertoire-feedback');
    expect(outside.evidence.at(-1)?.outcome).toBe('outside-repertoire');
    expect(outside.evidence.at(-1)?.confusionContextId).toBeUndefined();
  });

  it('discloses hints progressively and reveals the full answer only at level four', () => {
    let state = playToPly(fix01White, 2, 5000);
    expect(hintDisclosure(state, fix01White)).toBeNull();

    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(state.hintLevel).toBe(1);
    expect(hintDisclosure(state, fix01White)).toContain('kingside knight');
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');

    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(state.hintLevel).toBe(2);
    expect(hintDisclosure(state, fix01White)).toContain('f3');
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');

    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(state.hintLevel).toBe(3);
    expect(hintDisclosure(state, fix01White)).toContain('pressure on the e5 pawn');
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');

    state = reduceTrainingSession(state, fix01White, { type: 'reveal', nowMs: 5300 });
    expect(state.hintLevel).toBe(4);
    expect(hintDisclosure(state, fix01White)).toContain('Nf3');
    expect(state.evidence.at(-1)?.outcome).toBe('revealed');
    expect(state.retestQueue).toHaveLength(1);
  });

  it('keeps the original failure, records repair separately, and makes the delayed retest ready after a later user decision', () => {
    let state = playToPly(fix01White, 2, 6000);
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 6100,
    });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 6110 });
    expect(state.status).toBe('repair-replay');

    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'g1', to: 'f3' },
      nowMs: 6200,
    });
    expect(state.evidence.map((item) => item.outcome)).toEqual([
      'correct',
      'wrong-variation',
      'repair-correct',
    ]);
    expect(state.retestQueue[0]?.separationRemaining).toBe(1);

    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 6210 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'opponent-tick',
      nowMs: 6220,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'f1', to: 'b5' },
      nowMs: 6300,
    });

    expect(readyRetestCount(state)).toBe(1);
  });

  it('restarts a ready retest from move one and retargets the failed decision', () => {
    let state = playToPly(fix01White, 2, 7000);
    state = reduceTrainingSession(state, fix01White, { type: 'reveal', nowMs: 7100 });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 7110 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'g1', to: 'f3' },
      nowMs: 7200,
    });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 7210 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'opponent-tick',
      nowMs: 7220,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'f1', to: 'b5' },
      nowMs: 7300,
    });

    while (state.status !== 'line-complete') {
      if (state.status === 'correct-feedback') {
        state = reduceTrainingSession(state, fix01White, {
          type: 'continue',
          nowMs: 7400,
        });
      } else if (state.status === 'opponent-moving') {
        state = reduceTrainingSession(state, fix01White, {
          type: 'opponent-tick',
          nowMs: 7410,
        });
      } else if (state.status === 'awaiting-user-move') {
        state = reduceTrainingSession(state, fix01White, {
          type: 'user-move',
          move: expectedMove(state, fix01White),
          nowMs: 7420,
        });
      } else {
        throw new Error(`Unexpected status before retest: ${state.status}`);
      }
    }

    expect(readyRetestCount(state)).toBe(1);
    const retest = reduceTrainingSession(state, fix01White, {
      type: 'start-retest',
      nowMs: 7500,
    });
    expect(retest.runKind).toBe('retest');
    expect(retest.plyIndex).toBe(0);
    expect(retest.fen).toBe(fix01White.initialFen);
    expect(retest.targetPly).toBe(2);
    expect(retest.retestQueue).toHaveLength(0);
  });

  it('supports abandonment and deterministic restart without mutating the prior state', () => {
    const start = createTrainingSession(fix01White, 8000);
    const snapshot = JSON.stringify(start);
    const abandoned = reduceTrainingSession(start, fix01White, { type: 'abandon' });

    expect(start.status).toBe('awaiting-user-move');
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(abandoned.status).toBe('abandoned');

    const restarted = reduceTrainingSession(abandoned, fix01White, {
      type: 'restart',
      nowMs: 9000,
    });
    expect(restarted.status).toBe('awaiting-user-move');
    expect(restarted.fen).toBe(fix01White.initialFen);
    expect(restarted.evidence).toHaveLength(0);
  });

  it('produces the same deterministic opponent result for the same fixture state', () => {
    const first = createTrainingSession(fix02Black, 10000);
    const second = createTrainingSession(fix02Black, 10000);

    const firstAfter = reduceTrainingSession(first, fix02Black, {
      type: 'opponent-tick',
      nowMs: 10010,
    });
    const secondAfter = reduceTrainingSession(second, fix02Black, {
      type: 'opponent-tick',
      nowMs: 10010,
    });

    expect(firstAfter.fen).toBe(secondAfter.fen);
    expect(firstAfter.lastMove?.uci).toBe('e2e4');
    expect(firstAfter).toEqual(secondAfter);
  });
});
