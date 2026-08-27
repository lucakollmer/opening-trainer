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

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function contextsById(graph: RepertoireGraph): Map<string, RepertoireContext> {
  return new Map(graph.contexts.map((context) => [context.id, context]));
}

function isDescendantOrSelf(
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

export function playlistAllowsContext(
  graph: RepertoireGraph,
  playlist: Playlist,
  context: RepertoireContext,
  ply?: number,
): boolean {
  const repertoire = graph.repertoires.find((item) => item.id === context.repertoireId);
  if (!repertoire || !playlist.repertoireIds.includes(repertoire.id)) return false;
  if (playlist.colour && playlist.colour !== repertoire.userColour) return false;
  if (playlist.maxPly !== undefined && ply !== undefined && ply > playlist.maxPly) return false;
  if (playlist.tags.length > 0 && !playlist.tags.some((tag) => context.tags.includes(tag))) {
    return false;
  }

  const byId = contextsById(graph);
  if (
    playlist.excludedContextIds.some((excluded) =>
      isDescendantOrSelf(context.id, excluded, byId),
    )
  ) {
    return false;
  }
  if (playlist.includedContextIds.length === 0) return true;
  return playlist.includedContextIds.some((included) =>
    isDescendantOrSelf(context.id, included, byId),
  );
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
  const edgeKeys = new Map<string, string>();

  for (const position of graph.positions) {
    if (canonicalPositionKey(position.fen) !== position.key) {
      throw new Error(`Position key mismatch: ${position.id}`);
    }
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
    required(positions.get(context.entryPositionId), `Dangling context position: ${context.id}`);
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

  for (const repertoire of graph.repertoires) {
    for (const rootId of repertoire.rootContextIds) {
      const root = required(contexts.get(rootId), `Missing repertoire root context: ${rootId}`);
      if (root.repertoireId !== repertoire.id || root.parentContextId) {
        throw new Error(`Invalid repertoire root context: ${rootId}`);
      }
    }
  }

  for (const context of graph.contexts) {
    const seen = new Set<string>();
    let current: RepertoireContext | undefined = context;
    while (current) {
      if (seen.has(current.id)) throw new Error(`Context cycle detected at ${current.id}`);
      seen.add(current.id);
      current = current.parentContextId ? contexts.get(current.parentContextId) : undefined;
    }
  }

  const movesByContext = new Map<string, typeof graph.moves>();
  for (const move of graph.moves) {
    const context = required(contexts.get(move.contextId), `Dangling move context: ${move.id}`);
    const edge = required(edges.get(move.edgeId), `Dangling move edge: ${move.id}`);
    const destination = required(
      contexts.get(move.destinationContextId),
      `Dangling move destination context: ${move.id}`,
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
    const current = movesByContext.get(move.contextId) ?? [];
    movesByContext.set(move.contextId, [...current, move]);
  }

  for (const [contextId, moves] of movesByContext) {
    const actors = new Set(moves.map((move) => move.actor));
    if (actors.size > 1) throw new Error(`Mixed move actors in context: ${contextId}`);
    if (moves[0]?.actor === 'user' && !moves.some((move) => move.included)) {
      throw new Error(`User decision has no accepted move: ${contextId}`);
    }
    const orderKeys = new Set<string>();
    for (const move of moves) {
      const key = `${move.order}:${move.edgeId}`;
      if (orderKeys.has(key)) throw new Error(`Duplicate move ordering entry: ${contextId}`);
      orderKeys.add(key);
    }
  }

  for (const playlist of graph.playlists) {
    for (const repertoireId of playlist.repertoireIds) {
      const repertoire = required(
        repertoires.get(repertoireId),
        `Playlist references missing repertoire: ${playlist.id}`,
      );
      if (repertoire.archivedAt) {
        throw new Error(`Playlist references archived repertoire: ${playlist.id}`);
      }
    }
    for (const contextId of [...playlist.includedContextIds, ...playlist.excludedContextIds]) {
      required(contexts.get(contextId), `Playlist references missing context: ${playlist.id}`);
    }
  }
}

export function queryAcceptedMoves(
  graph: RepertoireGraph,
  query: DecisionQuery,
): AcceptedMoveSet {
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
    .filter((context) => !playlist || playlistAllowsContext(graph, playlist, context))
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
      if (move.contextId !== context.id || move.actor !== 'user' || !move.included) continue;
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
