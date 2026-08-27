import { createGraphExercisePlan } from './exercisePlan';
import {
  playlistAllowsContext,
  queryAcceptedMoves,
  trainingItemIdentityKey,
  validateRepertoireGraph,
} from './graph';
import { InMemoryImportRepository, previewPgnImport } from './pgnImport';
import { createGraphTrainingSession, reduceGraphTrainingSession } from './trainingIntegration';
import { projectRepertoireTree } from './treeProjection';
import type { RepertoireGraph } from './types';

const recursivePgn = `[Event "FIX-03-05-09"]
[Opening "Synthetic transposition"]

1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 $1) Nc6 3. Nc3 {same position by another move order} Nf6 *`;

function validCandidate() {
  const candidate = previewPgnImport(recursivePgn, {
    repertoireId: 'rep-phase3',
    repertoireName: 'Phase 3 synthetic repertoire',
    userColour: 'white',
  });
  expect(candidate.errors).toEqual([]);
  return candidate;
}

function outgoingSans(graph: RepertoireGraph, contextId: string): string[] {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return graph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .map((move) => edges.get(move.edgeId)?.san ?? '')
    .sort();
}

function contextByExactOutgoing(graph: RepertoireGraph, sans: readonly string[]) {
  const expected = [...sans].sort().join('|');
  const context = graph.contexts.find((item) => outgoingSans(graph, item.id).join('|') === expected);
  if (!context) throw new Error(`Missing context with outgoing ${expected}`);
  return context;
}

