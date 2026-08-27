import { moveFromUci } from '../chess/chessAdapter';
import type { TrainingExercisePlan, TrainingExerciseStep } from '../training/exercisePlan';
import { normalizedAcceptedMoveSet } from '../training/exercisePlan';
import type { TrainingTreeItem } from '../../fixtures/trainingFixtures';
import {
  contextPly,
  playlistAllowsRouteContext,
  queryAcceptedMoves,
  required,
  trainingItemIdentityKey,
  validateRepertoireGraph,
} from './graph';
import { projectRepertoireTree, toTrainingTreeItems } from './treeProjection';
import type {
  Playlist,
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

function contextsById(graph: RepertoireGraph): Map<string, RepertoireContext> {
  return new Map(graph.contexts.map((context) => [context.id, context]));
}

function contextAndAncestorsIncluded(
  context: RepertoireContext,
  contexts: ReadonlyMap<string, RepertoireContext>,
): boolean {
  let current: RepertoireContext | undefined = context;
  const seen = new Set<string>();
  while (current) {
    if (!current.included || seen.has(current.id)) return false;
    seen.add(current.id);
    current = current.parentContextId ? contexts.get(current.parentContextId) : undefined;
  }
  return true;
}

function moveOrder(a: RepertoireMove, b: RepertoireMove): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

function playlistFor(
  graph: RepertoireGraph,
  playlistId: string | undefined,
): Playlist | undefined {
  if (!playlistId) return undefined;
  return required(
    graph.playlists.find((item) => item.id === playlistId),
    `Missing playlist ${playlistId}`,
  );
}

function routeContextAllowed(
  graph: RepertoireGraph,
  context: RepertoireContext,
  contexts: ReadonlyMap<string, RepertoireContext>,
  playlist: Playlist | undefined,
): boolean {
  if (!contextAndAncestorsIncluded(context, contexts)) return false;
  return !playlist || playlistAllowsRouteContext(graph, playlist, context);
}

function outgoingMoves(
  graph: RepertoireGraph,
  contextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
  playlist: Playlist | undefined,
): RepertoireMove[] {
  const context = contexts.get(contextId);
  if (!context || !routeContextAllowed(graph, context, contexts, playlist)) return [];
  return graph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .filter((move) => {
      const destination = contexts.get(move.destinationContextId);
      return Boolean(
        destination && routeContextAllowed(graph, destination, contexts, playlist),
      );
    })
    .sort(moveOrder);
}

function canReachContext(
  graph: RepertoireGraph,
  startContextId: string,
  targetContextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
  playlist: Playlist | undefined,
): boolean {
  const stack = [startContextId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === targetContextId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const move of outgoingMoves(graph, current, contexts, playlist)) {
      stack.push(move.destinationContextId);
    }
  }
  return false;
}

function buildTree(
  graph: RepertoireGraph,
  repertoireId: string,
  playlistId: string | undefined,
  mode: 'train' | 'browse',
): readonly TrainingTreeItem[] {
  return toTrainingTreeItems(
    projectRepertoireTree(graph, {
      repertoireId,
      mode,
      ...(playlistId ? { playlistId } : {}),
    }),
  );
}

