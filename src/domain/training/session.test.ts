import {
  fix01White,
  fix02Black,
  type TrainingFixture,
} from '../../fixtures/trainingFixtures';
import {
  createTrainingSession,
  currentFixtureStep,
  hintDisclosure,
  reduceTrainingSession,
} from './session';

function playCorrectly(fixture: TrainingFixture) {
  let state = createTrainingSession(fixture, 0, { sessionId: `${fixture.id}-test` });
  let nowMs = 10;
  for (let guard = 0; guard < 100 && state.status !== 'line-complete'; guard += 1) {
    if (state.status === 'opponent-moving') {
      state = reduceTrainingSession(state, fixture, { type: 'opponent-tick', nowMs });
    } else if (state.status === 'correct-feedback') {
      state = reduceTrainingSession(state, fixture, { type: 'continue', nowMs });
    } else if (state.status === 'awaiting-user-move') {
      const step = currentFixtureStep(state, fixture);
      if (!step) throw new Error('Expected a route step.');
      state = reduceTrainingSession(state, fixture, {
        type: 'user-move',
        move: {
          from: step.from,
          to: step.to,
          ...(step.promotion ? { promotion: step.promotion } : {}),
        },
        nowMs,
      });
    } else {
      throw new Error(`Unexpected status: ${state.status}`);
    }
    nowMs += 10;
  }
  return state;
}

describe('hardened training session reducer', () => {
  it('preserves deterministic complete-line replay for both colours', () => {
    expect(playCorrectly(fix01White).status).toBe('line-complete');
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
    let state = createTrainingSession(fix01White, 2000, { sessionId: 'variation' });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 2010,
    });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 2020 });
    state = reduceTrainingSession(state, fix01White, { type: 'opponent-tick', nowMs: 2030 });

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
    let state = createTrainingSession(fix01White, 3000, { sessionId: 'hint' });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 3010,
    });
    state = reduceTrainingSession(state, fix01White, { type: 'continue', nowMs: 3020 });
    state = reduceTrainingSession(state, fix01White, { type: 'opponent-tick', nowMs: 3030 });
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    state = reduceTrainingSession(state, fix01White, { type: 'request-hint' });
    expect(hintDisclosure(state, fix01White)).not.toContain('Nf3');
    state = reduceTrainingSession(state, fix01White, { type: 'reveal', nowMs: 3100 });
    expect(hintDisclosure(state, fix01White)).toContain('Nf3');
    expect(state.evidence.at(-1)?.outcome).toBe('revealed');
  });

  it('subtracts a blocking promotion-dialog pause from response duration', () => {
    let state = createTrainingSession(fix01White, 1000, { sessionId: 'pause' });
    state = reduceTrainingSession(state, fix01White, { type: 'pause-attempt', nowMs: 1100 });
    state = reduceTrainingSession(state, fix01White, { type: 'resume-attempt', nowMs: 5100 });
    state = reduceTrainingSession(state, fix01White, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 5200,
    });
    expect(state.evidence[0]?.responseTimeMs).toBe(200);
  });
});
