import {
  buildBrowseTreeWithProgress,
  type ProgressSchedulerRecord,
} from '../../domain/phase6/progress';
import type {
  BrowseWorkspaceSnapshot,
  ScopeQueueSummary,
  TrainingScope,
} from '../../domain/phase6/types';
import { playlistAllowsContext } from '../../domain/repertoire/graph';
import type { ImportRecord } from './openingTrainerDatabase';
import {
  DATABASE_META_ID,
  USER_DATA_TABLE_NAMES,
} from './openingTrainerDatabase';
import {
  PHASE6_DATABASE_SCHEMA_VERSION,
  PHASE6_PORTABLE_SCHEMA_VERSION,
  PHASE6_USER_DATA_TABLE_NAMES,
} from './phase6Database';
import { Phase6ContrastRecallRepository } from './phase6RepositoryContrastRecall';
import { nowIso } from './phase6RepositoryCore';
import {
  commitPhase6BackupRestore,
  exportPhase6Backup,
  previewPhase6BackupJson,
  type Phase6BackupPreview,
} from '../import-export/phase6Backup';
import { exportRepertoirePgn as exportPgn } from '../import-export/pgnExport';

export const PHASE6_REPOSITORY_POLICY_VERSION = 'phase6-repo-v1';

export class Phase6OpeningTrainerRepository extends Phase6ContrastRecallRepository {
  public override async initialize(now = nowIso()): Promise<void> {
    await super.initialize(now);
    await this.enqueue(async () => {
      await this.migrateLegacyOpeningNames(now);
      const graph = await this.base.loadCompleteGraph();
      for (const playlist of graph.playlists) {
        await this.materializePlaylistNormalItems(playlist.id, now);
      }
    });
  }

  public getScopeQueueSummary(
    scope: TrainingScope,
    now = new Date(),
  ): Promise<ScopeQueueSummary> {
    return this.enqueue(() => this.getScopeQueueSummaryUnsafe(scope, now));
  }

  protected async getScopeQueueSummaryUnsafe(
    scope: TrainingScope,
    now: Date,
  ): Promise<ScopeQueueSummary> {
    const moveRows = await this.moveCandidateRows(
      scope,
      'normal',
      now,
      'queue-summary',
    );
    let due = 0;
    let fresh = 0;
    for (const row of moveRows) {
      if (row.snapshot.schedulerState.stage === 'new') fresh += 1;
      else if (this.scheduler.isDue(row.snapshot.schedulerState, now)) due += 1;
    }
    const nameItems = await this.eligibleNameItems(scope, now);
    const nameStates = new Map(
      (await this.database.nameSchedulerStates.toArray()).map((row) => [
        row.itemId,
        row,
      ]),
    );
    let namesDue = 0;
    let namesNew = 0;
    for (const item of nameItems) {
      const state = nameStates.get(item.id)?.state;
      if (!state) continue;
      if (state.stage === 'new') namesNew += 1;
      else if (this.scheduler.isDue(state, now)) namesDue += 1;
    }
    const confusions = await this.listConfusionsUnsafe(scope, now);
    return {
      due,
      new: fresh,
      contrast: confusions.filter((row) => row.contrastDue).length,
      namesDue,
      namesNew,
    };
  }

  public browseWorkspace(
    scope: TrainingScope,
    options: { repertoireId?: string; contextId?: string; now?: Date } = {},
  ): Promise<BrowseWorkspaceSnapshot> {
    return this.enqueue(async () => {
      const now = options.now ?? new Date();
      const { graph, playlist, availableIds } = await this.scopeGraph(scope);
      const allScopeIds = await this.scopeRepertoireIds(scope);
      const repertoireId =
        options.repertoireId && allScopeIds.includes(options.repertoireId)
          ? options.repertoireId
          : allScopeIds[0];
      if (!repertoireId) throw new Error('Browse scope contains no repertoire.');
      const repertoire = graph.repertoires.find(
        (row) => row.id === repertoireId,
      );
      if (!repertoire) throw new Error(`Missing repertoire ${repertoireId}.`);
      const contexts = graph.contexts.filter(
        (row) => row.repertoireId === repertoireId,
      );
      const selectedContextId =
        options.contextId && contexts.some((row) => row.id === options.contextId)
          ? options.contextId
          : repertoire.rootContextIds[0];
      if (!selectedContextId) throw new Error('Repertoire has no root context.');
      const selectedContext = graph.contexts.find(
        (row) => row.id === selectedContextId,
      );
      const selectedPosition = selectedContext
        ? graph.positions.find(
            (row) => row.id === selectedContext.entryPositionId,
          )
        : undefined;
      if (!selectedContext || !selectedPosition) {
        throw new Error('Selected Browse position is missing.');
      }
      const items = (await this.database.trainingItems.toArray()).filter(
        (row) => row.repertoireId === repertoireId,
      );
      const itemIds = new Set(items.map((item) => item.id));
      const schedulerRows: ProgressSchedulerRecord[] = (
        await this.database.schedulerStates.toArray()
      )
        .filter((state) => itemIds.has(state.trainingItemId))
        .map((state) => ({
          trainingItemId: state.trainingItemId,
          state: state.state,
          retrievability: this.scheduler.retrievability(state.state, now),
        }));
      const playlistEligible = playlist
        ? new Set(
            contexts
              .filter(
                (row) =>
                  availableIds.includes(row.repertoireId) &&
                  playlistAllowsContext(graph, playlist, row),
              )
              .map((row) => row.id),
          )
        : undefined;
      const tree = buildBrowseTreeWithProgress({
        graph,
        repertoireId,
        items,
        scheduler: schedulerRows,
        reviews: await this.database.reviewLogs.toArray(),
        now,
        currentContextId: selectedContextId,
        ...(scope.kind === 'playlist' ? { playlistId: scope.id } : {}),
        ...(playlistEligible
          ? { playlistEligibleContextIds: playlistEligible }
          : {}),
      });
      return {
        scope,
        repertoireId,
        tree,
        selectedContextId,
        selectedFen: selectedPosition.fen,
        selectedOrientation: repertoire.userColour,
        confusions: await this.listConfusionsUnsafe(scope, now),
        queue: await this.getScopeQueueSummaryUnsafe(scope, now),
      };
    });
  }

