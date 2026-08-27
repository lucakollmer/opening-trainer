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

function expectedMove(state: TrainingSessionState, fixture: TrainingFixture) {
  const step = currentFixtureStep(state, fixture);
  if (!step) throw new Error('Expected a route step.');
  return {
    from: step.from,
    to: step.to,
    ...(step.promotion ? { promotion: step.promotion } : {}),
  };
}

function driveCorrectly(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  startedAtMs = 10,
): TrainingSessionState {
  let nowMs = startedAtMs;
  let guard = 0;
  while (guard < 100 && state.status !== 'line-complete') {
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
      throw new Error(`Unexpected status: ${state.status}`);
    }
    nowMs += 10;
  }
  if (guard >= 100) throw new Error('Fixture line did not complete deterministically.');
  return state;
}

function playCorrectly(fixture: TrainingFixture) {
  return driveCorrectly(
    createTrainingSession(fixture, 0, { sessionId: `${fixture.id}-test` }),
    fixture,
  );
}

function reachWhiteTarget(startedAtMs = 0): TrainingSessionState {
  let state = createTrainingSession(fix01White, startedAtMs, {
    sessionId: `target-${startedAtMs}`,
  });
  state = reduceTrainingSession(state, fix01White, {
    type: 'user-move',
    move: { from: 'e2', to: 'e4' },
    nowMs: startedAtMs + 10,
  });
  state = reduceTrainingSession(state, fix01White, {
    type: 'continue',
    nowMs: startedAtMs + 20,
  });
  state = reduceTrainingSession(state, fix01White, {
    type: 'opponent-tick',
    nowMs: startedAtMs + 30,
  });
  return state;
}

describe('hardened training session reducer', () => {
  it('preserves deterministic complete-line replay for both colours and targeted evidence semantics', () => {
    const white = playCorrectly(fix01White);
    expect(white.status).toBe('line-complete');
    expect(white.evidence.filter((item) => item.outcome === 'correct')).toHaveLength(4);
    expect(
      white.evidence.filter((item) => item.evidenceRole === 'targeted'),
    ).toHaveLength(1);
    expect(playCorrectly(fix02Black).status).toBe('line-complete');
  });

  it('accumulates illegal attempts and records them on the terminal observation', () => {
    let state = createTrainingSession(fix01White, 1000, { sessionId: 'illegal' });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e5' },
      nowMs: 1100,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e6' },
      nowMs: 1150,
    });
    expect(state.evidence).toHaveLength(0);
    expect(state.illegalAttemptCount).toBe(2);

    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 1200,
    });
    expect(state.evidence).toHaveLength(1);
    expect(state.evidence[0]?.illegalAttemptCount).toBe(2);
  });

  it('keeps sibling variation distinct from legal outside-repertoire play', () => {
    const state = reachWhiteTarget(2000);
    const sibling = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 2040,
    });
    const outside = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'd2', to: 'd4' },
      nowMs: 2040,
    });
    expect(sibling.status).toBe('wrong-variation-feedback');
    expect(sibling.evidence.at(-1)?.confusionContextId).toBeDefined();
    expect(outside.status).toBe('outside-repertoire-feedback');
    expect(outside.evidence.at(-1)?.confusionContextId).toBeUndefined();
  });

  it('preserves progressive hints and full reveal only at level four', () => {
    let state = reachWhiteTarget(3000);
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');
    state = reduceTrainingSession(state, fix01White, { type: 'reveal', nowMs: 3100 });
    expect(hintDisclosure(state, fix01White)).toContain('Nf3');
    expect(state.evidence.at(-1)?.outcome).toBe('revealed');
  });

  it('keeps the original failure, records repair separately, and ages delayed retest only after a later user decision', () => {
    let state = reachWhiteTarget(4000);
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 4040,
    });
    expect(state.retestQueue[0]?.separationRemaining).toBe(1);
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 4050 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'g1', to: 'f3' },
      nowMs: 4060,
    });
    expect(state.evidence.map((item) => item.outcome)).toEqual([
      'correct',
      'wrong-variation',
      'repair-correct',
    ]);
    expect(state.retestQueue[0]?.separationRemaining).toBe(1);

    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 4070 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'opponent-tick',
      nowMs: 4080,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'f1', to: 'b5' },
      nowMs: 4090,
    });
    expect(readyRetestCount(state)).toBe(1);
  });

  it('restarts a ready retest from move one and retargets the failed decision', () => {
    let state = reachWhiteTarget(5000);
    state = reduceTrainingSession(state, fix01White, { type: 'reveal', nowMs: 5040 });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 5050 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'g1', to: 'f3' },
      nowMs: 5060,
    });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 5070 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'opponent-tick',
      nowMs: 5080,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'f1', to: 'b5' },
      nowMs: 5090,
    });
    state = driveCorrectly(state, fix01White, 5100);
    expect(readyRetestCount(state)).toBe(1);

    const retest = reduceTrainingSession(state, fix01White, {
      type: 'start-retest',
      nowMs: 6000,
    });
    expect(retest.runKind).toBe('retest');
    expect(retest.plyIndex).toBe(0);
    expect(retest.fen).toBe(fix01White.initialFen);
    expect(retest.targetPly).toBe(fix01White.targetPly);
    expect(retest.retestQueue).toHaveLength(0);
  });

  it('supports abandonment and deterministic restart without mutating the prior state', () => {
    const start = createTrainingSession(fix01White, 7000, { sessionId: 'restart' });
    const snapshot = JSON.stringify(start);
    const abandoned = reduceTrainingSession(start, fix01White, { type: 'abandon' });

    expect(start.status).toBe('awaiting-user-move');
    expect(JSON.stringify(start)).toBe(snapshot);
    expect(abandoned.status).toBe('abandoned');

    const restarted = reduceTrainingSession(abandoned, fix01White, {
      type: 'restart',
      nowMs: 8000,
    });
    expect(restarted.status).toBe('awaiting-user-move');
    expect(restarted.fen).toBe(fix01White.initialFen);
    expect(restarted.evidence).toHaveLength(0);
    expect(restarted.sessionId).toBe(start.sessionId);
  });

  it('produces the same deterministic opponent result for the same fixture state', () => {
    const first = createTrainingSession(fix02Black, 9000, { sessionId: 'first' });
    const second = createTrainingSession(fix02Black, 9000, { sessionId: 'second' });

    const firstAfter = reduceTrainingSession(first, fix02Black, {
      type: 'opponent-tick',
      nowMs: 9010,
    });
    const secondAfter = reduceTrainingSession(second, fix02Black, {
      type: 'opponent-tick',
      nowMs: 9010,
    });

    expect(firstAfter.fen).toBe(secondAfter.fen);
    expect(firstAfter.lastMove?.uci).toBe('e2e4');
    expect(firstAfter.currentStepId).toBe(secondAfter.currentStepId);
    expect(firstAfter.status).toBe(secondAfter.status);
  });

  it('subtracts a blocking promotion-dialog pause from response duration', () => {
    let state = createTrainingSession(fix01White, 1000, { sessionId: 'pause' });
    state = reduceTrainingSession(state, fix01White, {
      type: 'pause-attempt',
      nowMs: 1100,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'resume-attempt',
      nowMs: 5100,
    });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 5200,
    });
    expect(state.evidence[0]?.responseTimeMs).toBe(200);
  });
});
