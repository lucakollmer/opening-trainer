import { createGraphExercisePlan } from './exercisePlan';
import { InMemoryImportRepository } from './importRepository';
import { previewPgnImport } from './pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from './trainingIntegration';
import type { RepertoireGraph } from './types';
import type { TrainingSessionState } from '../training/session';

const recursivePgn = `[Event "hardening"]

1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 Nf6 4. Bb5) Nc6 3. Nc3 Nf6 4. Bb5 *`;

function candidate() {
  const result = previewPgnImport(recursivePgn, {
    repertoireId: 'hardening-rep',
    repertoireName: 'Hardening repertoire',
    userColour: 'white',
  });
  expect(result.errors).toEqual([]);
  return result;
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
  const context = graph.contexts.find(
    (item) => outgoingSans(graph, item.id).join('|') === expected,
  );
  if (!context) throw new Error(`Missing context with outgoing ${expected}`);
  return context;
}

describe('PHASE-3 hardening', () => {
  it('preserves nested recursive annotation variations', () => {
    const nested = previewPgnImport(
      '1. e4 e5 2. Nf3 (2. Nc3 Nc6 (2... Nf6 3. Nf3) 3. Nf3) Nc6 *',
      {
        repertoireId: 'nested',
        repertoireName: 'Nested',
        userColour: 'white',
      },
    );
    expect(nested.errors).toEqual([]);
    expect(nested.summary.variations).toBe(2);
    expect(
      nested.games[0]?.mainLine.moves[2]?.variations[0]?.moves[1]?.variations[0]?.moves.map(
        (move) => move.san,
      ),
    ).toEqual(['Nf6', 'Nf3']);
  });

  it('handles black-to-move FEN games and special legal moves through chess.js', () => {
    const black = previewPgnImport(
      `[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1"]\n\n1... e5 2. Nf3 *`,
      {
        repertoireId: 'black-fen',
        repertoireName: 'Black FEN',
        userColour: 'black',
      },
    );
    expect(black.errors).toEqual([]);
    expect(black.games[0]?.mainLine.moves.map((move) => move.san)).toEqual([
      'e5',
      'Nf3',
    ]);

    const castling = previewPgnImport(
      `[SetUp "1"]\n[FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]\n\n1. O-O *`,
      {
        repertoireId: 'castle',
        repertoireName: 'Castle',
        userColour: 'white',
      },
    );
    expect(castling.errors).toEqual([]);
    expect(castling.games[0]?.mainLine.moves[0]?.san).toBe('O-O');

    const promotion = previewPgnImport(
      `[SetUp "1"]\n[FEN "7k/4P3/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. e8=Q+ *`,
      {
        repertoireId: 'promotion',
        repertoireName: 'Promotion',
        userColour: 'white',
      },
    );
    expect(promotion.errors).toEqual([]);
    expect(promotion.games[0]?.mainLine.moves[0]?.uci).toBe('e7e8q');

    const enPassant = previewPgnImport(
      `[SetUp "1"]\n[FEN "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1"]\n\n1. exd6 *`,
      {
        repertoireId: 'en-passant',
        repertoireName: 'En passant',
        userColour: 'white',
      },
    );
    expect(enPassant.errors).toEqual([]);
    expect(enPassant.games[0]?.mainLine.moves[0]?.uci).toBe('e5d6');
  });

  it('preserves semicolon comments, symbolic and numeric NAGs, and escaped headers', () => {
    const parsed = previewPgnImport(
      `[Event "Quoted \\"name\\" \\\\ path"]\n\n1. e4!? $1 ;central idea\n1... e5 *`,
      {
        repertoireId: 'annotations',
        repertoireName: 'Annotations',
        userColour: 'white',
      },
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.games[0]?.headers.Event).toBe('Quoted "name" \\ path');
    expect(parsed.games[0]?.mainLine.moves[0]?.comment).toBe('central idea');
    expect(parsed.games[0]?.mainLine.moves[0]?.nags).toEqual(['!?', '$1']);
  });

  it('accepts the exact import-size limit and rejects one byte over it', () => {
    const prefix = '1. e4 {';
    const suffix = '} *';
    const encoder = new TextEncoder();
    const fillerLength =
      1_000_000 - encoder.encode(prefix).byteLength - encoder.encode(suffix).byteLength;
    const exact = `${prefix}${'a'.repeat(fillerLength)}${suffix}`;
    expect(encoder.encode(exact).byteLength).toBe(1_000_000);
    expect(
      previewPgnImport(exact, {
        repertoireId: 'exact-limit',
        repertoireName: 'Exact limit',
        userColour: 'white',
      }).errors,
    ).toEqual([]);
    expect(
      previewPgnImport(`${exact}x`, {
        repertoireId: 'over-limit',
        repertoireName: 'Over limit',
        userColour: 'white',
      }).errors[0]?.code,
    ).toBe('PGN_TOO_LARGE');
  });

  it('retains distinct roots for different initial positions', () => {
    const multiRoot = previewPgnImport(
      `[Event "standard"]\n\n1. e4 *\n\n[Event "custom"]\n[SetUp "1"]\n[FEN "7k/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *`,
      {
        repertoireId: 'multi-root',
        repertoireName: 'Multi root',
        userColour: 'white',
      },
    );
    expect(multiRoot.errors).toEqual([]);
    expect(multiRoot.proposedGraph.repertoires[0]?.rootContextIds).toHaveLength(2);
  });

  it('commits provenance and an immutable snapshot rather than aliasing the preview', () => {
    const preview = previewPgnImport(
      `[Event "source"]\n\n{root note} 1. e4!? $1 {move note} e5 *`,
      {
        repertoireId: 'snapshot',
        repertoireName: 'Snapshot repertoire',
        userColour: 'white',
        sourceLabel: 'Snapshot source',
      },
    );
    expect(preview.errors).toEqual([]);
    const repository = new InMemoryImportRepository();
    repository.createRepertoire(preview);
    const committed = repository.imports.get('snapshot');
    expect(committed?.source.label).toBe('Snapshot source');
    expect(committed?.games[0]?.headers.Event).toBe('source');
    expect(committed?.games[0]?.rootComment).toBe('root note');
    expect(committed?.games[0]?.mainLine.moves[0]?.comment).toBe('move note');
    expect(committed?.games[0]?.mainLine.moves[0]?.nags).toEqual(['!?', '$1']);

    (preview.proposedGraph.repertoires[0] as { name: string }).name = 'mutated';
    (preview.games[0]!.headers as Record<string, string>).Event = 'mutated';
    expect(committed?.graph.repertoires[0]?.name).toBe('Snapshot repertoire');
    expect(committed?.games[0]?.headers.Event).toBe('source');
  });

  it('keeps graph Train trees structurally masked while Browse retains full SAN', () => {
    const graph = candidate().proposedGraph;
    const repertoire = graph.repertoires[0]!;
    const target = contextByExactOutgoing(graph, ['Bb5']);
    const plan = createGraphExercisePlan(graph, {
      repertoireId: repertoire.id,
      rootContextId: repertoire.rootContextIds[0]!,
      targetContextId: target.id,
    });
    expect(JSON.stringify(plan.tree)).not.toContain('Nf3');
    expect(JSON.stringify(plan.tree)).not.toContain('Nc3');
    expect(JSON.stringify(plan.tree)).not.toContain('Bb5');
    expect(JSON.stringify(plan.browseTree)).toContain('Nf3');
    expect(JSON.stringify(plan.browseTree)).toContain('Nc3');
    expect(JSON.stringify(plan.browseTree)).toContain('Bb5');

    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    expect(plan.steps.find((step) => step.id === branch.id)?.acceptedSan).toEqual([
      'Nc3',
      'Nf3',
    ]);
  });

  it('reports all accepted SAN after a failed legal move at a multi-answer decision', () => {
    const graph = candidate().proposedGraph;
    const repertoire = graph.repertoires[0]!;
    const target = contextByExactOutgoing(graph, ['Bb5']);
    const branch = contextByExactOutgoing(graph, ['Nc3', 'Nf3']);
    const plan = createGraphExercisePlan(graph, {
      repertoireId: repertoire.id,
      rootContextId: repertoire.rootContextIds[0]!,
      targetContextId: target.id,
    });
    let state = createGraphTrainingSession(plan, 0, { sessionId: 'multi-answer' });
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 1,
    });
    state = reduceGraphTrainingSession(state, plan, { type: 'continue', nowMs: 2 });
    state = reduceGraphTrainingSession(state, plan, { type: 'opponent-tick', nowMs: 3 });
    expect(state.currentStepId).toBe(branch.id);
    state = reduceGraphTrainingSession(state, plan, {
      type: 'user-move',
      move: { from: 'd2', to: 'd4' },
      nowMs: 4,
    });
    expect(state.feedback?.message).toContain('Accepted repertoire moves here are Nc3 or Nf3.');
  });

  it('uses graph path ply rather than flattened step index when starting a retest', () => {
    const graph = candidate().proposedGraph;
    const repertoire = graph.repertoires[0]!;
    const target = contextByExactOutgoing(graph, ['Bb5']);
    const plan = createGraphExercisePlan(graph, {
      repertoireId: repertoire.id,
      rootContextId: repertoire.rootContextIds[0]!,
      targetContextId: target.id,
    });
    const mismatched = plan.steps.find((step, index) => step.actor === 'user' && step.ply !== index);
    expect(mismatched).toBeDefined();
    const initial = createGraphTrainingSession(plan, 0, { sessionId: 'ply-retest' });
    const ready: TrainingSessionState = {
      ...initial,
      status: 'line-complete',
      retestQueue: [
        {
          id: 'ready',
          targetStepId: mismatched!.id,
          separationRemaining: 0,
          sourceObservationId: 'source',
          attempt: 1,
        },
      ],
    };
    const retest = reduceGraphTrainingSession(ready, plan, {
      type: 'start-retest',
      nowMs: 10,
    });
    expect(retest.targetPly).toBe(mismatched!.ply);
  });
});
