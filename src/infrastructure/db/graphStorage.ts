import {
  queryAcceptedMoves,
  trainingItemIdentityKey,
  validateRepertoireGraph,
} from '../../domain/repertoire/graph';
import type {
  Playlist,
  RepertoireContext,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import type {
  DecisionRuleRecord,
  MoveEdgeRecord,
  PlaylistEntryRecord,
  PlaylistRecord,
  PositionRecord,
  RepertoireContextRecord,
  RepertoireMoveRecord,
  RepertoireRecord,
  TrainingItemRecord,
} from './openingTrainerDatabase';

export interface StoredGraphRows {
  repertoires: RepertoireRecord[];
  repertoireContexts: RepertoireContextRecord[];
  positions: PositionRecord[];
  moveEdges: MoveEdgeRecord[];
  repertoireMoves: RepertoireMoveRecord[];
  playlists: PlaylistRecord[];
  playlistEntries: PlaylistEntryRecord[];
}

export interface DerivedTrainingRows {
  decisionRules: DecisionRuleRecord[];
  trainingItems: TrainingItemRecord[];
}

function persistentPositionId(key: string): string {
  return `position:${key}`;
}

function persistentEdgeId(fromPositionId: string, uci: string): string {
  return `edge:${fromPositionId}:${uci}`;
}

function persistentContextId(repertoireId: string, pathFingerprint: string): string {
  return `context:${repertoireId}:${pathFingerprint}`;
}

function persistentMoveId(contextId: string, uci: string): string {
  return `move:${contextId}:${uci}`;
}

function playlistEntryId(
  playlistId: string,
  kind: PlaylistEntryRecord['kind'],
  order: number,
): string {
  return `playlist-entry:${playlistId}:${kind}:${String(order).padStart(4, '0')}`;
}

function timestampOrNow(value: string, now: string): string {
  return value === '1970-01-01T00:00:00.000Z' ? now : value;
}

export function canonicalizeGraphForPersistence(
  source: RepertoireGraph,
  now: string,
): RepertoireGraph {
  validateRepertoireGraph(source);

  const sourceEdgeById = new Map(source.edges.map((edge) => [edge.id, edge]));
  const positionIdByOld = new Map(
    source.positions.map((position) => [
      position.id,
      persistentPositionId(position.key),
    ]),
  );
  const edgeIdByOld = new Map(
    source.edges.map((edge) => {
      const fromPositionId = positionIdByOld.get(edge.fromPositionId);
      if (!fromPositionId) {
        throw new Error(`Missing source position ${edge.fromPositionId}.`);
      }
      return [edge.id, persistentEdgeId(fromPositionId, edge.uci)] as const;
    }),
  );
  const contextIdByOld = new Map(
    source.contexts.map((context) => [
      context.id,
      persistentContextId(context.repertoireId, context.pathFingerprint),
    ]),
  );

  const positions = source.positions.map((position) => ({
    ...position,
    id: positionIdByOld.get(position.id)!,
    createdAt: timestampOrNow(position.createdAt, now),
  }));
  const edges = source.edges.map((edge) => ({
    ...edge,
    id: edgeIdByOld.get(edge.id)!,
    fromPositionId: positionIdByOld.get(edge.fromPositionId)!,
    toPositionId: positionIdByOld.get(edge.toPositionId)!,
  }));
  const contexts = source.contexts.map((context) => ({
    ...context,
    id: contextIdByOld.get(context.id)!,
    entryPositionId: positionIdByOld.get(context.entryPositionId)!,
    ...(context.parentContextId
      ? { parentContextId: contextIdByOld.get(context.parentContextId)! }
      : {}),
  }));
  const moves = source.moves.map((move) => {
    const contextId = contextIdByOld.get(move.contextId)!;
    const edge = sourceEdgeById.get(move.edgeId);
    if (!edge) throw new Error(`Missing edge ${move.edgeId}.`);
    return {
      ...move,
      id: persistentMoveId(contextId, edge.uci),
      contextId,
      edgeId: edgeIdByOld.get(move.edgeId)!,
      destinationContextId: contextIdByOld.get(move.destinationContextId)!,
    };
  });
  const repertoires = source.repertoires.map((repertoire) => ({
    ...repertoire,
    rootContextIds: repertoire.rootContextIds.map((id) => contextIdByOld.get(id)!),
    createdAt: timestampOrNow(repertoire.createdAt, now),
    updatedAt: now,
  }));
  const playlists = source.playlists.map((playlist) => ({
    ...playlist,
    includedContextIds: playlist.includedContextIds.map((id) =>
      contextIdByOld.get(id)!,
    ),
    excludedContextIds: playlist.excludedContextIds.map((id) =>
      contextIdByOld.get(id)!,
    ),
    createdAt: timestampOrNow(playlist.createdAt, now),
    updatedAt: now,
  }));

  const graph = { repertoires, positions, edges, contexts, moves, playlists };
  validateRepertoireGraph(graph);
  return graph;
}

export function graphToStoredRows(graph: RepertoireGraph): StoredGraphRows {
  validateRepertoireGraph(graph);
  const playlists: PlaylistRecord[] = [];
  const playlistEntries: PlaylistEntryRecord[] = [];

  for (const playlist of graph.playlists) {
    playlists.push({
      id: playlist.id,
      name: playlist.name,
      ...(playlist.colour ? { colour: playlist.colour } : {}),
      ...(playlist.maxPly !== undefined ? { maxPly: playlist.maxPly } : {}),
      weighting: playlist.weighting,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    });
    const entries: Array<{ kind: PlaylistEntryRecord['kind']; value: string }> = [
      ...playlist.repertoireIds.map((value) => ({
        kind: 'repertoire' as const,
        value,
      })),
      ...playlist.includedContextIds.map((value) => ({
        kind: 'include-context' as const,
        value,
      })),
      ...playlist.excludedContextIds.map((value) => ({
        kind: 'exclude-context' as const,
        value,
      })),
      ...playlist.tags.map((value) => ({ kind: 'tag' as const, value })),
    ];
    entries.forEach((entry, order) =>
      playlistEntries.push({
        id: playlistEntryId(playlist.id, entry.kind, order),
        playlistId: playlist.id,
        kind: entry.kind,
        value: entry.value,
        order,
      }),
    );
  }

  return {
    repertoires: graph.repertoires.map((record) => structuredClone(record)),
    repertoireContexts: graph.contexts.map((record) => structuredClone(record)),
    positions: graph.positions.map((record) => structuredClone(record)),
    moveEdges: graph.edges.map((record) => structuredClone(record)),
    repertoireMoves: graph.moves.map((record) => structuredClone(record)),
    playlists,
    playlistEntries,
  };
}

function playlistFromRows(
  record: PlaylistRecord,
  entries: readonly PlaylistEntryRecord[],
): Playlist {
  const ordered = entries
    .filter((entry) => entry.playlistId === record.id)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const values = (kind: PlaylistEntryRecord['kind']) =>
    ordered.filter((entry) => entry.kind === kind).map((entry) => entry.value);
  return {
    id: record.id,
    name: record.name,
    repertoireIds: values('repertoire'),
    ...(record.colour ? { colour: record.colour } : {}),
    includedContextIds: values('include-context'),
    excludedContextIds: values('exclude-context'),
    ...(record.maxPly !== undefined ? { maxPly: record.maxPly } : {}),
    tags: values('tag'),
    weighting: record.weighting,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function storedRowsToGraph(rows: StoredGraphRows): RepertoireGraph {
  const graph: RepertoireGraph = {
    repertoires: structuredClone(rows.repertoires),
    contexts: structuredClone(rows.repertoireContexts),
    positions: structuredClone(rows.positions),
    edges: structuredClone(rows.moveEdges),
    moves: structuredClone(rows.repertoireMoves),
    playlists: rows.playlists.map((playlist) =>
      playlistFromRows(playlist, rows.playlistEntries),
    ),
  };
  validateRepertoireGraph(graph);
  return graph;
}

export function graphForRepertoire(
  graph: RepertoireGraph,
  repertoireId: string,
): RepertoireGraph {
  const repertoire = graph.repertoires.find((item) => item.id === repertoireId);
  if (!repertoire) throw new Error(`Missing repertoire ${repertoireId}.`);
  const contexts = graph.contexts.filter(
    (context) => context.repertoireId === repertoireId,
  );
  const contextIds = new Set(contexts.map((context) => context.id));
  const moves = graph.moves.filter((move) => contextIds.has(move.contextId));
  const edgeIds = new Set(moves.map((move) => move.edgeId));
  const edges = graph.edges.filter((edge) => edgeIds.has(edge.id));
  const positionIds = new Set<string>();
  contexts.forEach((context) => positionIds.add(context.entryPositionId));
  edges.forEach((edge) => {
    positionIds.add(edge.fromPositionId);
    positionIds.add(edge.toPositionId);
  });
  const positions = graph.positions.filter((position) => positionIds.has(position.id));
  const playlists = graph.playlists.filter(
    (playlist) =>
      playlist.repertoireIds.length === 1 && playlist.repertoireIds[0] === repertoireId,
  );
  const result = {
    repertoires: [repertoire],
    contexts,
    positions,
    edges,
    moves,
    playlists,
  };
  validateRepertoireGraph(result);
  return result;
}

function contextHasUserMove(graph: RepertoireGraph, contextId: string): boolean {
  return graph.moves.some(
    (move) => move.contextId === contextId && move.actor === 'user' && move.included,
  );
}

export function deriveTrainingRows(
  graph: RepertoireGraph,
  now: string,
  existingTrainingItems: ReadonlyMap<string, TrainingItemRecord> = new Map(),
): DerivedTrainingRows {
  validateRepertoireGraph(graph);
  const positions = new Map(graph.positions.map((position) => [position.id, position]));
  const itemContexts = new Map<string, Set<string>>();
  const itemPrototype = new Map<string, TrainingItemRecord>();
  const decisionRules: DecisionRuleRecord[] = [];

  const contexts = [...graph.contexts].sort(
    (a, b) =>
      a.repertoireId.localeCompare(b.repertoireId) ||
      a.pathFingerprint.localeCompare(b.pathFingerprint) ||
      a.id.localeCompare(b.id),
  );
  for (const context of contexts) {
    if (!contextHasUserMove(graph, context.id)) continue;
    const accepted = queryAcceptedMoves(graph, {
      repertoireId: context.repertoireId,
      activeContextIds: [context.id],
      positionId: context.entryPositionId,
      promptMode: 'normal',
    });
    if (accepted.moves.length === 0) continue;
    const position = positions.get(context.entryPositionId);
    if (!position) {
      throw new Error(`Missing decision position ${context.entryPositionId}.`);
    }
    const contextScopeKey = position.key;
    const trainingItemId = trainingItemIdentityKey({
      repertoireId: context.repertoireId,
      contextScopeKey,
      positionKey: position.key,
      acceptedMoveSetKey: accepted.normalizedKey,
      promptMode: 'normal',
    });
    const existing = existingTrainingItems.get(trainingItemId);
    if (!itemPrototype.has(trainingItemId)) {
      itemPrototype.set(trainingItemId, {
        id: trainingItemId,
        repertoireId: context.repertoireId,
        contextScopeKey,
        positionKey: position.key,
        acceptedMoveSetKey: accepted.normalizedKey,
        promptMode: 'normal',
        contextIds: [],
        status: 'active',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }
    const set = itemContexts.get(trainingItemId) ?? new Set<string>();
    set.add(context.id);
    itemContexts.set(trainingItemId, set);
    decisionRules.push({
      id: `decision-rule:${context.id}:normal`,
      repertoireId: context.repertoireId,
      contextId: context.id,
      positionId: context.entryPositionId,
      promptMode: 'normal',
      acceptedMoveSetKey: accepted.normalizedKey,
      acceptedUci: accepted.moves.map((move) => move.uci),
      trainingItemId,
      updatedAt: now,
    });
  }

  const activeItems = [...itemPrototype.values()].map((item) => ({
    ...item,
    contextIds: [...(itemContexts.get(item.id) ?? [])].sort(),
  }));
  const activeIds = new Set(activeItems.map((item) => item.id));
  const superseded = [...existingTrainingItems.values()]
    .filter((item) => !activeIds.has(item.id))
    .map((item) => ({
      ...item,
      status: 'superseded' as const,
      updatedAt: now,
    }));

  return {
    decisionRules,
    trainingItems: [...activeItems, ...superseded].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

export function contextWithInclusion(
  context: RepertoireContext,
  included: boolean,
): RepertoireContext {
  return { ...context, included };
}