function knownSiblingUcis(
  graph: RepertoireGraph,
  repertoireId: string,
  positionId: string,
  acceptedUci: ReadonlySet<string>,
): readonly string[] {
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return [
    ...new Set(
      graph.moves
        .filter((move) => move.actor === 'user' && move.included)
        .filter((move) => {
          const context = contexts.get(move.contextId);
          return (
            context?.repertoireId === repertoireId &&
            context.entryPositionId === positionId
          );
        })
        .map((move) => edges.get(move.edgeId)?.uci)
        .filter((uci): uci is string => Boolean(uci && !acceptedUci.has(uci))),
    ),
  ].sort();
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
  const contexts = contextsById(graph);
  const positions = new Map(graph.positions.map((position) => [position.id, position]));
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const playlist = playlistFor(graph, options.playlistId);
  if (playlist && !playlist.repertoireIds.includes(repertoire.id)) {
    throw new Error('Selected playlist does not include the exercise repertoire.');
  }

  const root = required(
    contexts.get(options.rootContextId),
    `Missing root context ${options.rootContextId}`,
  );
  const target = required(
    contexts.get(options.targetContextId),
    `Missing target context ${options.targetContextId}`,
  );
  if (root.repertoireId !== repertoire.id || target.repertoireId !== repertoire.id) {
    throw new Error('Exercise root and target must belong to the selected repertoire.');
  }
  if (!routeContextAllowed(graph, root, contexts, playlist)) {
    throw new Error('Exercise root is outside the selected playlist route.');
  }
  if (!routeContextAllowed(graph, target, contexts, playlist)) {
    throw new Error('Exercise target is outside the selected playlist route.');
  }
  if (!canReachContext(graph, root.id, target.id, contexts, playlist)) {
    throw new Error('Exercise target is not reachable from its root context.');
  }

  const promptMode = options.promptMode ?? 'normal';
  const reachable = new Set<string>();
  const queue = [root.id];
  while (queue.length > 0) {
    const contextId = queue.shift()!;
    if (reachable.has(contextId)) continue;
    reachable.add(contextId);
    outgoingMoves(graph, contextId, contexts, playlist).forEach((move) =>
      queue.push(move.destinationContextId),
    );
  }

  const compiled: TrainingExerciseStep[] = [];
  const orderedContexts = [...contexts.values()]
    .filter((context) => reachable.has(context.id))
    .sort(
      (a, b) =>
        contextPly(a, contexts) - contextPly(b, contexts) ||
        a.pathFingerprint.localeCompare(b.pathFingerprint) ||
        a.id.localeCompare(b.id),
    );

  for (const context of orderedContexts) {
    const outgoing = outgoingMoves(graph, context.id, contexts, playlist);
    if (outgoing.length === 0) continue;
    const actors = new Set(outgoing.map((move) => move.actor));
    if (actors.size !== 1) throw new Error(`Mixed actors in context ${context.id}`);
    const actor = outgoing[0]!.actor;

    const accepted =
      actor === 'user'
        ? queryAcceptedMoves(graph, {
            repertoireId: repertoire.id,
            activeContextIds: [context.id],
            ...(options.playlistId ? { playlistId: options.playlistId } : {}),
            positionId: context.entryPositionId,
            promptMode,
            ...(promptMode === 'strict'
              ? { strictPathFingerprint: context.pathFingerprint }
              : {}),
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
              outgoing.map(
                (move) => required(edges.get(move.edgeId), `Missing edge ${move.edgeId}`).uci,
              ),
            ),
          };
    if (accepted.moves.length === 0) {
      throw new Error(`Context ${context.id} has no accepted moves.`);
    }

    const acceptedUcis = new Set(accepted.moves.map((move) => move.uci));
    const candidateMoves = outgoing.filter((move) => {
      const edge = edges.get(move.edgeId);
      return Boolean(edge && acceptedUcis.has(edge.uci));
    });
    const selected =
      candidateMoves.find((move) =>
        canReachContext(
          graph,
          move.destinationContextId,
          target.id,
          contexts,
          playlist,
        ),
      ) ?? candidateMoves[0];
    if (!selected) throw new Error(`Missing selected move for ${context.id}`);
    const selectedEdge = required(
      edges.get(selected.edgeId),
      `Missing selected edge ${selected.edgeId}`,
    );
    const selectedInput = moveFromUci(selectedEdge.uci);
    if (!selectedInput) {
      throw new Error(`Invalid selected UCI ${selectedEdge.uci}`);
    }

    const nextStepByAcceptedUci: Record<string, string | undefined> = {};
    const treeItemIdByAcceptedUci: Record<string, string> = {};
    const targetDispositionByAcceptedUci: Record<
      string,
      'preserved' | 'displaced'
    > = {};
    for (const acceptedMove of accepted.moves) {
      const matching = candidateMoves.find((move) => move.edgeId === acceptedMove.edgeId);
      const destination = matching?.destinationContextId ?? acceptedMove.destinationContextIds[0];
      if (!destination) continue;
      const destinationHasMoves =
        outgoingMoves(graph, destination, contexts, playlist).length > 0;
      nextStepByAcceptedUci[acceptedMove.uci] = destinationHasMoves
        ? destination
        : undefined;
      treeItemIdByAcceptedUci[acceptedMove.uci] =
        matching?.id ?? `tree:${destination}`;
      targetDispositionByAcceptedUci[acceptedMove.uci] =
        context.id === target.id ||
        canReachContext(graph, destination, target.id, contexts, playlist)
          ? 'preserved'
          : 'displaced';
    }

    const position = required(
      positions.get(context.entryPositionId),
      `Missing position ${context.entryPositionId}`,
    );
    const trainingItemId = trainingItemIdentityKey({
      repertoireId: repertoire.id,
      contextScopeKey: promptMode === 'normal' ? position.key : context.id,
      positionKey: position.key,
      acceptedMoveSetKey: accepted.normalizedKey,
      promptMode,
      ...(promptMode === 'strict'
        ? { strictPathFingerprint: context.pathFingerprint }
        : {}),
    });
    compiled.push({
      id: context.id,
      ply: contextPly(context, contexts),
      actor,
      from: selectedInput.from,
      to: selectedInput.to,
      ...(selectedInput.promotion ? { promotion: selectedInput.promotion } : {}),
      san: selectedEdge.san,
      treeItemId: selected.id,
      acceptedUci: accepted.moves.map((move) => move.uci),
      acceptedSan: accepted.moves.map((move) => move.san),
      acceptedMoveSetKey: accepted.normalizedKey,
      trainingItemId,
      positionKey: position.key,
      wrongSiblingUci:
        actor === 'user'
          ? knownSiblingUcis(graph, repertoire.id, context.entryPositionId, acceptedUcis)
          : [],
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
    id: [
      'graph-plan',
      repertoire.id,
      root.id,
      target.id,
      promptMode,
      options.playlistId ?? 'all',
    ].join(':'),
    label: repertoire.name,
    description: playlist
      ? `Contextual repertoire exercise using playlist ${playlist.name}.`
      : `Contextual repertoire exercise targeting ${target.label ?? target.id}.`,
    orientation: repertoire.userColour,
    userColour: repertoire.userColour,
    initialFen: required(
      positions.get(root.entryPositionId),
      `Missing root position ${root.entryPositionId}`,
    ).fen,
    startStepId: root.id,
    targetStepId: target.id,
    steps: compiled,
    tree: buildTree(graph, repertoire.id, options.playlistId, 'train'),
    browseTree: buildTree(graph, repertoire.id, options.playlistId, 'browse'),
  };
}
