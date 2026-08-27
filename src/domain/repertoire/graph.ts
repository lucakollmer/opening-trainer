import { moveFromUci, tryApplyMove } from '../chess/chessAdapter';
import { canonicalPositionKey } from '../chess/positionKey';
import type {
  AcceptedMoveSet,
  DecisionQuery,
  Playlist,
  RepertoireContext,
  RepertoireGraph,
  TrainingItemIdentity,
} from './types';

function uniqueIds<T extends { id: string }>(items: readonly T[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate ${label} ID: ${item.id}`);
    seen.add(item.id);
  }
}

export function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function contextsById(graph: RepertoireGraph): Map<string, RepertoireContext> {
  return new Map(graph.contexts.map((context) => [context.id, context]));
}

export function contextPly(
  context: RepertoireContext,
  byId: ReadonlyMap<string, RepertoireContext>,
): number {
  let ply = 0;
  let current = context;
  const visited = new Set<string>();
  while (current.parentContextId) {
    if (visited.has(current.id)) {
      throw new Error(`Context cycle detected at ${current.id}`);
    }
    visited.add(current.id);
    current = required(
      byId.get(current.parentContextId),
      `Dangling parent context: ${current.id}`,
    );
    ply += 1;
  }
  return ply;
}

function contextAndAncestorsIncluded(
  context: RepertoireContext,
  byId: ReadonlyMap<string, RepertoireContext>,
): boolean {
  let current: RepertoireContext | undefined = context;
  const visited = new Set<string>();
  while (current) {
    if (!current.included || visited.has(current.id)) return false;
    visited.add(current.id);
    current = current.parentContextId ? byId.get(current.parentContextId) : undefined;
  }
  return true;
}

export function isDescendantOrSelf(
  contextId: string,
  ancestorId: string,
  byId: ReadonlyMap<string, RepertoireContext>,
): boolean {
  let current = byId.get(contextId);
  const visited = new Set<string>();
  while (current) {
    if (current.id === ancestorId) return true;
    if (visited.has(current.id)) return false;
    visited.add(current.id);
    current = current.parentContextId ? byId.get(current.parentContextId) : undefined;
  }
  return false;
}

function playlistBaseAllowsContext(
  graph: RepertoireGraph,
  playlist: Playlist,
  context: RepertoireContext,
  byId: ReadonlyMap<string, RepertoireContext>,
  ply: number,
): boolean {
  const repertoire = graph.repertoires.find((item) => item.id === context.repertoireId);
  if (!repertoire || repertoire.archivedAt || !playlist.repertoireIds.includes(repertoire.id)) {
    return false;
  }
  if (playlist.colour && playlist.colour !== repertoire.userColour) return false;
  if (playlist.maxPly !== undefined && ply > playlist.maxPly) return false;
  if (!contextAndAncestorsIncluded(context, byId)) return false;
  return !playlist.excludedContextIds.some((excluded) =>
    isDescendantOrSelf(context.id, excluded, byId),
  );
}

function insideIncludedSubtree(
  context: RepertoireContext,
  playlist: Playlist,
  byId: ReadonlyMap<string, RepertoireContext>,
): boolean {
  if (playlist.includedContextIds.length === 0) return true;
  return playlist.includedContextIds.some((included) =>
    isDescendantOrSelf(context.id, included, byId),
  );
}

export function playlistAllowsContext(
  graph: RepertoireGraph,
  playlist: Playlist,
  context: RepertoireContext,
  ply?: number,
): boolean {
  const byId = contextsById(graph);
  const graphContext = byId.get(context.id);
  if (!graphContext) return false;
  const effectivePly = ply ?? contextPly(graphContext, byId);
  if (!playlistBaseAllowsContext(graph, playlist, graphContext, byId, effectivePly)) {
    return false;
  }
  if (!insideIncludedSubtree(graphContext, playlist, byId)) return false;
  return (
    playlist.tags.length === 0 ||
    playlist.tags.some((tag) => graphContext.tags.includes(tag))
  );
}

export function playlistAllowsRouteContext(
  graph: RepertoireGraph,
  playlist: Playlist,
  context: RepertoireContext,
): boolean {
  const byId = contextsById(graph);
  const graphContext = byId.get(context.id);
  if (!graphContext) return false;
  const ply = contextPly(graphContext, byId);
  if (!playlistBaseAllowsContext(graph, playlist, graphContext, byId, ply)) return false;

  const isOnIncludedRoute =
    playlist.includedContextIds.length === 0 ||
    playlist.includedContextIds.some(
      (included) =>
        isDescendantOrSelf(graphContext.id, included, byId) ||
        isDescendantOrSelf(included, graphContext.id, byId),
    );
  if (!isOnIncludedRoute) return false;
  if (playlist.tags.length === 0) return true;
  if (playlist.tags.some((tag) => graphContext.tags.includes(tag))) return true;

  return graph.contexts.some((candidate) => {
    if (candidate.repertoireId !== graphContext.repertoireId) return false;
    if (!isDescendantOrSelf(candidate.id, graphContext.id, byId)) return false;
    const candidatePly = contextPly(candidate, byId);
    if (!playlistBaseAllowsContext(graph, playlist, candidate, byId, candidatePly)) {
      return false;
    }
    if (!insideIncludedSubtree(candidate, playlist, byId)) return false;
    return playlist.tags.some((tag) => candidate.tags.includes(tag));
  });
}

export function validateRepertoireGraph(graph: RepertoireGraph): void {
  uniqueIds(graph.repertoires, 'repertoire');
  uniqueIds(graph.positions, 'position');
  uniqueIds(graph.edges, 'edge');
  uniqueIds(graph.contexts, 'context');
  uniqueIds(graph.moves, 'repertoire move');
  uniqueIds(graph.playlists, 'playlist');

  const repertoires = new Map(graph.repertoires.map((item) => [item.id, item]));
  const positions = new Map(graph.positions.map((item) => [item.id, item]));
  const edges = new Map(graph.edges.map((item) => [item.id, item]));
  const contexts = contextsById(graph);
  const positionKeys = new Map<string, string>();
  const edgeKeys = new Map<string, string>();
  const pathKeys = new Map<string, string>();

  for (const position of graph.positions) {
    if (canonicalPositionKey(position.fen) !== position.key) {
      throw new Error(`Position key mismatch: ${position.id}`);
    }
    const existing = positionKeys.get(position.key);
    if (existing && existing !== position.id) {
      throw new Error(`Duplicate canonical position nodes: ${existing}, ${position.id}`);
    }
    positionKeys.set(position.key, position.id);
  }

  for (const edge of graph.edges) {
    const source = required(
      positions.get(edge.fromPositionId),
      `Dangling edge source position: ${edge.id}`,
    );
    const target = required(
      positions.get(edge.toPositionId),
      `Dangling edge target position: ${edge.id}`,
    );
    const input = moveFromUci(edge.uci);
    if (!input) throw new Error(`Invalid UCI on edge ${edge.id}: ${edge.uci}`);
    const applied = tryApplyMove(source.fen, input);
    if (applied.kind !== 'applied') throw new Error(`Illegal edge: ${edge.id}`);
    if (applied.move.san !== edge.san) throw new Error(`SAN mismatch on edge: ${edge.id}`);
    if (applied.move.positionKey !== target.key) {
      throw new Error(`Edge result mismatch: ${edge.id}`);
    }
    const key = `${edge.fromPositionId}:${edge.uci}`;
    const existing = edgeKeys.get(key);
    if (existing && existing !== edge.toPositionId) {
      throw new Error(`Conflicting duplicate edge: ${key}`);
    }
    if (existing) throw new Error(`Duplicate edge: ${key}`);
    edgeKeys.set(key, edge.toPositionId);
  }

  for (const context of graph.contexts) {
    const repertoire = required(
      repertoires.get(context.repertoireId),
      `Dangling context repertoire: ${context.id}`,
    );
    required(
      positions.get(context.entryPositionId),
      `Dangling context position: ${context.id}`,
    );
    const pathKey = `${repertoire.id}:${context.pathFingerprint}`;
    const priorPath = pathKeys.get(pathKey);
    if (priorPath && priorPath !== context.id) {
      throw new Error(`Duplicate contextual path identity: ${context.pathFingerprint}`);
    }
    pathKeys.set(pathKey, context.id);
    if (context.parentContextId) {
      const parent = required(
        contexts.get(context.parentContextId),
        `Dangling parent context: ${context.id}`,
      );
      if (parent.repertoireId !== repertoire.id) {
        throw new Error(`Cross-repertoire context parent: ${context.id}`);
      }
    }
  }

  for (const context of graph.contexts) contextPly(context, contexts);

  const rootIds = new Set<string>();
  for (const repertoire of graph.repertoires) {
    if (new Set(repertoire.rootContextIds).size !== repertoire.rootContextIds.length) {
      throw new Error(`Duplicate repertoire root context: ${repertoire.id}`);
    }
    for (const rootId of repertoire.rootContextIds) {
      const root = required(
        contexts.get(rootId),
        `Missing repertoire root context: ${rootId}`,
      );
      if (root.repertoireId !== repertoire.id || root.parentContextId) {
        throw new Error(`Invalid repertoire root context: ${rootId}`);
      }
      rootIds.add(rootId);
    }
  }
  for (const context of graph.contexts) {
    if (!context.parentContextId && !rootIds.has(context.id)) {
      throw new Error(`Unregistered root context: ${context.id}`);
    }
  }

  const movesByContext = new Map<string, typeof graph.moves>();
  const incomingByContext = new Map<string, number>();
  const contextualMoveKeys = new Set<string>();
  for (const move of graph.moves) {
    const context = required(
      contexts.get(move.contextId),
      `Dangling move context: ${move.id}`,
    );
    const edge = required(edges.get(move.edgeId), `Dangling move edge: ${move.id}`);
    const destination = required(
      contexts.get(move.destinationContextId),
      `Dangling move destination context: ${move.id}`,
    );
    const repertoire = required(
      repertoires.get(context.repertoireId),
      `Missing repertoire for move ${move.id}`,
    );
    const sourcePosition = required(
      positions.get(context.entryPositionId),
      `Missing source position for move ${move.id}`,
    );
    if (edge.fromPositionId !== context.entryPositionId) {
      throw new Error(`Move edge does not start at its context: ${move.id}`);
    }
    if (edge.toPositionId !== destination.entryPositionId) {
      throw new Error(`Move destination position mismatch: ${move.id}`);
    }
    if (destination.parentContextId !== context.id) {
      throw new Error(`Move destination must be a child context: ${move.id}`);
    }
    if (destination.repertoireId !== context.repertoireId) {
      throw new Error(`Move crosses repertoire contexts: ${move.id}`);
    }
    if (destination.pathFingerprint !== `${context.pathFingerprint}/${edge.uci}`) {
      throw new Error(`Move destination path fingerprint mismatch: ${move.id}`);
    }
    const contextualKey = `${context.id}:${edge.id}`;
    if (contextualMoveKeys.has(contextualKey)) {
      throw new Error(`Duplicate contextual move: ${contextualKey}`);
    }
    contextualMoveKeys.add(contextualKey);

    const turn = sourcePosition.fen.split(/\s+/u)[1];
    const expectedActor =
      (turn === 'w' ? 'white' : 'black') === repertoire.userColour
        ? 'user'
        : 'opponent';
    if (move.actor !== expectedActor) throw new Error(`Move actor mismatch: ${move.id}`);
    if (!Number.isInteger(move.order) || move.order < 0) {
      throw new Error(`Invalid move order: ${move.id}`);
    }
    incomingByContext.set(
      destination.id,
      (incomingByContext.get(destination.id) ?? 0) + 1,
    );
    const current = movesByContext.get(move.contextId) ?? [];
    movesByContext.set(move.contextId, [...current, move]);
  }

  for (const context of graph.contexts) {
    const incoming = incomingByContext.get(context.id) ?? 0;
    if (context.parentContextId && incoming !== 1) {
      throw new Error(`Context must have exactly one contextual incoming move: ${context.id}`);
    }
    if (!context.parentContextId && incoming !== 0) {
      throw new Error(`Root context has an incoming move: ${context.id}`);
    }
  }

  for (const [contextId, moves] of movesByContext) {
    const actors = new Set(moves.map((move) => move.actor));
    if (actors.size > 1) throw new Error(`Mixed move actors in context: ${contextId}`);
    if (moves[0]?.actor === 'user' && !moves.some((move) => move.included)) {
      throw new Error(`User decision has no accepted move: ${contextId}`);
    }
    const orders = [...moves.map((move) => move.order)].sort((a, b) => a - b);
    orders.forEach((order, index) => {
      if (order !== index) throw new Error(`Non-contiguous move order in context: ${contextId}`);
    });
  }

  for (const playlist of graph.playlists) {
    if (
      playlist.maxPly !== undefined &&
      (!Number.isInteger(playlist.maxPly) || playlist.maxPly < 0)
    ) {
      throw new Error(`Invalid playlist maxPly: ${playlist.id}`);
    }
    const repertoireIds = new Set(playlist.repertoireIds);
    for (const repertoireId of repertoireIds) {
      const repertoire = required(
        repertoires.get(repertoireId),
        `Playlist references missing repertoire: ${playlist.id}`,
      );
      if (repertoire.archivedAt) {
        throw new Error(`Playlist references archived repertoire: ${playlist.id}`);
      }
    }
    for (const contextId of [
      ...playlist.includedContextIds,
      ...playlist.excludedContextIds,
    ]) {
      const context = required(
        contexts.get(contextId),
        `Playlist references missing context: ${playlist.id}`,
      );
      if (!repertoireIds.has(context.repertoireId)) {
        throw new Error(`Playlist context is outside its repertoire set: ${playlist.id}`);
      }
    }
  }
}

export function queryAcceptedMoves(
  graph: RepertoireGraph,
  query: DecisionQuery,
): AcceptedMoveSet {
  const repertoire = required(
    graph.repertoires.find((item) => item.id === query.repertoireId),
    `Missing repertoire: ${query.repertoireId}`,
  );
  if (repertoire.archivedAt) {
    return { positionId: query.positionId, moves: [], normalizedKey: '' };
  }
  const contexts = contextsById(graph);
  const playlist = query.playlistId
    ? required(
        graph.playlists.find((item) => item.id === query.playlistId),
        `Missing playlist: ${query.playlistId}`,
      )
    : undefined;
  const active = query.activeContextIds
    .map((id) => contexts.get(id))
    .filter((context): context is RepertoireContext => context !== undefined)
    .filter((context) => context.repertoireId === query.repertoireId)
    .filter((context) => context.entryPositionId === query.positionId)
    .filter((context) => contextAndAncestorsIncluded(context, contexts))
    .filter(
      (context) =>
        !playlist || playlistAllowsRouteContext(graph, playlist, context),
    )
    .filter(
      (context) =>
        query.promptMode !== 'strict' ||
        !query.strictPathFingerprint ||
        context.pathFingerprint === query.strictPathFingerprint,
    );

  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const grouped = new Map<
    string,
    { edgeId: string; uci: string; san: string; destinationContextIds: string[] }
  >();
  for (const context of active) {
    for (const move of graph.moves) {
      if (move.contextId !== context.id || move.actor !== 'user' || !move.included) {
        continue;
      }
      const destination = contexts.get(move.destinationContextId);
      if (!destination || !contextAndAncestorsIncluded(destination, contexts)) continue;
      if (
        playlist &&
        !playlistAllowsRouteContext(graph, playlist, destination)
      ) {
        continue;
      }
      const edge = required(edgeById.get(move.edgeId), `Missing edge for move ${move.id}`);
      const existing = grouped.get(edge.uci);
      if (existing) {
        if (!existing.destinationContextIds.includes(move.destinationContextId)) {
          existing.destinationContextIds.push(move.destinationContextId);
        }
      } else {
        grouped.set(edge.uci, {
          edgeId: edge.id,
          uci: edge.uci,
          san: edge.san,
          destinationContextIds: [move.destinationContextId],
        });
      }
    }
  }

  const moves = [...grouped.values()]
    .map((move) => ({
      ...move,
      destinationContextIds: [...move.destinationContextIds].sort(),
    }))
    .sort((a, b) => a.uci.localeCompare(b.uci));

  return {
    positionId: query.positionId,
    moves,
    normalizedKey: moves.map((move) => move.uci).join('|'),
  };
}

export function trainingItemIdentityKey(identity: TrainingItemIdentity): string {
  const strict =
    identity.promptMode === 'strict' ? (identity.strictPathFingerprint ?? '') : '';
  return [
    identity.repertoireId,
    identity.contextScopeKey,
    identity.positionKey,
    identity.acceptedMoveSetKey,
    identity.promptMode,
    strict,
  ].join('::');
}
