import { expect, it } from 'vitest';
import { hintDisclosure } from '../training/session';
import { createGraphExercisePlan } from './exercisePlan';
import { previewPgnImport } from './pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from './trainingIntegration';

it('derives progressive hints for imported repertoire decisions without recording an observation', () => {
  const candidate = previewPgnImport('1. e4 e5 2. Nf3 Nc6 *', {
    repertoireId: 'imported-hints',
    repertoireName: 'Imported hints',
    userColour: 'white',
  });
  expect(candidate.errors).toEqual([]);
  const graph = candidate.proposedGraph;
  const rootContextId = graph.repertoires[0]!.rootContextIds[0]!;
  const plan = createGraphExercisePlan(graph, {
    repertoireId: 'imported-hints',
    rootContextId,
    targetContextId: rootContextId,
  });
  const firstStep = plan.steps.find((step) => step.id === rootContextId)!;

  expect(firstStep.hint).toEqual({
    piece: 'pawn on e2',
    candidateDestinations: ['e3', 'e4'],
    purpose: 'The repertoire move heads toward the centre.',
  });

  let state = createGraphTrainingSession(plan, 0, { sessionId: 'hint-session' });
  state = reduceGraphTrainingSession(state, plan, { type: 'request-hint' });
  expect(state.hintLevel).toBe(1);
  expect(state.evidence).toHaveLength(0);
  expect(hintDisclosure(state, plan)).toBe('Piece: pawn on e2.');

  state = reduceGraphTrainingSession(state, plan, { type: 'request-hint' });
  expect(state.hintLevel).toBe(2);
  expect(state.evidence).toHaveLength(0);
  expect(hintDisclosure(state, plan)).toBe(
    'Piece: pawn on e2. Candidate destinations: e3, e4.',
  );

  state = reduceGraphTrainingSession(state, plan, {
    type: 'user-move',
    move: { from: 'e2', to: 'e4' },
    nowMs: 1_000,
    observedAt: '2026-09-02T10:00:01.000Z',
  });
  expect(state.evidence).toHaveLength(1);
  expect(state.evidence[0]?.outcome).toBe('hinted-correct');
  expect(state.evidence[0]?.hintLevel).toBe(2);
});

it('keeps structural hints compatible with multiple accepted repertoire moves', () => {
  const candidate = previewPgnImport('1. e4 e5 2. Nf3 (2. Nc3) *', {
    repertoireId: 'alternative-hints',
    repertoireName: 'Alternative hints',
    userColour: 'white',
  });
  expect(candidate.errors).toEqual([]);
  const graph = candidate.proposedGraph;
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const branch = graph.contexts.find((context) => {
    const sans = graph.moves
      .filter((move) => move.contextId === context.id && move.actor === 'user')
      .map((move) => edges.get(move.edgeId)?.san)
      .filter((san): san is string => Boolean(san))
      .sort();
    return sans.join('|') === 'Nc3|Nf3';
  });
  expect(branch).toBeDefined();
  const rootContextId = graph.repertoires[0]!.rootContextIds[0]!;
  const plan = createGraphExercisePlan(graph, {
    repertoireId: 'alternative-hints',
    rootContextId,
    targetContextId: branch!.id,
  });
  const branchStep = plan.steps.find((step) => step.id === branch!.id)!;

  expect(branchStep.hint?.piece).toBe('one of: knight on b1 or knight on g1');
  expect(branchStep.hint?.candidateDestinations).toEqual([
    'a3',
    'c3',
    'e2',
    'f3',
    'h3',
  ]);
});
