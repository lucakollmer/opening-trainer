import { describe, expect, it } from 'vitest';
import { phase3DemoGraph } from '../../fixtures/phase3Demo';
import { createGraphTrainingSession } from '../repertoire/trainingIntegration';
import { hintDisclosure } from '../training/session';
import {
  PHASE6_CONTRAST_WINDOW_DAYS,
  contrastPairId,
  insideContrastWindow,
} from './contrast';
import { createPhase6GraphExercisePlan } from './exercisePlan';
import {
  normalizeOpeningName,
  openingNameAnswerSetKey,
  openingNameMatches,
  validateOpeningNameLabels,
} from './nameRecall';
import { reducePhase6TrainingSession } from './trainingIntegration';

describe('PHASE-6 pure contracts', () => {
  it('normalizes opening names conservatively without fuzzy punctuation rules', () => {
    expect(normalizeOpeningName('  Sicilian   Defence ')).toBe('sicilian defence');
    expect(openingNameAnswerSetKey(['Sicilian Defence', 'Sicilian Defense'])).toBe(
      'sicilian defence\u001fsicilian defense',
    );
    expect(
      openingNameMatches(
        'SICILIAN DEFENCE',
        'sicilian defence\u001fsicilian defense',
      ),
    ).toBe(true);
    expect(openingNameMatches('Sicilian-Defence', 'sicilian defence')).toBe(false);
    expect(() =>
      validateOpeningNameLabels('Sicilian Defence', ['sicilian defence']),
    ).toThrow(/unique/u);
  });

  it('uses a directional contrast identity and an exact thirty-day boundary', () => {
    expect(contrastPairId('expected', 'sibling')).toBe(
      'contrast:expected->sibling',
    );
    const now = new Date('2026-09-03T12:00:00.000Z');
    expect(insideContrastWindow('2026-08-04T12:00:00.000Z', now)).toBe(true);
    expect(insideContrastWindow('2026-08-04T11:59:59.999Z', now)).toBe(false);
    expect(PHASE6_CONTRAST_WINDOW_DAYS).toBe(30);
  });

  it('keeps authored guidance out of disclosure until Hint 3', () => {
    const repertoire = phase3DemoGraph.repertoires[0]!;
    const rootContextId = repertoire.rootContextIds[0]!;
    const rootMove = phase3DemoGraph.moves.find(
      (move) => move.contextId === rootContextId && move.actor === 'user',
    );
    expect(rootMove).toBeDefined();
    const graph = {
      ...phase3DemoGraph,
      moves: phase3DemoGraph.moves.map((move) =>
        move.id === rootMove!.id
          ? { ...move, purpose: 'Claim central space before developing.' }
          : move,
      ),
    };
    const plan = createPhase6GraphExercisePlan(graph, {
      repertoireId: repertoire.id,
      rootContextId,
      targetContextId: rootContextId,
    });
    let state = createGraphTrainingSession(plan, 1_000, {
      sessionId: 'phase6-authored-hint',
    });

    expect(hintDisclosure(state, plan)).toBeNull();
    state = reducePhase6TrainingSession(state, plan, { type: 'request-hint' });
    expect(hintDisclosure(state, plan)).not.toContain('Claim central space');
    state = reducePhase6TrainingSession(state, plan, { type: 'request-hint' });
    expect(hintDisclosure(state, plan)).not.toContain('Claim central space');
    state = reducePhase6TrainingSession(state, plan, { type: 'request-hint' });
    expect(hintDisclosure(state, plan)).toContain(
      'Claim central space before developing.',
    );
  });

  it('adds exact context only to newly-created PHASE-6 move evidence', () => {
    const repertoire = phase3DemoGraph.repertoires[0]!;
    const rootContextId = repertoire.rootContextIds[0]!;
    const plan = createPhase6GraphExercisePlan(phase3DemoGraph, {
      repertoireId: repertoire.id,
      rootContextId,
      targetContextId: rootContextId,
    });
    const state = createGraphTrainingSession(plan, 1_000, {
      sessionId: 'phase6-context-evidence',
    });
    const step = plan.steps.find((candidate) => candidate.id === state.currentStepId)!;
    const next = reducePhase6TrainingSession(state, plan, {
      type: 'user-move',
      move: { from: step.from, to: step.to, ...(step.promotion ? { promotion: step.promotion } : {}) },
      nowMs: 1_500,
      observedAt: '2026-09-03T12:00:00.000Z',
    });
    expect(next.evidence).toHaveLength(1);
    expect(next.evidence[0]).toMatchObject({ contextId: rootContextId });
  });
});