  public async listImportHistory(): Promise<ImportRecord[]> {
    await this.awaitPendingOperations();
    return (await this.database.imports.toArray()).sort(
      (a, b) =>
        b.importedAt.localeCompare(a.importedAt) || a.id.localeCompare(b.id),
    );
  }

  public exportCompleteBackup(exportedAt = nowIso()) {
    return this.enqueue(() => exportPhase6Backup(this.database, exportedAt));
  }

  public previewBackupJson(text: string): Phase6BackupPreview {
    return previewPhase6BackupJson(text);
  }

  public async restoreCompleteBackup(
    preview: Phase6BackupPreview,
    restoredAt = nowIso(),
  ): Promise<void> {
    if (this.restoreRequested) {
      throw new Error('RESTORE_IN_PROGRESS: restore is already pending.');
    }
    this.restoreRequested = true;
    try {
      await this.enqueue(async () => {
        await this.base.awaitPendingOperations();
        await commitPhase6BackupRestore(this.database, preview, { restoredAt });
        await this.materializeLifecycle(restoredAt);
        await this.migrateLegacyOpeningNames(restoredAt);
        const graph = await this.base.loadCompleteGraph();
        for (const playlist of graph.playlists) {
          await this.materializePlaylistNormalItems(playlist.id, restoredAt);
        }
      });
    } finally {
      this.restoreRequested = false;
    }
  }

  public exportRepertoirePgn(
    repertoireId: string,
  ): Promise<{ pgn: string; warnings: string[] }> {
    return this.enqueue(async () => {
      const graph = await this.base.loadCompleteGraph();
      const pgn = exportPgn(graph, repertoireId);
      const warnings: string[] = [];
      const contexts = graph.contexts.filter(
        (row) => row.repertoireId === repertoireId,
      );
      const contextIds = new Set(contexts.map((row) => row.id));
      const moves = graph.moves.filter((row) => contextIds.has(row.contextId));
      if (moves.some((move) => move.note && move.purpose)) {
        warnings.push(
          'PGN cannot preserve move note and purpose as distinct structured fields; JSON backup remains lossless.',
        );
      }
      if (contexts.some((row) => row.note)) {
        warnings.push(
          'Context-level notes may not be losslessly representable in PGN.',
        );
      }
      if (
        (await this.database.managedOpeningNames.toArray()).some(
          (row) => row.repertoireId === repertoireId && !row.archivedAt,
        )
      ) {
        warnings.push(
          'Path-specific opening-name recall metadata and scheduling are not represented in PGN.',
        );
      }
      return { pgn, warnings };
    });
  }

  public clearUserData(
    confirmation: string,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    if (confirmation !== 'RESET LOCAL DATA') {
      return Promise.reject(new Error('Reset confirmation did not match.'));
    }
    return this.enqueue(async () => {
      await this.assertMutationUnlocked(
        (await this.database.repertoires.toArray()).map((row) => row.id),
        (await this.database.playlists.toArray()).map((row) => row.id),
      );
      await this.database.transaction('rw', this.database.tables, async () => {
        for (const name of [
          ...USER_DATA_TABLE_NAMES,
          ...PHASE6_USER_DATA_TABLE_NAMES,
        ]) {
          await this.database.table(name).clear();
        }
        const meta = await this.database.meta.get(DATABASE_META_ID);
        if (meta) {
          await this.database.meta.put({
            ...meta,
            databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
            portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
            schedulerCutoverAt: now,
            lastSuccessfulBackupAt: undefined,
            updatedAt: now,
          });
        }
      });
    });
  }
}

export type {
  LegacyMoveRecovery,
  MoveSessionOptions,
} from './phase6RepositoryTraining';
