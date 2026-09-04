import {
  createGraphExercisePlan,
  type GraphExercisePlanOptions,
} from '../repertoire/exercisePlan';
import type { RepertoireGraph } from '../repertoire/types';
import type { TrainingExercisePlan } from '../training/exercisePlan';

export type { GraphExercisePlanOptions };

function authoredPurpose(
  graph: RepertoireGraph,
  contextId: string,
  acceptedUci: readonly string[],
): string | undefined {
  const context = graph.contexts.find((row) => row.id === contextId);
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const values = graph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .filter((move) => {
      const edge = edges.get(move.edgeId);
      return Boolean(edge && acceptedUci.includes(edge.uci));
    })
    .map((move) => move.purpose?.trim() || move.note?.trim())
    .filter((value): value is string => Boolean(value));
  const unique = [...new Set(values)];
  if (unique.length === 1) {
    return unique[0];
  }
  return context?.note?.trim() || undefined;
}

export function createPhase6GraphExercisePlan(
  graph: RepertoireGraph,
  options: GraphExercisePlanOptions,
): TrainingExercisePlan {
  const plan = createGraphExercisePlan(graph, options);
  return {
    ...plan,
    steps: plan.steps.map((step) => {
      if (step.actor !== 'user' || !step.hint) {
        return step;
      }
      const purpose = authoredPurpose(graph, step.id, step.acceptedUci);
      return purpose ? { ...step, hint: { ...step.hint, purpose } } : step;
    }),
  };
}
