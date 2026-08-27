import { createGraphExercisePlan } from '../domain/repertoire/exercisePlan';
import { previewPgnImport } from '../domain/repertoire/pgnImport';
import type { Playlist, RepertoireGraph } from '../domain/repertoire/types';

export const phase3DemoPgn = `[Event "PHASE-3 graph demo"]
[Opening "Synthetic transposition"]

1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 $1 Nf6 4. Bb5 {variation reaches the same decision}) Nc6 3. Nc3 {same position by another move order} Nf6 4. Bb5 *`;

export const phase3DemoCandidate = previewPgnImport(phase3DemoPgn, {
  repertoireId: 'phase3-demo-repertoire',
  repertoireName: 'PHASE-3 · Graph alternatives and transposition',
  userColour: 'white',
  sourceLabel: 'Bundled synthetic PHASE-3 demo PGN',
});

if (phase3DemoCandidate.errors.length > 0) {
  throw new Error(
    `Bundled PHASE-3 demo failed to import: ${
      phase3DemoCandidate.errors[0]!.message
    }`,
  );
}

export const phase3DemoGraph = phase3DemoCandidate.proposedGraph;
const rootContextId = phase3DemoGraph.repertoires[0]!.rootContextIds[0]!;
const edges = new Map(phase3DemoGraph.edges.map((edge) => [edge.id, edge]));
const outgoingSans = (contextId: string) =>
  phase3DemoGraph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .map((move) => edges.get(move.edgeId)?.san ?? '')
    .sort();

const branchContext = phase3DemoGraph.contexts.find(
  (context) => outgoingSans(context.id).join('|') === 'Nc3|Nf3',
);
if (!branchContext) {
  throw new Error('Bundled PHASE-3 demo alternative branch context is missing.');
}
const alternativeMove = phase3DemoGraph.moves.find(
  (move) =>
    move.contextId === branchContext.id && edges.get(move.edgeId)?.san === 'Nc3',
);
if (!alternativeMove) {
  throw new Error('Bundled PHASE-3 demo alternative move is missing.');
}

const targetMove = phase3DemoGraph.moves.find(
  (move) =>
    move.actor === 'user' &&
    edges.get(move.edgeId)?.san === 'Nc3' &&
    phase3DemoGraph.moves.filter(
      (candidate) => candidate.contextId === move.contextId,
    ).length === 1,
);
if (!targetMove) throw new Error('Bundled PHASE-3 demo target context is missing.');

export const phase3DemoPlaylist: Playlist = {
  id: 'phase3-demo-main-branch-only',
  name: 'Main branch only',
  repertoireIds: ['phase3-demo-repertoire'],
  includedContextIds: [],
  excludedContextIds: [alternativeMove.destinationContextId],
  tags: [],
  weighting: { kind: 'due-first' },
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
};

export const phase3DemoPlaylistGraph: RepertoireGraph = {
  ...phase3DemoGraph,
  playlists: [phase3DemoPlaylist],
};

export const phase3DemoPlan = createGraphExercisePlan(phase3DemoGraph, {
  repertoireId: 'phase3-demo-repertoire',
  rootContextId,
  targetContextId: targetMove.contextId,
});

export const phase3DemoFilteredPlan = createGraphExercisePlan(
  phase3DemoPlaylistGraph,
  {
    repertoireId: 'phase3-demo-repertoire',
    rootContextId,
    targetContextId: targetMove.contextId,
    playlistId: phase3DemoPlaylist.id,
  },
);

export const phase3DemoAlternativeContextId = branchContext.id;
export const phase3DemoAlternativeDestinationId = alternativeMove.destinationContextId;
