import { createGraphExercisePlan } from './exercisePlan';
import {
  playlistAllowsContext,
  playlistAllowsRouteContext,
  queryAcceptedMoves,
  trainingItemIdentityKey,
  validateRepertoireGraph,
} from './graph';
import { InMemoryImportRepository, previewPgnImport } from './pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from './trainingIntegration';
import { projectRepertoireTree } from './treeProjection';
import type { Playlist, RepertoireGraph } from './types';

const recursivePgn = `[Event "FIX-03-05-09"]
[Opening "Synthetic transposition"]

1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 $1 Nf6 4. Bb5 {variation decision}) Nc6 3. Nc3 {same position by another move order} Nf6 4. Bb5 *`;

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

function contextsByExactOutgoing(
  graph: RepertoireGraph,
  sans: readonly string[],
) {
  const expected = [...sans].sort().join('|');
  return graph.contexts.filter(
    (context) => outgoingSans(graph, context.id).join('|') === expected,
  );
}

function contextByExactOutgoing(graph: RepertoireGraph, sans: readonly string[]) {
  const context = contextsByExactOutgoing(graph, sans)[0];
  if (!context) throw new Error(`Missing context with outgoing ${sans.join('|')}`);
  return context;
}

function mainOnlyPlaylist(graph: RepertoireGraph): {
  graph: RepertoireGraph;
  playlist: Playlist;
} {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
  const excludedMove = graph.moves.find(
    (move) => move.contextId === branch.id && edges.get(move.edgeId)?.san === 'Nc3',
  );
  if (!excludedMove) throw new Error('Missing alternative branch move.');
  const playlist: Playlist = {
    id: 'main-only',
    name: 'Main branch only',
    repertoireIds: ['rep-phase3'],
    includedContextIds: [],
    excludedContextIds: [excludedMove.destinationContextId],
    tags: [],
    weighting: { kind: 'due-first' },
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
  return { graph: { ...graph, playlists: [playlist] }, playlist };
}

describe('PHASE-3 repertoire graph and import', () => {
  it('preserves recursive variations, comments, variation-leading comments and NAGs', () => {
    const candidate = validCandidate();
    expect(candidate.summary.games).toBe(1);
    expect(candidate.summary.variations).toBe(1);
    expect(candidate.summary.comments).toBe(2);
    expect(candidate.summary.nags).toBe(1);
    expect(
      candidate.games[0]?.mainLine.moves[2]?.variations[0]?.moves.map(
        (move) => move.san,
      ),
    ).toEqual(['Nc3', 'Nc6', 'Nf3', 'Nf6', 'Bb5']);
    expect(candidate.source.parserVersion).toBe('opening-trainer-pgn-rav-v1');
    expect(candidate.source.hash).toMatch(/^fnv1a32:/u);

    const leadingComment = previewPgnImport(
      '1. e4 e5 2. Nf3 ({alternative plan} 2. Nc3 Nc6) Nc6 *',
      {
        repertoireId: 'variation-comment',
        repertoireName: 'Variation comment',
        userColour: 'white',
      },
    );
    expect(leadingComment.errors).toEqual([]);
    expect(
      leadingComment.games[0]?.mainLine.moves[2]?.variations[0]?.comment,
    ).toBe('alternative plan');
  });

  it('rejects malformed recursive variation boundaries instead of flattening them', () => {
    const unterminated = previewPgnImport('1. e4 (1. d4 d5 *', {
      repertoireId: 'unterminated',
      repertoireName: 'Unterminated',
      userColour: 'white',
    });
    const unmatched = previewPgnImport('1. e4 ) e5 *', {
      repertoireId: 'unmatched',
      repertoireName: 'Unmatched',
      userColour: 'white',
    });
    expect(unterminated.errors[0]?.message).toMatch(/Unterminated PGN variation/u);
    expect(unterminated.errors[0]?.sourceLocator).toBeDefined();
    expect(unmatched.errors[0]?.message).toMatch(/Unmatched PGN variation/u);
    expect(unmatched.errors[0]?.sourceLocator).toBeDefined();
  });

  it('consolidates exact transposition positions while preserving contextual occurrences', () => {
    const graph = validCandidate().proposedGraph;
    validateRepertoireGraph(graph);
    const bb5Contexts = contextsByExactOutgoing(graph, ['Bb5']);
    expect(bb5Contexts).toHaveLength(2);
    expect(bb5Contexts[0]?.entryPositionId).toBe(bb5Contexts[1]?.entryPositionId);
  });

  it('shares actual normal-mode training identity after a transposition and separates strict paths', () => {
    const graph = validCandidate().proposedGraph;
    const rootContextId = graph.repertoires[0]!.rootContextIds[0]!;
    const bb5Contexts = contextsByExactOutgoing(graph, ['Bb5']);
    expect(bb5Contexts).toHaveLength(2);

    const normal = createGraphExercisePlan(graph, {
      repertoireId: 'rep-phase3',
      rootContextId,
      targetContextId: bb5Contexts[0]!.id,
    });
    const normalSteps = bb5Contexts.map((context) =>
      normal.steps.find((step) => step.id === context.id),
    );
    expect(normalSteps[0]?.positionKey).toBe(normalSteps[1]?.positionKey);
    expect(normalSteps[0]?.acceptedMoveSetKey).toBe(
      normalSteps[1]?.acceptedMoveSetKey,
    );
    expect(normalSteps[0]?.trainingItemId).toBe(normalSteps[1]?.trainingItemId);

    const strict = createGraphExercisePlan(graph, {
      repertoireId: 'rep-phase3',
      rootContextId,
      targetContextId: bb5Contexts[0]!.id,
      promptMode: 'strict',
    });
    const strictSteps = bb5Contexts.map((context) =>
      strict.steps.find((step) => step.id === context.id),
    );
    expect(strictSteps[0]?.trainingItemId).not.toBe(strictSteps[1]?.trainingItemId);
  });

  it('changes training identity when the accepted answer set changes', () => {
    const graph = validCandidate().proposedGraph;
    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    const position = graph.positions.find(
      (item) => item.id === branch.entryPositionId,
    )!;
    const common = {
      repertoireId: 'rep-phase3',
      contextScopeKey: position.key,
      positionKey: position.key,
      promptMode: 'normal' as const,
    };
    expect(
      trainingItemIdentityKey({
        ...common,
        acceptedMoveSetKey: 'b1c3|g1f3',
      }),
    ).not.toBe(
      trainingItemIdentityKey({
        ...common,
        acceptedMoveSetKey: 'g1f3',
      }),
    );
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

    let state = createGraphTrainingSession(plan, 0, {
      sessionId: 'phase3-session',
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 100,
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'continue',
      nowMs: 101,
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'opponent-tick',
      nowMs: 102,
    });
    expect(state.currentStepId).toBe(branch.id);
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 200,
    });
    expect(state.status).toBe('correct-feedback');
    expect(
      state.retestQueue.some((ticket) => ticket.targetStepId === target.id),
    ).toBe(true);
    expect(state.feedback?.message).toContain(
      'replacement target work has been queued',
    );
  });

  it('filters a playlist at the accepted-move, route and exercise-plan boundaries', () => {
    const source = validCandidate().proposedGraph;
    const { graph, playlist } = mainOnlyPlaylist(source);
    validateRepertoireGraph(graph);
    const root = graph.contexts.find((context) => !context.parentContextId)!;
    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    const target = contextByExactOutgoing(graph, ['Nc3']);

    expect(playlistAllowsRouteContext(graph, playlist, root)).toBe(true);
    const accepted = queryAcceptedMoves(graph, {
      repertoireId: 'rep-phase3',
      activeContextIds: [branch.id],
      playlistId: playlist.id,
      positionId: branch.entryPositionId,
      promptMode: 'normal',
    });
    expect(accepted.moves.map((move) => move.uci)).toEqual(['g1f3']);

    const plan = createGraphExercisePlan(graph, {
      repertoireId: 'rep-phase3',
      rootContextId: root.id,
      targetContextId: target.id,
      playlistId: playlist.id,
    });
    const branchStep = plan.steps.find((step) => step.id === branch.id)!;
    expect(branchStep.acceptedUci).toEqual(['g1f3']);
    expect(branchStep.wrongSiblingUci).toContain('b1c3');
    expect(plan.id).toContain(playlist.id);

    let state = createGraphTrainingSession(plan, 0, {
      sessionId: 'playlist-session',
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 1,
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'continue',
      nowMs: 2,
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'opponent-tick',
      nowMs: 3,
    });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'b1', to: 'c3' },
      nowMs: 4,
    });
    expect(state.status).toBe('wrong-variation-feedback');
  });

  it('applies playlist colour, tags, branch selection and max depth deterministically', () => {
    const source = validCandidate().proposedGraph;
    const root = source.contexts.find((context) => !context.parentContextId)!;
    const child = source.contexts.find(
      (context) => context.parentContextId === root.id,
    )!;
    const taggedGraph: RepertoireGraph = {
      ...source,
      contexts: source.contexts.map((context) =>
        context.id === child.id ? { ...context, tags: ['italian'] } : context,
      ),
    };
    const playlist: Playlist = {
      id: 'tagged-playlist',
      name: 'Italian only',
      repertoireIds: ['rep-phase3'],
      colour: 'white',
      includedContextIds: [child.id],
      excludedContextIds: [],
      maxPly: 5,
      tags: ['italian'],
      weighting: { kind: 'due-first' },
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
    };
    expect(playlistAllowsRouteContext(taggedGraph, playlist, root)).toBe(true);
    expect(playlistAllowsContext(taggedGraph, playlist, child, 1)).toBe(true);
    expect(playlistAllowsContext(taggedGraph, playlist, root, 0)).toBe(false);
    expect(playlistAllowsContext(taggedGraph, playlist, child, 6)).toBe(false);
    expect(
      playlistAllowsContext(
        taggedGraph,
        { ...playlist, excludedContextIds: [child.id] },
        child,
        1,
      ),
    ).toBe(false);

    const branch = contextByExactOutgoing(source, ['Nc3', 'Nf3']);
    const depthLimited: Playlist = {
      ...playlist,
      id: 'depth-limited',
      includedContextIds: [],
      tags: [],
      maxPly: 2,
    };
    const graph = { ...source, playlists: [depthLimited] };
    expect(
      queryAcceptedMoves(graph, {
        repertoireId: 'rep-phase3',
        activeContextIds: [branch.id],
        playlistId: depthLimited.id,
        positionId: branch.entryPositionId,
        promptMode: 'normal',
      }).moves,
    ).toHaveLength(0);
  });

  it('projects contextual occurrences deterministically without hidden SAN in Train labels', () => {
    const graph = validCandidate().proposedGraph;
    const train = projectRepertoireTree(graph, {
      repertoireId: 'rep-phase3',
      mode: 'train',
    });
    const browse = projectRepertoireTree(graph, {
      repertoireId: 'rep-phase3',
      mode: 'browse',
    });
    expect(JSON.stringify(train)).not.toContain('Nf3');
    expect(JSON.stringify(train)).not.toContain('Nc3');
    expect(JSON.stringify(train)).not.toContain('Bb5');
    expect(JSON.stringify(browse)).toContain('Nf3');
    expect(JSON.stringify(browse)).toContain('Nc3');
    const collectTranspositions = (items: typeof browse): boolean =>
      items.some(
        (item) => item.isTransposition || collectTranspositions(item.children),
      );
    expect(collectTranspositions(browse)).toBe(true);
    expect(
      projectRepertoireTree(graph, {
        repertoireId: 'rep-phase3',
        mode: 'browse',
      }),
    ).toEqual(browse);
  });

  it('does not merge roots with identical placement but different castling rights', () => {
    const pgn = `[Event "all rights"]
[SetUp "1"]
[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]

1. Ra2 *

[Event "white rights"]
[SetUp "1"]
[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQ - 0 1"]

1. Ra2 *`;
    const candidate = previewPgnImport(pgn, {
      repertoireId: 'castling',
      repertoireName: 'Castling identities',
      userColour: 'white',
    });
    expect(candidate.errors).toEqual([]);
    const roots = candidate.proposedGraph.repertoires[0]!.rootContextIds.map((id) =>
      candidate.proposedGraph.contexts.find((context) => context.id === id),
    );
    expect(roots).toHaveLength(2);
    expect(roots[0]?.entryPositionId).not.toBe(roots[1]?.entryPositionId);
  });

  it('rejects representative graph corruption before training or commit', () => {
    const graph = validCandidate().proposedGraph;
    const firstPosition = graph.positions[0]!;
    expect(() =>
      validateRepertoireGraph({
        ...graph,
        positions: [
          ...graph.positions,
          { ...firstPosition, id: `${firstPosition.id}-duplicate` },
        ],
      }),
    ).toThrow(/Duplicate canonical position/u);

    const firstMove = graph.moves[0]!;
    expect(() =>
      validateRepertoireGraph({
        ...graph,
        moves: [{ ...firstMove, edgeId: 'missing-edge' }, ...graph.moves.slice(1)],
      }),
    ).toThrow(/Dangling move edge/u);

    const child = graph.contexts.find((context) => context.parentContextId)!;
    expect(() =>
      validateRepertoireGraph({
        ...graph,
        contexts: graph.contexts.map((context) =>
          context.id === child.id
            ? { ...context, pathFingerprint: 'corrupted-path' }
            : context,
        ),
      }),
    ).toThrow(/path fingerprint mismatch/u);
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

  it('consolidates duplicate branches deterministically while preserving annotations', () => {
    const duplicate = previewPgnImport(
      `[Event "one"]\n\n1. e4 {first} e5 *\n\n[Event "two"]\n\n1. e4 {second} e5 *`,
      {
        repertoireId: 'duplicate',
        repertoireName: 'Duplicate',
        userColour: 'white',
      },
    );
    expect(duplicate.errors).toEqual([]);
    expect(
      duplicate.warnings.some(
        (warning) => warning.code === 'DUPLICATE_BRANCH_CONSOLIDATED',
      ),
    ).toBe(true);
    const e4Edge = duplicate.proposedGraph.edges.find((edge) => edge.san === 'e4')!;
    const e4Move = duplicate.proposedGraph.moves.find(
      (move) => move.edgeId === e4Edge.id,
    )!;
    expect(e4Move.note).toContain('first');
    expect(e4Move.note).toContain('second');
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
