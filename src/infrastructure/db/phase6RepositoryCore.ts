import type { SchedulerPort } from '../../domain/scheduling/schedulerPort';
import type {
  IndependentSchedulerStateRecord,
  RepertoireLifecycleRecord,
  TrainingScope,
} from '../../domain/phase6/types';
import { playlistAllowsContext } from '../../domain/repertoire/graph';
import type {
  Playlist,
  RepertoireContext,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import type {
  PlaylistEntryKind,
  PlaylistEntryRecord,
  SessionRecord,
  TrainingItemRecord,
} from './openingTrainerDatabase';
import { DATABASE_META_ID } from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';
import {
  PHASE6_DATABASE_SCHEMA_VERSION,
  PHASE6_PORTABLE_SCHEMA_VERSION,
  type Phase6OpeningTrainerDatabase,
} from './phase6Database';
import { TsFsrsSchedulerAdapter } from '../scheduling/tsFsrsAdapter';

const TERMINAL_MOVE_STATUSES = new Set(['session-complete', 'abandoned']);

export function nowIso(): string {
  return new Date().toISOString();
}

export function randomId(prefix: string): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now().toString(36)}`
  );
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function unique<T>(rows: readonly T[]): T[] {
  return [...new Set(rows)];
}

export function contextPath(
  contextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
): RepertoireContext[] {
  const result: RepertoireContext[] = [];
  const seen = new Set<string>();
  let current = contexts.get(contextId);
  while (current) {
    if (seen.has(current.id)) throw new Error(`Context cycle at ${current.id}.`);
    seen.add(current.id);
    result.push(current);
    current = current.parentContextId
      ? contexts.get(current.parentContextId)
      : undefined;
  }
  return result.reverse();
}

export function breadcrumb(graph: RepertoireGraph, contextId: string): string {
  const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
  const edges = new Map(graph.edges.map((row) => [row.id, row]));
  const incoming = new Map(
    graph.moves.map((move) => [move.destinationContextId, move]),
  );
  return contextPath(contextId, contexts)
    .map((context, index) => {
      const move = incoming.get(context.id);
      return move
        ? (edges.get(move.edgeId)?.san ?? context.label ?? `Ply ${index}`)
        : (context.label ?? 'Start');
    })
    .join(' / ');
}

export function playlistEntries(playlist: Playlist): PlaylistEntryRecord[] {
  const values: Array<{ kind: PlaylistEntryKind; value: string }> = [
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
  return values.map((entry, order) => ({
    id: `playlist-entry:${playlist.id}:${entry.kind}:${String(order).padStart(4, '0')}`,
    playlistId: playlist.id,
    kind: entry.kind,
    value: entry.value,
    order,
  }));
}

export function schedulerRecord(
  scheduler: SchedulerPort,
  itemId: string,
  policyVersion: string,
  now: string,
): IndependentSchedulerStateRecord {
  return {
    id: itemId,
    itemId,
    state: scheduler.createNew(new Date(now)),
    adapterVersion: scheduler.adapterVersion,
    parametersVersion: scheduler.parametersVersion,
    mappingPolicyVersion: policyVersion,
    createdAt: now,
    updatedAt: now,
  };
}

export function validConfusionPair(
  graph: RepertoireGraph,
  source: TrainingItemRecord,
  expectedContextId: string,
  confusedContextId: string,
): boolean {
  const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
  const edges = new Map(graph.edges.map((row) => [row.id, row]));
  const expected = contexts.get(expectedContextId);
  const confused = contexts.get(confusedContextId);
  if (
    !expected ||
    !confused ||
    expected.repertoireId !== source.repertoireId ||
    confused.repertoireId !== source.repertoireId ||
    !source.contextIds.includes(expectedContextId)
  ) {
    return false;
  }
  const acceptedUci = new Set(
    source.acceptedMoveSetKey.split('|').filter(Boolean),
  );
  return graph.moves.some((move) => {
    if (move.actor !== 'user' || move.destinationContextId !== confusedContextId) {
      return false;
    }
    const candidateContext = contexts.get(move.contextId);
    const edge = edges.get(move.edgeId);
    return Boolean(
      candidateContext &&
        edge &&
        candidateContext.repertoireId === source.repertoireId &&
        candidateContext.entryPositionId === expected.entryPositionId &&
        !acceptedUci.has(edge.uci),
    );
  });
}

type RecallKind = 'move' | 'name' | 'contrast';

export class Phase6RepositoryCore {
  public readonly database: Phase6OpeningTrainerDatabase;
  protected readonly base: OpeningTrainerRepository;
  protected readonly scheduler: SchedulerPort;
  private operationQueue: Promise<void> = Promise.resolve();
  protected restoreRequested = false;

  public constructor(
    database: Phase6OpeningTrainerDatabase,
    scheduler: SchedulerPort = new TsFsrsSchedulerAdapter(),
  ) {
    this.database = database;
    this.scheduler = scheduler;
    this.base = new OpeningTrainerRepository(database, scheduler);
  }

  protected enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  protected assertWritable(): void {
    if (this.restoreRequested) {
      throw new Error(
        'RESTORE_IN_PROGRESS: local writes are temporarily blocked.',
      );
    }
  }

  public async awaitPendingOperations(): Promise<void> {
    await this.operationQueue;
    await this.base.awaitPendingOperations();
  }

  public async initialize(now = nowIso()): Promise<void> {
    await this.base.initialize(now);
    const meta = await this.database.meta.get(DATABASE_META_ID);
    if (!meta) throw new Error('Opening Trainer database metadata is missing.');
    if (
      meta.databaseSchemaVersion !== PHASE6_DATABASE_SCHEMA_VERSION ||
      meta.portableSchemaVersion !== PHASE6_PORTABLE_SCHEMA_VERSION
    ) {
      await this.database.meta.put({
        ...meta,
        databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
        portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
        updatedAt: now,
      });
    }
    await this.enqueue(async () => {
      await this.materializeLifecycle(now);
    });
  }

  public close(): void {
    this.base.close();
  }

  public async deleteDatabase(): Promise<void> {
    await this.awaitPendingOperations();
    this.database.close();
    await this.database.delete();
  }

  public getSetting<T = unknown>(id: string): Promise<T | undefined> {
    return this.base.getSetting<T>(id);
  }

  public putSetting(id: string, value: unknown, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(() => this.base.putSetting(id, value, now));
  }

  protected async materializeLifecycle(now: string): Promise<void> {
    const [repertoires, playlists, repertoireStates, playlistStates] =
      await Promise.all([
        this.database.repertoires.toArray(),
        this.database.playlists.toArray(),
        this.database.repertoireStates.toArray(),
        this.database.playlistStates.toArray(),
      ]);
    const repertoireStateById = new Map(
      repertoireStates.map((row) => [row.id, row]),
    );
    const playlistStateById = new Map(
      playlistStates.map((row) => [row.id, row]),
    );
    const changedRepertoireStates: RepertoireLifecycleRecord[] = [];
    const normalizedRepertoires: typeof repertoires = [];

    for (const row of repertoires) {
      const existingState = repertoireStateById.get(row.id);
      const archivedAt = existingState?.archivedAt ?? row.archivedAt;
      if (!existingState || (!existingState.archivedAt && row.archivedAt)) {
        changedRepertoireStates.push({
          id: row.id,
          ...(archivedAt ? { archivedAt } : {}),
          updatedAt: now,
        });
      }
      if (row.archivedAt) {
        normalizedRepertoires.push({
          ...row,
          archivedAt: undefined,
          updatedAt: now,
        });
      }
    }

    const missingPlaylists = playlists
      .filter((row) => !playlistStateById.has(row.id))
      .map((row) => ({ id: row.id, updatedAt: now }));

    await this.database.transaction(
      'rw',
      [
        this.database.repertoires,
        this.database.repertoireStates,
        this.database.playlistStates,
      ],
      async () => {
        if (changedRepertoireStates.length > 0) {
          await this.database.repertoireStates.bulkPut(changedRepertoireStates);
        }
        if (normalizedRepertoires.length > 0) {
          await this.database.repertoires.bulkPut(normalizedRepertoires);
        }
        if (missingPlaylists.length > 0) {
          await this.database.playlistStates.bulkPut(missingPlaylists);
        }
      },
    );
  }

  protected async repertoireArchived(id: string): Promise<boolean> {
    return Boolean((await this.database.repertoireStates.get(id))?.archivedAt);
  }

  protected async playlistArchived(id: string): Promise<boolean> {
    return Boolean((await this.database.playlistStates.get(id))?.archivedAt);
  }

  protected async scopeRepertoireIds(scope: TrainingScope): Promise<string[]> {
    if (scope.kind === 'repertoire') return [scope.id];
    return [...(await this.getPlaylistUnsafe(scope.id)).repertoireIds];
  }

  protected async scopeAvailableRepertoireIds(
    scope: TrainingScope,
  ): Promise<string[]> {
    if (scope.kind === 'playlist' && (await this.playlistArchived(scope.id))) {
      return [];
    }
    const ids = await this.scopeRepertoireIds(scope);
    const result: string[] = [];
    for (const id of ids) {
      if (
        (await this.database.repertoires.get(id)) &&
        !(await this.repertoireArchived(id))
      ) {
        result.push(id);
      }
    }
    return result;
  }

  private async activeMoveScopes(): Promise<TrainingScope[]> {
    const sessions = (await this.database.sessions.toArray()).filter(
      (row) => !TERMINAL_MOVE_STATUSES.has(row.status),
    );
    const result: TrainingScope[] = [];
    for (const session of sessions) {
      try {
        result.push(await this.getMoveSessionScopeUnsafe(session));
      } catch {
        return [
          { kind: 'playlist', id: '__unknown-active-move-session__' },
        ];
      }
    }
    return result;
  }

  protected async assertNoActiveRecallSession(
    except?: { kind: RecallKind; id: string },
  ): Promise<void> {
    const moveSessions = (await this.database.sessions.toArray()).filter(
      (row) => !TERMINAL_MOVE_STATUSES.has(row.status),
    );
    const nameSessions = await this.database.nameSessions
      .where('status')
      .equals('active')
      .toArray();
    const contrastSessions = await this.database.contrastSessions
      .where('status')
      .equals('active')
      .toArray();
    const conflictingMove = moveSessions.some(
      (row) => !(except?.kind === 'move' && except.id === row.id),
    );
    const conflictingName = nameSessions.some(
      (row) => !(except?.kind === 'name' && except.id === row.id),
    );
    const conflictingContrast = contrastSessions.some(
      (row) => !(except?.kind === 'contrast' && except.id === row.id),
    );
    if (conflictingMove || conflictingName || conflictingContrast) {
      throw new Error(
        'ACTIVE_RECALL_SESSION: finish or abandon the current recall session before starting another.',
      );
    }
  }

  protected async assertMutationUnlocked(
    repertoireIds: readonly string[],
    playlistIds: readonly string[] = [],
  ): Promise<void> {
    const affectedRepertoires = new Set(repertoireIds);
    const affectedPlaylists = new Set(playlistIds);
    const moveScopes = await this.activeMoveScopes();
    const auxScopes = [
      ...(await this.database.nameSessions
        .where('status')
        .equals('active')
        .toArray()).map((row) => row.scope),
      ...(await this.database.contrastSessions
        .where('status')
        .equals('active')
        .toArray()).map((row) => row.scope),
    ];
    for (const scope of [...moveScopes, ...auxScopes]) {
      if (scope.kind === 'repertoire' && affectedRepertoires.has(scope.id)) {
        throw new Error(
          'SESSION_SCOPE_LOCKED: finish or abandon the active recall session before changing this repertoire.',
        );
      }
      if (scope.kind === 'playlist') {
        if (
          affectedPlaylists.has(scope.id) ||
          scope.id === '__unknown-active-move-session__'
        ) {
          throw new Error(
            'SESSION_SCOPE_LOCKED: finish or abandon the active recall session before changing this scope.',
          );
        }
        const memberIds =
          scope.id === '__unknown-active-move-session__'
            ? []
            : (await this.getPlaylistUnsafe(scope.id)).repertoireIds;
        if (memberIds.some((id) => affectedRepertoires.has(id))) {
          throw new Error(
            'SESSION_SCOPE_LOCKED: finish or abandon the active recall session before changing this repertoire.',
          );
        }
      }
    }
  }

  protected async getPlaylistUnsafe(id: string): Promise<Playlist> {
    const graph = await this.base.loadCompleteGraph();
    const playlist = graph.playlists.find((row) => row.id === id);
    if (!playlist) throw new Error(`Missing playlist ${id}.`);
    return playlist;
  }

  protected async scopeGraph(scope: TrainingScope): Promise<{
    graph: RepertoireGraph;
    playlist?: Playlist;
    availableIds: string[];
  }> {
    const graph = await this.base.loadCompleteGraph();
    const availableIds = await this.scopeAvailableRepertoireIds(scope);
    if (scope.kind === 'repertoire') {
      if (!graph.repertoires.some((row) => row.id === scope.id)) {
        throw new Error(`Missing repertoire ${scope.id}.`);
      }
      return { graph, availableIds };
    }
    const playlist = graph.playlists.find((row) => row.id === scope.id);
    if (!playlist) throw new Error(`Missing playlist ${scope.id}.`);
    return { graph, playlist, availableIds };
  }

  protected contextAllowed(
    graph: RepertoireGraph,
    scope: TrainingScope,
    playlist: Playlist | undefined,
    context: RepertoireContext,
  ): boolean {
    if (scope.kind === 'repertoire') return context.repertoireId === scope.id;
    return Boolean(playlist && playlistAllowsContext(graph, playlist, context));
  }

  protected trainingItemAllowedByScope(
    item: TrainingItemRecord,
    scope: TrainingScope,
  ): boolean {
    const playlistIds = item.playlistIds ?? [];
    return scope.kind === 'repertoire'
      ? playlistIds.length === 0
      : playlistIds.length === 0 || playlistIds.includes(scope.id);
  }

  protected async getMoveSessionScopeUnsafe(
    record: SessionRecord,
  ): Promise<TrainingScope> {
    const descriptor =
      record.state.adaptive?.exercises[record.state.adaptive.exerciseIndex];
    if (descriptor?.playlistId) {
      return { kind: 'playlist', id: descriptor.playlistId };
    }
    if (descriptor?.repertoireId) {
      return { kind: 'repertoire', id: descriptor.repertoireId };
    }
    const itemIds =
      record.targetIdentityKind === 'training-item'
        ? record.targetIds
        : record.state.targetTrainingItemIds;
    for (const id of itemIds) {
      const item = await this.database.trainingItems.get(id);
      if (item) return { kind: 'repertoire', id: item.repertoireId };
    }
    throw new Error('Could not resolve the interrupted move session scope.');
  }
}
