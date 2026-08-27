import { moveFromUci } from '../chess/chessAdapter';
import type { TrainingExercisePlan, TrainingExerciseStep } from '../training/exercisePlan';
import { normalizedAcceptedMoveSet } from '../training/exercisePlan';
import type { TrainingTreeItem } from '../../fixtures/trainingFixtures';
import { queryAcceptedMoves, trainingItemIdentityKey, validateRepertoireGraph } from './graph';
import { projectRepertoireTree, toTrainingTreeItems } from './treeProjection';
import type {
  PromptMode,
  RepertoireContext,
  RepertoireGraph,
  RepertoireMove,
} from './types';

export interface GraphExercisePlanOptions {
  repertoireId: string;
  rootContextId: string;
  targetContextId: string;
  promptMode?: PromptMode;
  playlistId?: string;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function contextDepth(
  context: RepertoireContext,
  contexts: ReadonlyMap<string, RepertoireContext>,
): number {
  let depth = 0;
  let current: RepertoireContext | undefined = context;
  const seen = new Set<string>();
  while (current.parentContextId) {
    if (seen.has(current.id)) throw new Error(`Context cycle at ${current.id}`);
    seen.add(current.id);
    current = required(contexts.get(current.parentContextId), `Missing parent ${current.parentContextId}`);
    depth += 1;
  }
  return depth;
}

function canReachContext(
  graph: RepertoireGraph,
  startContextId: string,
  targetContextId: string,
): boolean {
  const stack = [startContextId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === targetContextId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const move of graph.moves) {
      if (move.contextId === current && move.included) stack.push(move.destinationContextId);
    }
  }
  return false;
}

function moveOrder(a: RepertoireMove, b: RepertoireMove): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

function selectedMoveForContext(
  graph: RepertoireGraph,
  contextId: string,
  targetContextId: string,
): RepertoireMove | undefined {
  const moves = graph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .sort(moveOrder);
  return moves.find((move) => canReachContext(graph, move.destinationContextId, targetContextId)) ?? moves[0];
}

function buildTree(graph: RepertoireGraph, repertoireId: string): readonly TrainingTreeItem[] {
  return toTrainingTreeItems(
    projectRepertoireTree(graph, {
      repertoireId,
      mode: 'browse',
    }),
  );
}

