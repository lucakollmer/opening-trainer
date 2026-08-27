import { createGraphExercisePlan } from '../domain/repertoire/exercisePlan';
import { previewPgnImport } from '../domain/repertoire/pgnImport';

export const phase3DemoPgn = `[Event "PHASE-3 graph demo"]
[Opening "Synthetic transposition"]

1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 $1) Nc6 3. Nc3 {same position by another move order} Nf6 *`;

export const phase3DemoCandidate = previewPgnImport(phase3DemoPgn, {
  repertoireId: 'phase3-demo-repertoire',
  repertoireName: 'PHASE-3 · Graph alternatives and transposition',
  userColour: 'white',
  sourceLabel: 'Bundled synthetic PHASE-3 demo PGN',
});

if (phase3DemoCandidate.errors.length > 0) {
  throw new Error(`Bundled PHASE-3 demo failed to import: ${phase3DemoCandidate.errors[0]!.message}`);
}

export const phase3DemoGraph = phase3DemoCandidate.proposedGraph;
const rootContextId = phase3DemoGraph.repertoires[0]!.rootContextIds[0]!;
const edges = new Map(phase3DemoGraph.edges.map((edge) => [edge.id, edge]));
const targetMove = phase3DemoGraph.moves.find(
  (move) => move.actor === 'user' && edges.get(move.edgeId)?.san === 'Nc3' &&
    phase3DemoGraph.moves.filter((candidate) => candidate.contextId === move.contextId).length === 1,
);
if (!targetMove) throw new Error('Bundled PHASE-3 demo target context is missing.');

export const phase3DemoPlan = createGraphExercisePlan(phase3DemoGraph, {
  repertoireId: 'phase3-demo-repertoire',
  rootContextId,
  targetContextId: targetMove.contextId,
});
