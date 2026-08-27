import type {
  ImportCandidate,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import type { TrainingSessionState } from '../../domain/training/session';
import {
  DATABASE_META_ID,
  OpeningTrainerDatabase,
  USER_DATA_TABLE_NAMES,
  createDatabaseMeta,
  type ConfusionRelationRecord,
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

const SESSION_POLICY_VERSION = 'phase4-session-persistence-v1';
const TERMINAL_SESSION_STATUSES = new Set(['session-complete', 'abandoned']);

function nowIso(): string {
  return new Date().toISOString();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class OpeningTrainerRepository {
  public readonly database: OpeningTrainerDatabase;

  public constructor(database: OpeningTrainerDatabase) {
    this.database = database;
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
      meta.portableSchemaVersion < 1
    ) {
      throw new Error('Opening Trainer local database metadata is inconsistent.');
    }
  }

  public close(): void {
    this.database.close();
  }

  public async deleteDatabase(): Promise<void> {
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
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id),
      )
      .map((repertoire) => graphForRepertoire(graph, repertoire.id));
  }

  public async loadRepertoireGraph(repertoireId: string): Promise<RepertoireGraph> {
    return graphForRepertoire(await this.loadCompleteGraph(), repertoireId);
  }

  public async createRepertoire(
    candidate: ImportCandidate,
    now = nowIso(),
  ): Promise<RepertoireGraph> {
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
  }

  public async updateBranchInclusion(
    contextId: string,
    included: boolean,
    now = nowIso(),
  ): Promise<void> {
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
        const meta = await this.database.meta.get(DATABASE_META_ID);
        if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
      },
    );
  }

  public async saveSession(
    state: TrainingSessionState,
    now = nowIso(),
  ): Promise<void> {
    await this.database.transaction(
      'rw',
      [
        this.database.sessions,
        this.database.reviewLogs,
        this.database.trainingItems,
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
        const record: SessionRecord = {
          id: state.sessionId,
          planId: state.planId,
          fixtureId: state.fixtureId,
          status: state.status,
          state: structuredClone(state),
          targetIds: [state.targetStepId],
          seed: state.sessionId,
          policyVersion: SESSION_POLICY_VERSION,
          pendingRepairIds: state.retestQueue.map((ticket) => ticket.id),
          committedObservationIds: state.evidence.map((observation) => observation.id),
          createdAt: existingSession?.createdAt ?? now,
          updatedAt: now,
          ...(terminal ? { completedAt: now } : {}),
        };
        await this.database.sessions.put(record);
        const meta = await this.database.meta.get(DATABASE_META_ID);
        if (meta) await this.database.meta.put({ ...meta, updatedAt: now });
      },
    );
  }

  public async latestInterruptedSession(): Promise<SessionRecord | undefined> {
    const candidates = (await this.database.sessions.toArray())
      .filter((session) => !TERMINAL_SESSION_STATUSES.has(session.status))
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) ||
          b.id.localeCompare(a.id),
      );
    return candidates[0];
  }

  public async markSessionAbandoned(
    sessionId: string,
    now = nowIso(),
  ): Promise<void> {
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
  }

  public async getSetting<T = unknown>(id: string): Promise<T | undefined> {
    return (await this.database.settings.get(id))?.value as T | undefined;
  }

  public async putSetting(
    id: string,
    value: unknown,
    now = nowIso(),
  ): Promise<void> {
    const record: SettingRecord = { id, value: structuredClone(value), updatedAt: now };
    await this.database.settings.put(record);
  }

  public async listTrainingItems(
    repertoireId: string,
  ): Promise<TrainingItemRecord[]> {
    return this.database.trainingItems
      .where('repertoireId')
      .equals(repertoireId)
      .sortBy('id');
  }

  public async clearUserData(
    confirmation: string,
    now = nowIso(),
  ): Promise<void> {
    if (confirmation !== 'RESET LOCAL DATA') {
      throw new Error('Reset confirmation did not match.');
    }
    await this.database.transaction('rw', this.database.tables, async () => {
      for (const name of USER_DATA_TABLE_NAMES) {
        await this.database.table(name).clear();
      }
      const meta = await this.database.meta.get(DATABASE_META_ID);
      if (meta) {
        await this.database.meta.put({
          ...meta,
          updatedAt: now,
          lastSuccessfulBackupAt: undefined,
        });
      }
    });
  }
}
