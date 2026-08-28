import { createGraphExercisePlan } from '../../domain/repertoire/exercisePlan';
import {
  contextPly,
  playlistAllowsRouteContext,
  queryAcceptedMoves,
  trainingItemIdentityKey,
} from '../../domain/repertoire/graph';
import type {
  ImportCandidate,
  Playlist,
  PromptMode,
  RepertoireContext,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import {
  ADAPTIVE_SESSION_GENERATOR_VERSION,
  generateAdaptiveSessionSelection,
  type AdaptiveSessionRequest,
  type TrainingCandidateSnapshot,
} from '../../domain/scheduling/sessionGenerator';
import type {
  AdaptiveExercisePlan,
  AdaptiveSessionPlan,
} from '../../domain/scheduling/adaptiveSession';
import {
  mapObservationToSchedulerDecision,
  SCHEDULER_MAPPING_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import type { SchedulerPort } from '../../domain/scheduling/schedulerPort';
import type {
  AdaptiveExerciseDescriptor,
  TrainingSessionState,
} from '../../domain/training/session';
import { TsFsrsSchedulerAdapter } from '../scheduling/tsFsrsAdapter';
import {
  commitBackupRestore,
  exportCompleteBackup,
  type BackupPreview,
  type OpeningTrainerBackup,
} from '../import-export/backup';
import {
  DATABASE_META_ID,
  OpeningTrainerDatabase,
  USER_DATA_TABLE_NAMES,
  createDatabaseMeta,
  type ConfusionRelationRecord,
  type DecisionRuleRecord,
  type PlaylistEntryKind,
  type PlaylistEntryRecord,
  type PlaylistRecord,
  type SchedulerDecisionRecord,
  type SchedulerStateRecord,
  type SessionRecord,
  type SettingRecord,
  type TrainingItemRecord,
} from './openingTrainerDatabase';
import {
  canonicalizeGraphForPersistence,
  contextWithInclusion,
  deriveTrainingRows,
  graphForRepertoire,
  graphToStoredRows,
  storedRowsToGraph,
  type StoredGraphRows,
} from './graphStorage';

const SESSION_POLICY_VERSION = 'phase5-adaptive-session-v1';
const TERMINAL_SESSION_STATUSES = new Set(['session-complete', 'abandoned']);
const FAILURE_OUTCOMES = new Set([
  'wrong-variation',
  'outside-repertoire',
  'revealed',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function playlistEntries(playlist: Playlist): PlaylistEntryRecord[] {
  const entries: Array<{ kind: PlaylistEntryKind; value: string }> = [
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
  return entries.map((entry, order) => ({
    id: `playlist-entry:${playlist.id}:${entry.kind}:${String(order).padStart(4, '0')}`,
    playlistId: playlist.id,
    kind: entry.kind,
    value: entry.value,
    order,
  }));
}

function contextPath(
  contextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
): readonly string[] {
  const reversed: string[] = [];
  const seen = new Set<string>();
  let current = contexts.get(contextId);
  while (current) {
    if (seen.has(current.id)) throw new Error(`Context cycle at ${current.id}.`);
    seen.add(current.id);
    reversed.push(current.id);
    current = current.parentContextId
      ? contexts.get(current.parentContextId)
      : undefined;
  }
  return reversed.reverse();
}

function prefixKeyForContext(
  contextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
): string {
  const path = contextPath(contextId, contexts);
  return path.slice(0, Math.min(3, path.length)).join('>');
}

function chooseContextId(
  contextIds: readonly string[],
  contexts: ReadonlyMap<string, RepertoireContext>,
  seed: string,
): string {
  const candidates = contextIds.filter((id) => contexts.has(id));
  if (candidates.length === 0) throw new Error('Training item has no available context.');
  return [...candidates].sort(
    (left, right) =>
      stableHash(`${seed}:${left}`) - stableHash(`${seed}:${right}`) ||
      left.localeCompare(right),
  )[0]!;
}

export class OpeningTrainerRepository {
  public readonly database: OpeningTrainerDatabase;
  readonly #scheduler: SchedulerPort;

  private operationQueue: Promise<void> = Promise.resolve();
  private sessionWritesBlocked = false;

  public constructor(
    database: OpeningTrainerDatabase,
    scheduler: SchedulerPort = new TsFsrsSchedulerAdapter(),
  ) {
    this.database = database;
    this.#scheduler = scheduler;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  public async awaitPendingOperations(): Promise<void> {
    await this.operationQueue;
  }

  private schedulerRecord(
    trainingItemId: string,
    now: string,
  ): SchedulerStateRecord {
    return {
      id: trainingItemId,
      trainingItemId,
      state: this.#scheduler.createNew(new Date(now)),
      adapterVersion: this.#scheduler.adapterVersion,
      parametersVersion: this.#scheduler.parametersVersion,
      mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async ensureSchedulerStates(now: string): Promise<void> {
    const items = await this.database.trainingItems
      .where('status')
      .equals('active')
      .toArray();
    const missing: SchedulerStateRecord[] = [];
    for (const item of items) {
      if (!(await this.database.schedulerStates.get(item.id))) {
        missing.push(this.schedulerRecord(item.id, now));
      }
    }
    if (missing.length > 0) await this.database.schedulerStates.bulkPut(missing);
  }

  public async initialize(now = nowIso()): Promise<void> {
    await this.database.open();
    const meta = await this.database.meta.get(DATABASE_META_ID);
    if (!meta) {
      await this.database.meta.add(createDatabaseMeta(now));
      return;
    }
    if (
      meta.databaseSchemaVersion !== this.database.verno ||
      meta.portableSchemaVersion < 2
    ) {
      throw new Error('Opening Trainer local database metadata is inconsistent.');
    }
    await this.ensureSchedulerStates(meta.schedulerCutoverAt ?? now);
  }

  public close(): void {
    this.database.close();
  }

  public async deleteDatabase(): Promise<void> {
    await this.awaitPendingOperations();
    this.database.close();
    await this.database.delete();
  }

  private async storedGraphRows(): Promise<StoredGraphRows> {
    const [
      repertoires,
      repertoireContexts,
      positions,
      moveEdges,
      repertoireMoves,
      playlists,
      playlistEntries,
    ] = await Promise.all([
      this.database.repertoires.toArray(),
      this.database.repertoireContexts.toArray(),
      this.database.positions.toArray(),
      this.database.moveEdges.toArray(),
      this.database.repertoireMoves.toArray(),
      this.database.playlists.toArray(),
      this.database.playlistEntries.toArray(),
    ]);
    return {
      repertoires,
      repertoireContexts,
      positions,
      moveEdges,
      repertoireMoves,
      playlists,
      playlistEntries,
    };
  }

  public async loadCompleteGraph(): Promise<RepertoireGraph> {
    const rows = await this.storedGraphRows();
    if (rows.repertoires.length === 0) {
      return {
        repertoires: [],
        contexts: [],
        positions: [],
        edges: [],
        moves: [],
        playlists: [],
      };
    }
    return storedRowsToGraph(rows);
  }

  public async listRepertoireGraphs(): Promise<RepertoireGraph[]> {
    const graph = await this.loadCompleteGraph();
    return graph.repertoires
      .filter((repertoire) => !repertoire.archivedAt)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map((repertoire) => graphForRepertoire(graph, repertoire.id));
  }

  public async loadRepertoireGraph(repertoireId: string): Promise<RepertoireGraph> {
    return graphForRepertoire(await this.loadCompleteGraph(), repertoireId);
  }

  public async countSavedRepertoires(): Promise<number> {
    return this.database.repertoires.filter((row) => !row.archivedAt).count();
  }

  private async ensurePromptModeTrainingItems(
    repertoireId: string,
    promptMode: PromptMode,
    now: string,
    playlistId?: string,
  ): Promise<ReadonlySet<string> | undefined> {
    if (promptMode === 'normal' && !playlistId) return undefined;
    const graph = await this.loadRepertoireGraph(repertoireId);
    const playlist = playlistId
      ? graph.playlists.find((candidate) => candidate.id === playlistId)
      : undefined;
    if (playlistId && !playlist) {
      throw new Error(`Missing playlist ${playlistId}.`);
    }
    const positions = new Map(graph.positions.map((position) => [position.id, position]));
    const existingRows = await this.database.trainingItems
      .where('repertoireId')
      .equals(repertoireId)
      .toArray();
    const existing = new Map(existingRows.map((item) => [item.id, item]));
    const itemContexts = new Map<string, Set<string>>();
    const itemPrototype = new Map<string, TrainingItemRecord>();
    const decisionRules: DecisionRuleRecord[] = [];

    for (const context of [...graph.contexts].sort(
      (left, right) =>
        left.pathFingerprint.localeCompare(right.pathFingerprint) ||
        left.id.localeCompare(right.id),
    )) {
      const hasUserMove = graph.moves.some(
        (move) =>
          move.contextId === context.id && move.actor === 'user' && move.included,
      );
      if (!hasUserMove) continue;
      if (playlist && !playlistAllowsRouteContext(graph, playlist, context)) continue;
      const accepted = queryAcceptedMoves(graph, {
        repertoireId,
        activeContextIds: [context.id],
        ...(playlistId ? { playlistId } : {}),
        positionId: context.entryPositionId,
        promptMode,
        ...(promptMode === 'strict'
          ? { strictPathFingerprint: context.pathFingerprint }
          : {}),
      });
      if (accepted.moves.length === 0) continue;
      const position = positions.get(context.entryPositionId);
      if (!position) {
        throw new Error(`Missing decision position ${context.entryPositionId}.`);
      }
      const contextScopeKey = promptMode === 'strict' ? context.id : position.key;
      const trainingItemId = trainingItemIdentityKey({
        repertoireId,
        contextScopeKey,
        positionKey: position.key,
        acceptedMoveSetKey: accepted.normalizedKey,
        promptMode,
        ...(promptMode === 'strict'
          ? { strictPathFingerprint: context.pathFingerprint }
          : {}),
      });
      const prior = existing.get(trainingItemId);
      const reuseUnscopedItem = Boolean(
        playlistId && prior && (!prior.playlistIds || prior.playlistIds.length === 0),
      );
      const scopedPlaylists = !playlistId || reuseUnscopedItem
        ? undefined
        : [...new Set([...(prior?.playlistIds ?? []), playlistId])].sort();
      if (!itemPrototype.has(trainingItemId)) {
        itemPrototype.set(trainingItemId, reuseUnscopedItem && prior
          ? {
              ...prior,
              status: 'active',
              updatedAt: now,
            }
          : {
              id: trainingItemId,
              repertoireId,
              contextScopeKey,
              positionKey: position.key,
              acceptedMoveSetKey: accepted.normalizedKey,
              promptMode,
              contextIds: [],
              ...(scopedPlaylists && scopedPlaylists.length > 0
                ? { playlistIds: scopedPlaylists }
                : {}),
              status: 'active',
              createdAt: prior?.createdAt ?? now,
              updatedAt: now,
            });
      }
      const contextSet = itemContexts.get(trainingItemId) ?? new Set<string>(
        playlistId && prior ? prior.contextIds : [],
      );
      contextSet.add(context.id);
      itemContexts.set(trainingItemId, contextSet);
      decisionRules.push({
        id: `decision-rule:${context.id}:${promptMode}:${playlistId ?? 'all'}`,
        repertoireId,
        contextId: context.id,
        positionId: context.entryPositionId,
        promptMode,
        acceptedMoveSetKey: accepted.normalizedKey,
        acceptedUci: accepted.moves.map((move) => move.uci),
        trainingItemId,
        ...(playlistId ? { playlistId } : {}),
        updatedAt: now,
      });
    }

    const activeItems = [...itemPrototype.values()].map((item) => ({
      ...item,
      contextIds: [...(itemContexts.get(item.id) ?? [])].sort(),
    }));
    const activeIds = new Set(activeItems.map((item) => item.id));
    const unscopedSuperseded = !playlistId
      ? existingRows
          .filter(
            (item) =>
              item.promptMode === promptMode &&
              (!item.playlistIds || item.playlistIds.length === 0) &&
              !activeIds.has(item.id),
          )
          .map((item) => ({
            ...item,
            status: 'superseded' as const,
            updatedAt: now,
          }))
      : [];
    const scopedObsolete = playlistId
      ? existingRows
          .filter(
            (item) =>
              item.promptMode === promptMode &&
              item.playlistIds?.includes(playlistId) &&
              !activeIds.has(item.id),
          )
          .map((item) => {
            const remainingPlaylists = (item.playlistIds ?? []).filter(
              (candidatePlaylistId) => candidatePlaylistId !== playlistId,
            );
            return {
              ...item,
              ...(remainingPlaylists.length > 0
                ? { playlistIds: remainingPlaylists, status: 'active' as const }
                : { playlistIds: [], status: 'superseded' as const }),
              updatedAt: now,
            };
          })
      : [];

    await this.database.transaction(
      'rw',
      [
        this.database.decisionRules,
        this.database.trainingItems,
        this.database.schedulerStates,
        this.database.meta,
      ],
      async () => {
        const oldRules = (
          await this.database.decisionRules
            .where('repertoireId')
            .equals(repertoireId)
            .toArray()
        ).filter(
          (rule) =>
            rule.promptMode === promptMode &&
            (rule.playlistId ?? undefined) === (playlistId ?? undefined),
        );
        if (oldRules.length > 0) {
          await this.database.decisionRules.bulkDelete(
            oldRules.map((rule) => rule.id),
          );
        }
        if (decisionRules.length > 0) {
          await this.database.decisionRules.bulkPut(decisionRules);
        }
        if (
          activeItems.length > 0 ||
          unscopedSuperseded.length > 0 ||
          scopedObsolete.length > 0
        ) {
          await this.database.trainingItems.bulkPut([
            ...activeItems,
            ...unscopedSuperseded,
            ...scopedObsolete,
          ]);
        }
        for (const item of activeItems) {
          if (!(await this.database.schedulerStates.get(item.id))) {
            await this.database.schedulerStates.put(
              this.schedulerRecord(item.id, now),
            );
          }
        }
        const meta = await this.database.meta.get(DATABASE_META_ID);
        if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
      },
    );
    return activeIds;
  }

  public async exportCompleteBackup(
    exportedAt = nowIso(),
  ): Promise<{ backup: OpeningTrainerBackup; json: string }> {
    return this.enqueue(() => exportCompleteBackup(this.database, exportedAt));
  }

  public restoreCompleteBackup(
    preview: BackupPreview,
    restoredAt = nowIso(),
  ): Promise<void> {
    this.sessionWritesBlocked = true;
    return this.enqueue(async () => {
      try {
        await commitBackupRestore(this.database, preview, { restoredAt });
        await this.ensureSchedulerStates(restoredAt);
      } finally {
        this.sessionWritesBlocked = false;
      }
    });
  }

  public async createRepertoire(
    candidate: ImportCandidate,
    now = nowIso(),
  ): Promise<RepertoireGraph> {
    return this.enqueue(async () => {
      if (
        candidate.errors.length > 0 ||
        candidate.proposedGraph.repertoires.length !== 1
      ) {
        throw new Error('Only a valid import preview can be committed.');
      }
      const canonical = canonicalizeGraphForPersistence(candidate.proposedGraph, now);
      const repertoire = canonical.repertoires[0]!;
      const rows = graphToStoredRows(canonical);
      const training = deriveTrainingRows(canonical, now);

      await this.database.transaction(
        'rw',
        [
          this.database.repertoires,
          this.database.repertoireContexts,
          this.database.positions,
          this.database.moveEdges,
          this.database.repertoireMoves,
          this.database.decisionRules,
          this.database.playlists,
          this.database.playlistEntries,
          this.database.trainingItems,
          this.database.schedulerStates,
          this.database.imports,
          this.database.meta,
        ],
        async () => {
          if (await this.database.repertoires.get(repertoire.id)) {
            throw new Error(`Repertoire already exists: ${repertoire.id}`);
          }
          await this.database.positions.bulkPut(rows.positions);
          await this.database.moveEdges.bulkPut(rows.moveEdges);
          await this.database.repertoires.add(repertoire);
          await this.database.repertoireContexts.bulkAdd(rows.repertoireContexts);
          await this.database.repertoireMoves.bulkAdd(rows.repertoireMoves);
          if (rows.playlists.length > 0) {
            await this.database.playlists.bulkAdd(rows.playlists);
            await this.database.playlistEntries.bulkAdd(rows.playlistEntries);
          }
          if (training.decisionRules.length > 0) {
            await this.database.decisionRules.bulkAdd(training.decisionRules);
          }
          if (training.trainingItems.length > 0) {
            await this.database.trainingItems.bulkAdd(training.trainingItems);
            await this.database.schedulerStates.bulkAdd(
              training.trainingItems
                .filter((item) => item.status === 'active')
                .map((item) => this.schedulerRecord(item.id, now)),
            );
          }
          await this.database.imports.add({
            id: `import:${repertoire.id}:${now}`,
            repertoireId: repertoire.id,
            source: structuredClone(candidate.source),
            summary: structuredClone(candidate.summary),
            warnings: structuredClone(candidate.warnings),
            importedAt: now,
          });
          const meta = await this.database.meta.get(DATABASE_META_ID);
          if (meta) {
            await this.database.meta.put({ ...meta, updatedAt: now });
          }
        },
      );
      return canonical;
    });
  }

  public async updateBranchInclusion(
    contextId: string,
    included: boolean,
    now = nowIso(),
  ): Promise<void> {
    return this.enqueue(async () => {
      await this.database.transaction(
        'rw',
        [
          this.database.repertoireContexts,
          this.database.repertoires,
          this.database.positions,
          this.database.moveEdges,
          this.database.repertoireMoves,
          this.database.playlists,
          this.database.playlistEntries,
          this.database.decisionRules,
          this.database.trainingItems,
          this.database.schedulerStates,
          this.database.meta,
        ],
        async () => {
          const context = await this.database.repertoireContexts.get(contextId);
          if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
          await this.database.repertoireContexts.put(
            contextWithInclusion(context, included),
          );
          const graph = await this.loadCompleteGraph();
          const repertoireGraph = graphForRepertoire(graph, context.repertoireId);
          const existing = new Map(
            (
              await this.database.trainingItems
                .where('repertoireId')
                .equals(context.repertoireId)
                .toArray()
            ).map((item) => [item.id, item]),
          );
          const derived = deriveTrainingRows(repertoireGraph, now, existing);
          await this.database.decisionRules
            .where('repertoireId')
            .equals(context.repertoireId)
            .delete();
          if (derived.decisionRules.length > 0) {
            await this.database.decisionRules.bulkPut(derived.decisionRules);
          }
          if (derived.trainingItems.length > 0) {
            await this.database.trainingItems.bulkPut(derived.trainingItems);
          }
          for (const item of derived.trainingItems.filter(
            (candidateItem) => candidateItem.status === 'active',
          )) {
            if (!(await this.database.schedulerStates.get(item.id))) {
              await this.database.schedulerStates.put(
                this.schedulerRecord(item.id, now),
              );
            }
          }
          const meta = await this.database.meta.get(DATABASE_META_ID);
          if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
        },
      );
    });
  }

  public async savePlaylist(playlist: Playlist, now = nowIso()): Promise<void> {
    return this.enqueue(async () => {
      await this.database.transaction(
        'rw',
        [
          this.database.repertoires,
          this.database.repertoireContexts,
          this.database.playlists,
          this.database.playlistEntries,
          this.database.meta,
        ],
        async () => {
          if (
            playlist.maxPly !== undefined &&
            (!Number.isInteger(playlist.maxPly) || playlist.maxPly < 0)
          ) {
            throw new Error(`Invalid playlist maxPly: ${playlist.id}`);
          }
          if (new Set(playlist.repertoireIds).size !== playlist.repertoireIds.length) {
            throw new Error(`Duplicate playlist repertoire: ${playlist.id}`);
          }
          const repertoireIds = new Set(playlist.repertoireIds);
          for (const repertoireId of repertoireIds) {
            const repertoire = await this.database.repertoires.get(repertoireId);
            if (!repertoire) {
              throw new Error(`Playlist references missing repertoire: ${playlist.id}`);
            }
            if (repertoire.archivedAt) {
              throw new Error(
                `Playlist references archived repertoire: ${playlist.id}`,
              );
            }
          }
          for (const contextId of [
            ...playlist.includedContextIds,
            ...playlist.excludedContextIds,
          ]) {
            const context = await this.database.repertoireContexts.get(contextId);
            if (!context) {
              throw new Error(`Playlist references missing context: ${playlist.id}`);
            }
            if (!repertoireIds.has(context.repertoireId)) {
              throw new Error(
                `Playlist context is outside its repertoire set: ${playlist.id}`,
              );
            }
          }

          const existing = await this.database.playlists.get(playlist.id);
          const record: PlaylistRecord = {
            id: playlist.id,
            name: playlist.name,
            ...(playlist.colour ? { colour: playlist.colour } : {}),
            ...(playlist.maxPly !== undefined ? { maxPly: playlist.maxPly } : {}),
            weighting: structuredClone(playlist.weighting),
            createdAt: existing?.createdAt ?? (playlist.createdAt || now),
            updatedAt: now,
          };
          const entries = playlistEntries(playlist);
          await this.database.playlists.put(record);
          await this.database.playlistEntries
            .where('playlistId')
            .equals(playlist.id)
            .delete();
          if (entries.length > 0) {
            await this.database.playlistEntries.bulkPut(entries);
          }
          const meta = await this.database.meta.get(DATABASE_META_ID);
          if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
        },
      );
    });
  }

  private async candidateSnapshots(
    repertoireId: string,
    now: Date,
    seed: string,
    options: {
      playlistId?: string;
      eligibleItemIds?: ReadonlySet<string>;
    } = {},
  ): Promise<TrainingCandidateSnapshot[]> {
    const [graph, items, states, reviews, confusions] = await Promise.all([
      this.loadRepertoireGraph(repertoireId),
      this.database.trainingItems
        .where('[repertoireId+status]')
        .equals([repertoireId, 'active'])
        .toArray(),
      this.database.schedulerStates.toArray(),
      this.database.reviewLogs.toArray(),
      this.database.confusionRelations.toArray(),
    ]);
    const stateByItem = new Map(states.map((record) => [record.trainingItemId, record]));
    const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
    const playlist = options.playlistId
      ? graph.playlists.find((candidate) => candidate.id === options.playlistId)
      : undefined;
    if (options.playlistId && !playlist) {
      throw new Error(`Missing playlist ${options.playlistId}.`);
    }
    const reviewsByItem = new Map<string, typeof reviews>();
    for (const review of reviews) {
      const list = reviewsByItem.get(review.trainingItemId) ?? [];
      list.push(review);
      reviewsByItem.set(review.trainingItemId, list);
    }
    const confusionByItem = new Map<string, typeof confusions>();
    for (const confusion of confusions) {
      const list = confusionByItem.get(confusion.expectedTrainingItemId) ?? [];
      list.push(confusion);
      confusionByItem.set(confusion.expectedTrainingItemId, list);
    }

    return items.flatMap((item) => {
      if (
        options.eligibleItemIds
          ? !options.eligibleItemIds.has(item.id)
          : item.playlistIds && item.playlistIds.length > 0
      ) {
        return [];
      }
      const allowedContextIds = item.contextIds.filter((contextId) => {
        const context = contexts.get(contextId);
        return Boolean(
          context && (!playlist || playlistAllowsRouteContext(graph, playlist, context)),
        );
      });
      if (allowedContextIds.length === 0) return [];
      const record =
        stateByItem.get(item.id) ??
        this.schedulerRecord(item.id, now.toISOString());
      const contextId = chooseContextId(allowedContextIds, contexts, seed);
      const relatedItemIds =
        item.promptMode === 'contrast'
          ? items
              .filter(
                (candidate) =>
                  candidate.promptMode === 'normal' &&
                  candidate.positionKey === item.positionKey &&
                  candidate.acceptedMoveSetKey === item.acceptedMoveSetKey,
              )
              .map((candidate) => candidate.id)
          : [item.id];
      const itemReviews = relatedItemIds.flatMap(
        (trainingItemId) => reviewsByItem.get(trainingItemId) ?? [],
      );
      const targeted = itemReviews
        .filter((review) => review.evidenceRole === 'targeted')
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const failures = targeted.filter((review) => FAILURE_OUTCOMES.has(review.outcome));
      const itemConfusions = relatedItemIds.flatMap(
        (trainingItemId) => confusionByItem.get(trainingItemId) ?? [],
      );
      const lastConfusionAt = itemConfusions
        .map((row) => row.lastObservedAt)
        .sort()
        .at(-1);
      return [{
        trainingItemId: item.id,
        contextIds: allowedContextIds,
        promptMode: item.promptMode,
        schedulerState: record.state,
        retrievability: this.#scheduler.retrievability(record.state, now),
        depth: contextPly(contexts.get(contextId)!, contexts),
        prefixKey: prefixKeyForContext(contextId, contexts),
        ...(failures[0] ? { recentFailureAt: failures[0].observedAt } : {}),
        ...(targeted[0] ? { lastTargetedAt: targeted[0].observedAt } : {}),
        confusionCount: itemConfusions.reduce((total, row) => total + row.count, 0),
        ...(lastConfusionAt ? { lastConfusionAt } : {}),
      }];
    });
  }

  public async getTrainingQueueSummary(
    repertoireId: string,
    now = new Date(),
  ): Promise<{ due: number; new: number; contrast: number }> {
    await this.awaitPendingOperations();
    const candidates = await this.candidateSnapshots(repertoireId, now, 'summary');
    const normalCandidates = candidates.filter(
      (candidate) => candidate.promptMode === 'normal',
    );
    const normal = generateAdaptiveSessionSelection(normalCandidates, {
      repertoireId,
      mode: 'normal',
      targetCount: Math.max(1, normalCandidates.length),
      newItemLimit: normalCandidates.length,
      now,
      seed: 'summary',
      allowReinforcement: false,
    });
    const contrast = generateAdaptiveSessionSelection(normalCandidates, {
      repertoireId,
      mode: 'contrast',
      targetCount: Math.max(1, normalCandidates.length),
      newItemLimit: 0,
      now,
      seed: 'summary-contrast',
      allowReinforcement: false,
    });
    return {
      due: normal.available.due,
      new: normal.available.new,
      contrast: contrast.available.contrast,
    };
  }

  private adaptiveExercise(
    graph: RepertoireGraph,
    descriptor: AdaptiveExerciseDescriptor,
    targetTrainingItemIds: readonly string[],
  ): AdaptiveExercisePlan {
    return {
      descriptor,
      targetTrainingItemIds,
      plan: createGraphExercisePlan(graph, {
        repertoireId: descriptor.repertoireId,
        rootContextId: descriptor.rootContextId,
        targetContextId: descriptor.targetContextId,
        targetContextIds: descriptor.targetContextIds,
        promptMode: descriptor.promptMode,
        ...(descriptor.playlistId ? { playlistId: descriptor.playlistId } : {}),
      }),
    };
  }

  public async rebuildAdaptiveExercise(
    descriptor: AdaptiveExerciseDescriptor,
  ): Promise<AdaptiveExercisePlan> {
    await this.awaitPendingOperations();
    const graph = await this.loadRepertoireGraph(descriptor.repertoireId);
    const trainingItemIds: string[] = [];
    for (const contextId of descriptor.targetContextIds) {
      const rules = await this.database.decisionRules
        .where('contextId')
        .equals(contextId)
        .toArray();
      const rule = rules.find(
        (candidate) =>
          candidate.promptMode === descriptor.promptMode &&
          (candidate.playlistId ?? undefined) ===
            (descriptor.playlistId ?? undefined),
      );
      if (rule && !trainingItemIds.includes(rule.trainingItemId)) {
        trainingItemIds.push(rule.trainingItemId);
      }
    }
    return this.adaptiveExercise(graph, descriptor, trainingItemIds);
  }

  private async buildAdaptiveSessionPlan(
    repertoireId: string,
    options: {
      targetCount?: number;
      newItemLimit?: number;
      playlistId?: string;
      mode?: AdaptiveSessionRequest['mode'];
      now?: Date;
      seed?: string;
      allowReinforcement?: boolean;
    } = {},
  ): Promise<AdaptiveSessionPlan> {
    const now = options.now ?? new Date();
    const seed = options.seed ?? `adaptive-${now.toISOString()}`;
    const targetCount = options.targetCount ?? 8;
    const newItemLimit = options.newItemLimit ?? 3;
    const mode = options.mode ?? 'normal';
    const eligibleItemIds = await this.ensurePromptModeTrainingItems(
      repertoireId,
      mode,
      now.toISOString(),
      options.playlistId,
    );
    const graph = await this.loadRepertoireGraph(repertoireId);
    const candidates = (
      await this.candidateSnapshots(repertoireId, now, seed, {
        ...(options.playlistId ? { playlistId: options.playlistId } : {}),
        ...(eligibleItemIds ? { eligibleItemIds } : {}),
      })
    ).filter((candidate) => candidate.promptMode === mode);
    const selection = generateAdaptiveSessionSelection(candidates, {
      repertoireId,
      ...(options.playlistId ? { playlistId: options.playlistId } : {}),
      mode,
      targetCount,
      newItemLimit,
      now,
      seed,
      ...(options.allowReinforcement
        ? { allowReinforcement: options.allowReinforcement }
        : {}),
    });
    if (selection.selected.length === 0) {
      return {
        generatorVersion: ADAPTIVE_SESSION_GENERATOR_VERSION,
        seed,
        requestedTargetCount: targetCount,
        newItemLimit,
        exercises: [],
      };
    }

    const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
    const repertoire = graph.repertoires[0];
    if (!repertoire) throw new Error(`Missing repertoire ${repertoireId}.`);
    const remaining = selection.selected.map((candidate) => ({
      candidate,
      contextId: chooseContextId(candidate.contextIds, contexts, seed),
    }));
    const exercises: AdaptiveExercisePlan[] = [];

    while (remaining.length > 0) {
      const anchor = remaining[0]!;
      const anchorPath = contextPath(anchor.contextId, contexts);
      const rootContextId = anchorPath[0];
      if (!rootContextId || !repertoire.rootContextIds.includes(rootContextId)) {
        throw new Error('Adaptive target does not resolve to a repertoire root.');
      }
      const chainCandidates = remaining.filter((row) => {
        const path = contextPath(row.contextId, contexts);
        return (
          path[0] === rootContextId &&
          (path.includes(anchor.contextId) || anchorPath.includes(row.contextId))
        );
      });
      const endpoint = [...chainCandidates].sort(
        (left, right) =>
          contextPath(right.contextId, contexts).length -
            contextPath(left.contextId, contexts).length ||
          left.contextId.localeCompare(right.contextId),
      )[0] ?? anchor;
      const routePath = new Set(contextPath(endpoint.contextId, contexts));
      const batched = remaining
        .filter(
          (row) =>
            routePath.has(row.contextId) &&
            contextPath(row.contextId, contexts)[0] === rootContextId,
        )
        .slice(0, 3);
      const descriptor: AdaptiveExerciseDescriptor = {
        repertoireId,
        rootContextId,
        targetContextId: endpoint.contextId,
        targetContextIds: batched.map((row) => row.contextId),
        promptMode: mode,
        ...(options.playlistId ? { playlistId: options.playlistId } : {}),
      };
      exercises.push(
        this.adaptiveExercise(
          graph,
          descriptor,
          batched.map((row) => row.candidate.trainingItemId),
        ),
      );
      const covered = new Set(batched.map((row) => row.candidate.trainingItemId));
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (covered.has(remaining[index]!.candidate.trainingItemId)) {
          remaining.splice(index, 1);
        }
      }
    }

    return {
      generatorVersion: selection.generatorVersion,
      seed,
      requestedTargetCount: targetCount,
      newItemLimit,
      exercises,
    };
  }

  public createAdaptiveSessionPlan(
    repertoireId: string,
    options: {
      targetCount?: number;
      newItemLimit?: number;
      playlistId?: string;
      mode?: AdaptiveSessionRequest['mode'];
      now?: Date;
      seed?: string;
      allowReinforcement?: boolean;
    } = {},
  ): Promise<AdaptiveSessionPlan> {
    return this.enqueue(() => this.buildAdaptiveSessionPlan(repertoireId, options));
  }

  public async saveSession(state: TrainingSessionState, now = nowIso()): Promise<void> {
    if (this.sessionWritesBlocked) return;
    return this.enqueue(async () => {
      if (this.sessionWritesBlocked) return;
      await this.database.transaction(
        'rw',
        [
          this.database.sessions,
          this.database.reviewLogs,
          this.database.trainingItems,
          this.database.schedulerStates,
          this.database.schedulerDecisions,
          this.database.confusionRelations,
          this.database.meta,
        ],
        async () => {
          for (const observation of state.evidence) {
            const trainingItem = await this.database.trainingItems.get(
              observation.trainingItemId,
            );
            if (!trainingItem) {
              throw new Error(
                `Review observation references missing training item ${observation.trainingItemId}.`,
              );
            }
            const existing = await this.database.reviewLogs.get(observation.id);
            if (existing) {
              if (!sameJson(existing, observation)) {
                throw new Error(
                  `Review observation ID ${observation.id} conflicts with committed evidence.`,
                );
              }
              continue;
            }

            await this.database.reviewLogs.add(structuredClone(observation));
            let schedulerState = await this.database.schedulerStates.get(
              observation.trainingItemId,
            );
            if (!schedulerState) {
              schedulerState = this.schedulerRecord(
                observation.trainingItemId,
                observation.observedAt,
              );
              await this.database.schedulerStates.put(schedulerState);
            }
            const previousDueAt = schedulerState.state.dueAt;
            const mapped = mapObservationToSchedulerDecision(
              observation,
              schedulerState.state,
            );
            let resultingState = schedulerState.state;
            let resultingRetrievability = this.#scheduler.retrievability(
              resultingState,
              new Date(observation.observedAt),
            );
            if (mapped.action === 'review' && mapped.grade) {
              const reviewed = this.#scheduler.review(
                schedulerState.state,
                mapped.grade,
                new Date(observation.observedAt),
              );
              resultingState = reviewed.state;
              resultingRetrievability = reviewed.retrievability;
              schedulerState = {
                ...schedulerState,
                state: resultingState,
                mappingPolicyVersion: mapped.policyVersion,
                adapterVersion: this.#scheduler.adapterVersion,
                parametersVersion: this.#scheduler.parametersVersion,
                updatedAt: observation.observedAt,
              };
              await this.database.schedulerStates.put(schedulerState);
            }
            const decision: SchedulerDecisionRecord = {
              id: observation.id,
              observationId: observation.id,
              trainingItemId: observation.trainingItemId,
              action: mapped.action,
              ...(mapped.grade ? { grade: mapped.grade } : {}),
              responseBand: mapped.responseBand,
              policyVersion: mapped.policyVersion,
              responsePolicyVersion: mapped.responsePolicyVersion,
              adapterVersion: this.#scheduler.adapterVersion,
              parametersVersion: this.#scheduler.parametersVersion,
              reason: mapped.reason,
              decidedAt: observation.observedAt,
              previousDueAt,
              resultingDueAt: resultingState.dueAt,
              resultingState: structuredClone(resultingState),
              resultingRetrievability,
            };
            await this.database.schedulerDecisions.add(decision);

            if (observation.confusionContextId) {
              const id = `${observation.trainingItemId}::${observation.confusionContextId}`;
              const confusion =
                (await this.database.confusionRelations.get(id)) ??
                ({
                  id,
                  expectedTrainingItemId: observation.trainingItemId,
                  confusionContextId: observation.confusionContextId,
                  count: 0,
                  lastObservedAt: observation.observedAt,
                } satisfies ConfusionRelationRecord);
              await this.database.confusionRelations.put({
                ...confusion,
                count: confusion.count + 1,
                lastObservedAt: observation.observedAt,
              });
            }
          }

          const existingSession = await this.database.sessions.get(state.sessionId);
          const terminal = TERMINAL_SESSION_STATUSES.has(state.status);
          const targetIds = state.adaptive?.targetTrainingItemIds ??
            state.targetTrainingItemIds;
          const record: SessionRecord = {
            id: state.sessionId,
            planId: state.planId,
            fixtureId: state.fixtureId,
            status: state.status,
            state: structuredClone(state),
            targetIds,
            targetIdentityKind: 'training-item',
            seed: state.adaptive?.seed ?? state.sessionId,
            policyVersion: SESSION_POLICY_VERSION,
            pendingRepairIds: state.retestQueue.map((ticket) => ticket.id),
            committedObservationIds: state.evidence.map(
              (observation) => observation.id,
            ),
            createdAt: existingSession?.createdAt ?? now,
            updatedAt: now,
            ...(terminal ? { completedAt: now } : {}),
          };
          await this.database.sessions.put(record);
          const meta = await this.database.meta.get(DATABASE_META_ID);
          if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
        },
      );
    });
  }

  public async latestInterruptedSession(): Promise<SessionRecord | undefined> {
    await this.awaitPendingOperations();
    const candidates = (await this.database.sessions.toArray())
      .filter((session) => !TERMINAL_SESSION_STATUSES.has(session.status))
      .sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      );
    return candidates[0];
  }

  public async markSessionAbandoned(sessionId: string, now = nowIso()): Promise<void> {
    return this.enqueue(async () => {
      const session = await this.database.sessions.get(sessionId);
      if (!session) return;
      const state = { ...session.state, status: 'abandoned' as const };
      await this.database.sessions.put({
        ...session,
        status: 'abandoned',
        state,
        updatedAt: now,
        completedAt: now,
      });
    });
  }

  public async getSetting<T = unknown>(id: string): Promise<T | undefined> {
    await this.awaitPendingOperations();
    return (await this.database.settings.get(id))?.value as T | undefined;
  }

  public async putSetting(id: string, value: unknown, now = nowIso()): Promise<void> {
    return this.enqueue(async () => {
      const record: SettingRecord = {
        id,
        value: structuredClone(value),
        updatedAt: now,
      };
      await this.database.settings.put(record);
    });
  }

  public async listTrainingItems(repertoireId: string): Promise<TrainingItemRecord[]> {
    await this.awaitPendingOperations();
    return this.database.trainingItems
      .where('repertoireId')
      .equals(repertoireId)
      .sortBy('id');
  }

  public async listSchedulerStates(
    repertoireId: string,
  ): Promise<SchedulerStateRecord[]> {
    const itemIds = new Set(
      (await this.listTrainingItems(repertoireId)).map((item) => item.id),
    );
    return (await this.database.schedulerStates.toArray())
      .filter((record) => itemIds.has(record.trainingItemId))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  public async clearUserData(confirmation: string, now = nowIso()): Promise<void> {
    if (confirmation !== 'RESET LOCAL DATA') {
      throw new Error('Reset confirmation did not match.');
    }
    return this.enqueue(async () => {
      await this.database.transaction('rw', this.database.tables, async () => {
        for (const name of USER_DATA_TABLE_NAMES) {
          await this.database.table(name).clear();
        }
        const meta = await this.database.meta.get(DATABASE_META_ID);
        if (meta) {
          await this.database.meta.put({
            ...meta,
            updatedAt: now,
            schedulerCutoverAt: now,
            lastSuccessfulBackupAt: undefined,
          });
        }
      });
    });
  }
}