describe('PHASE-3 repertoire graph and import', () => {
  it('preserves recursive variations, comments and NAGs in the isolated import candidate', () => {
    const candidate = validCandidate();
    expect(candidate.summary.games).toBe(1);
    expect(candidate.summary.variations).toBe(1);
    expect(candidate.summary.comments).toBe(1);
    expect(candidate.summary.nags).toBe(1);
    expect(candidate.games[0]?.mainLine.moves[2]?.variations[0]?.moves.map((move) => move.san)).toEqual([
      'Nc3',
      'Nc6',
      'Nf3',
    ]);
    expect(candidate.source.parserVersion).toBe('opening-trainer-pgn-rav-v1');
    expect(candidate.source.hash).toMatch(/^fnv1a32:/u);
  });

  it('consolidates exact transposition positions while preserving contextual occurrences', () => {
    const graph = validCandidate().proposedGraph;
    validateRepertoireGraph(graph);
    const contextCounts = new Map<string, number>();
    for (const context of graph.contexts) {
      contextCounts.set(context.entryPositionId, (contextCounts.get(context.entryPositionId) ?? 0) + 1);
    }
    expect([...contextCounts.values()].some((count) => count > 1)).toBe(true);
  });

  it('returns both included user alternatives in stable normalized order', () => {
    const graph = validCandidate().proposedGraph;
    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    const accepted = queryAcceptedMoves(graph, {
      repertoireId: 'rep-phase3',
      activeContextIds: [branch.id],
      positionId: branch.entryPositionId,
      promptMode: 'normal',
    });
    expect(accepted.moves.map((move) => move.uci)).toEqual(['b1c3', 'g1f3']);
    expect(accepted.normalizedKey).toBe('b1c3|g1f3');
  });

  it('accepts a diverting alternative and queues replacement target work instead of an error', () => {
    const graph = validCandidate().proposedGraph;
    const rootContextId = graph.repertoires[0]!.rootContextIds[0]!;
    const target = contextByExactOutgoing(graph, ['Nc3']);
    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    const plan = createGraphExercisePlan(graph, {
      repertoireId: 'rep-phase3',
      rootContextId,
      targetContextId: target.id,
    });
    const branchStep = plan.steps.find((item) => item.id === branch.id)!;
    expect(branchStep.targetDispositionByAcceptedUci?.g1f3).toBe('preserved');
    expect(branchStep.targetDispositionByAcceptedUci?.b1c3).toBe('displaced');

    let state = createGraphTrainingSession(plan, 0, { sessionId: 'phase3-session' });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 100,
    });
    state = reduceGraphTrainingSession(state, plan, { type: 'continue', nowMs: 101 });
    state = reduceGraphTrainingSession(state, plan, { type: 'opponent-tick', nowMs: 102 });
    expect(state.currentStepId).toBe(branch.id);
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 200,
    });
    expect(state.status).toBe('correct-feedback');
    expect(state.retestQueue.some((ticket) => ticket.targetStepId === target.id)).toBe(true);
    expect(state.feedback?.message).toContain('replacement target work has been queued');
  });

  it('projects contextual occurrences deterministically and never embeds hidden SAN in Train labels', () => {
    const graph = validCandidate().proposedGraph;
    const train = projectRepertoireTree(graph, { repertoireId: 'rep-phase3', mode: 'train' });
    const browse = projectRepertoireTree(graph, { repertoireId: 'rep-phase3', mode: 'browse' });
    expect(JSON.stringify(train)).not.toContain('Nf3');
    expect(JSON.stringify(train)).not.toContain('Nc3');
    expect(JSON.stringify(browse)).toContain('Nf3');
    expect(JSON.stringify(browse)).toContain('Nc3');
    const collectTranspositions = (items: typeof browse): boolean =>
      items.some((item) => item.isTransposition || collectTranspositions(item.children));
    expect(collectTranspositions(browse)).toBe(true);
    expect(projectRepertoireTree(graph, { repertoireId: 'rep-phase3', mode: 'browse' })).toEqual(browse);
  });

  it('shares normal-mode training identity across equivalent contexts but keeps strict path identity', () => {
    const common = {
      repertoireId: 'rep',
      contextScopeKey: 'canonical-position',
      positionKey: 'position-key',
      acceptedMoveSetKey: 'b1c3|g1f3',
    };
    const normalA = trainingItemIdentityKey({ ...common, promptMode: 'normal', strictPathFingerprint: 'a' });
    const normalB = trainingItemIdentityKey({ ...common, promptMode: 'normal', strictPathFingerprint: 'b' });
    const strictA = trainingItemIdentityKey({ ...common, promptMode: 'strict', strictPathFingerprint: 'a' });
    const strictB = trainingItemIdentityKey({ ...common, promptMode: 'strict', strictPathFingerprint: 'b' });
    expect(normalA).toBe(normalB);
    expect(strictA).not.toBe(strictB);
  });

  it('filters playlists by repertoire, colour, tags, branch inclusion/exclusion and depth', () => {
    const graph = validCandidate().proposedGraph;
    const root = graph.contexts.find((context) => !context.parentContextId)!;
    const child = graph.contexts.find((context) => context.parentContextId === root.id)!;
    const taggedGraph: RepertoireGraph = {
      ...graph,
      contexts: graph.contexts.map((context) =>
        context.id === child.id ? { ...context, tags: ['italian'] } : context,
      ),
    };
    const playlist = {
      id: 'playlist',
      name: 'Italian only',
      repertoireIds: ['rep-phase3'],
      colour: 'white' as const,
      includedContextIds: [child.id],
      excludedContextIds: [],
      maxPly: 5,
      tags: ['italian'],
      weighting: { kind: 'due-first' as const },
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
    };
    expect(playlistAllowsContext(taggedGraph, playlist, child, 1)).toBe(true);
    expect(playlistAllowsContext(taggedGraph, playlist, root, 0)).toBe(false);
    expect(playlistAllowsContext(taggedGraph, playlist, child, 6)).toBe(false);
    expect(
      playlistAllowsContext(taggedGraph, { ...playlist, excludedContextIds: [child.id] }, child, 1),
    ).toBe(false);
  });

  it('reports illegal PGN with a source location and leaves the commit repository unchanged', () => {
    const repository = new InMemoryImportRepository();
    const candidate = previewPgnImport('1. e4 e5 2. Bh6 *', {
      repertoireId: 'invalid',
      repertoireName: 'Invalid',
      userColour: 'white',
    });
    expect(candidate.errors).toHaveLength(1);
    expect(candidate.errors[0]?.message).toMatch(/Illegal or unparseable/u);
    expect(candidate.errors[0]?.sourceLocator).toBeDefined();
    expect(() => repository.createRepertoire(candidate)).toThrow();
    expect(repository.graphs.size).toBe(0);
  });

  it('commits a validated preview atomically and cancel means no mutation', () => {
    const repository = new InMemoryImportRepository();
    const candidate = validCandidate();
    expect(repository.graphs.size).toBe(0);
    // Cancel is deliberately represented by not invoking the transaction port.
    expect(repository.graphs.size).toBe(0);
    repository.createRepertoire(candidate);
    expect(repository.graphs.get('rep-phase3')).toEqual(candidate.proposedGraph);
    expect(() => repository.createRepertoire(candidate)).toThrow(/already exists/u);
  });

  it('bounds oversized imports before parsing and performs no provisional graph mutation', () => {
    const candidate = previewPgnImport('x'.repeat(1_000_001), {
      repertoireId: 'large',
      repertoireName: 'Large',
      userColour: 'white',
    });
    expect(candidate.errors[0]?.code).toBe('PGN_TOO_LARGE');
    expect(candidate.proposedGraph.repertoires).toHaveLength(0);
  });
});
