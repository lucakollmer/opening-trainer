import {
  SCHEDULER_MAPPING_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import type { ManagementImpact } from '../../domain/phase6/types';
import type {
  RepertoireContext,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import { deriveTrainingRows } from './graphStorage';
import { Phase6PlaylistRepository } from './phase6RepositoryPlaylist';
import { nowIso } from './phase6RepositoryCore';

export class Phase6ManagementRepository extends Phase6PlaylistRepository {
  public previewBranchInclusion(
    contextId: string,
    included: boolean,
  ): Promise<ManagementImpact> {
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      let blockedReason: string | undefined;
      try {
        await this.assertMutationUnlocked([context.repertoireId]);
      } catch (error) {
        blockedReason = error instanceof Error ? error.message : String(error);
      }
      const graph = await this.base.loadCompleteGraph();
      const byId = new Map(graph.contexts.map((row) => [row.id, row]));
      const descendants = graph.contexts.filter((row) => {
        let current: RepertoireContext | undefined = row;
        while (current) {
          if (current.id === contextId) return true;
          current = current.parentContextId
            ? byId.get(current.parentContextId)
            : undefined;
        }
        return false;
      });
      const decisionCount = descendants.filter((row) =>
        graph.moves.some(
          (move) => move.contextId === row.id && move.actor === 'user',
        ),
      ).length;
      return {
        title: `${included ? 'Include' : 'Exclude'} this branch?`,
        details: [
          `${decisionCount} contextual decision(s) are in the affected subtree.`,
          'Historical reviews and scheduler states are retained; only active eligibility/identity projection changes.',
        ],
        ...(blockedReason ? { blockedReason } : {}),
      };
    });
  }

  public updateBranchInclusion(
    contextId: string,
    included: boolean,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      await this.assertMutationUnlocked([context.repertoireId]);
      await this.database.repertoireContexts.put({ ...context, included });
      await this.reconcileBaseNormalItems(context.repertoireId, now);
      for (const mode of ['guided', 'strict'] as const) {
        await this.base.createAdaptiveSessionPlan(context.repertoireId, {
          mode,
          targetCount: 1,
          newItemLimit: 0,
          now: new Date(now),
          seed: `phase6-reconcile:${mode}:${context.repertoireId}`,
          allowReinforcement: false,
        });
      }
      const graph = await this.base.loadCompleteGraph();
      for (const playlist of graph.playlists.filter((row) =>
        row.repertoireIds.includes(context.repertoireId),
      )) {
        await this.materializePlaylistNormalItems(playlist.id, now);
      }
    });
  }

  protected async reconcileBaseNormalItems(
    repertoireId: string,
    now: string,
  ): Promise<void> {
    const graph = await this.base.loadCompleteGraph();
    const contexts = graph.contexts.filter(
      (row) => row.repertoireId === repertoireId,
    );
    const contextIds = new Set(contexts.map((row) => row.id));
    const moves = graph.moves.filter((row) => contextIds.has(row.contextId));
    const edgeIds = new Set(moves.map((row) => row.edgeId));
    const edges = graph.edges.filter((row) => edgeIds.has(row.id));
    const positionIds = new Set(contexts.map((row) => row.entryPositionId));
    edges.forEach((row) => {
      positionIds.add(row.fromPositionId);
      positionIds.add(row.toPositionId);
    });
    const repertoireGraph: RepertoireGraph = {
      repertoires: graph.repertoires.filter((row) => row.id === repertoireId),
      contexts,
      positions: graph.positions.filter((row) => positionIds.has(row.id)),
      edges,
      moves,
      playlists: [],
    };
    const existingNormalRows = (
      await this.database.trainingItems
        .where('repertoireId')
        .equals(repertoireId)
        .toArray()
    ).filter(
      (row) =>
        row.promptMode === 'normal' &&
        (!row.playlistIds || row.playlistIds.length === 0),
    );
    const derived = deriveTrainingRows(
      repertoireGraph,
      now,
      new Map(existingNormalRows.map((row) => [row.id, row])),
    );
    const oldNormalRules = (
      await this.database.decisionRules
        .where('repertoireId')
        .equals(repertoireId)
        .toArray()
    ).filter((row) => row.promptMode === 'normal' && !row.playlistId);
    await this.database.transaction(
      'rw',
      [
        this.database.decisionRules,
        this.database.trainingItems,
        this.database.schedulerStates,
      ],
      async () => {
        if (oldNormalRules.length > 0) {
          await this.database.decisionRules.bulkDelete(
            oldNormalRules.map((row) => row.id),
          );
        }
        if (derived.decisionRules.length > 0) {
          await this.database.decisionRules.bulkPut(derived.decisionRules);
        }
        if (derived.trainingItems.length > 0) {
          await this.database.trainingItems.bulkPut(derived.trainingItems);
        }
        for (const item of derived.trainingItems.filter(
          (row) => row.status === 'active',
        )) {
          if (!(await this.database.schedulerStates.get(item.id))) {
            const baseState = this.scheduler.createNew(new Date(now));
            await this.database.schedulerStates.put({
              id: item.id,
              trainingItemId: item.id,
              state: baseState,
              adapterVersion: this.scheduler.adapterVersion,
              parametersVersion: this.scheduler.parametersVersion,
              mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      },
    );
  }
}