export function createGraphExercisePlan(
  graph: RepertoireGraph,
  options: GraphExercisePlanOptions,
): TrainingExercisePlan {
  validateRepertoireGraph(graph);
  const repertoire = required(
    graph.repertoires.find((item) => item.id === options.repertoireId),
    `Missing repertoire ${options.repertoireId}`,
  );
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const positions = new Map(graph.positions.map((position) => [position.id, position]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const root = required(contexts.get(options.rootContextId), `Missing root context ${options.rootContextId}`);
  const target = required(
    contexts.get(options.targetContextId),
    `Missing target context ${options.targetContextId}`,
  );
  if (root.repertoireId !== repertoire.id || target.repertoireId !== repertoire.id) {
    throw new Error('Exercise root and target must belong to the selected repertoire.');
  }
  if (!canReachContext(graph, root.id, target.id)) {
    throw new Error('Exercise target is not reachable from its root context.');
  }

  const promptMode = options.promptMode ?? 'normal';
  const reachable = new Set<string>();
  const queue = [root.id];
  while (queue.length > 0) {
    const contextId = queue.shift()!;
    if (reachable.has(contextId)) continue;
    reachable.add(contextId);
    graph.moves
      .filter((move) => move.contextId === contextId && move.included)
      .sort(moveOrder)
      .forEach((move) => queue.push(move.destinationContextId));
  }

  const compiled: TrainingExerciseStep[] = [];
  for (const context of [...contexts.values()]
    .filter((item) => reachable.has(item.id))
    .sort((a, b) => contextDepth(a, contexts) - contextDepth(b, contexts) || a.id.localeCompare(b.id))) {
    const outgoing = graph.moves
      .filter((move) => move.contextId === context.id && move.included)
      .sort(moveOrder);
    if (outgoing.length === 0) continue;
    const actors = new Set(outgoing.map((move) => move.actor));
    if (actors.size !== 1) throw new Error(`Mixed actors in context ${context.id}`);
    const actor = outgoing[0]!.actor;
    const selected = required(
      selectedMoveForContext(graph, context.id, target.id),
      `Missing selected move for ${context.id}`,
    );
    const selectedEdge = required(edges.get(selected.edgeId), `Missing selected edge ${selected.edgeId}`);
    const accepted =
      actor === 'user'
        ? queryAcceptedMoves(graph, {
            repertoireId: repertoire.id,
            activeContextIds: [context.id],
            ...(options.playlistId ? { playlistId: options.playlistId } : {}),
            positionId: context.entryPositionId,
            promptMode,
            ...(promptMode === 'strict' ? { strictPathFingerprint: context.pathFingerprint } : {}),
          })
        : {
            positionId: context.entryPositionId,
            moves: outgoing.map((move) => {
              const edge = required(edges.get(move.edgeId), `Missing edge ${move.edgeId}`);
              return {
                edgeId: edge.id,
                uci: edge.uci,
                san: edge.san,
                destinationContextIds: [move.destinationContextId],
              };
            }),
            normalizedKey: normalizedAcceptedMoveSet(
              outgoing.map((move) => required(edges.get(move.edgeId), `Missing edge ${move.edgeId}`).uci),
            ),
          };
    if (accepted.moves.length === 0) throw new Error(`Context ${context.id} has no accepted moves.`);
    const selectedInput = required(moveFromUci(selectedEdge.uci), `Invalid selected UCI ${selectedEdge.uci}`);
    const nextStepByAcceptedUci: Record<string, string | undefined> = {};
    const treeItemIdByAcceptedUci: Record<string, string> = {};
    const targetDispositionByAcceptedUci: Record<string, 'preserved' | 'displaced'> = {};
    for (const acceptedMove of accepted.moves) {
      const matching = outgoing.filter((move) => move.edgeId === acceptedMove.edgeId);
      const destination = matching[0]?.destinationContextId ?? acceptedMove.destinationContextIds[0];
      if (!destination) continue;
      const destinationHasMoves = graph.moves.some(
        (move) => move.contextId === destination && move.included,
      );
      nextStepByAcceptedUci[acceptedMove.uci] = destinationHasMoves ? destination : undefined;
      treeItemIdByAcceptedUci[acceptedMove.uci] = matching[0]?.id ?? `tree:${destination}`;
      targetDispositionByAcceptedUci[acceptedMove.uci] =
        context.id === target.id || canReachContext(graph, destination, target.id)
          ? 'preserved'
          : 'displaced';
    }
    const position = required(positions.get(context.entryPositionId), `Missing position ${context.entryPositionId}`);
    const trainingItemId = trainingItemIdentityKey({
      repertoireId: repertoire.id,
      contextScopeKey: promptMode === 'normal' ? position.key : context.id,
      positionKey: position.key,
      acceptedMoveSetKey: accepted.normalizedKey,
      promptMode,
      ...(promptMode === 'strict' ? { strictPathFingerprint: context.pathFingerprint } : {}),
    });
    compiled.push({
      id: context.id,
      ply: contextDepth(context, contexts),
      actor,
      from: selectedInput.from,
      to: selectedInput.to,
      ...(selectedInput.promotion ? { promotion: selectedInput.promotion } : {}),
      san: selectedEdge.san,
      treeItemId: selected.id,
      acceptedUci: accepted.moves.map((move) => move.uci),
      acceptedMoveSetKey: accepted.normalizedKey,
      trainingItemId,
      positionKey: position.key,
      nextStepId: nextStepByAcceptedUci[selectedEdge.uci],
      nextStepByAcceptedUci,
      treeItemIdByAcceptedUci,
      targetDispositionByAcceptedUci,
    });
  }

  if (!compiled.some((step) => step.id === target.id && step.actor === 'user')) {
    throw new Error('Target context must resolve to a user decision with accepted moves.');
  }

  return {
    id: `graph-plan:${repertoire.id}:${root.id}:${target.id}:${promptMode}`,
    label: repertoire.name,
    description: `Contextual repertoire exercise targeting ${target.label ?? target.id}.`,
    orientation: repertoire.userColour,
    userColour: repertoire.userColour,
    initialFen: required(positions.get(root.entryPositionId), `Missing root position ${root.entryPositionId}`).fen,
    startStepId: root.id,
    targetStepId: target.id,
    steps: compiled,
    tree: buildTree(graph, repertoire.id),
  };
}
