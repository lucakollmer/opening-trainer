import { SCHEDULER_MAPPING_POLICY_VERSION } from '../../domain/scheduling/observationPolicy';
import type {
  ManagedPlaylistSummary,
  ManagedRepertoireSummary,
  ManagementImpact,
  PlaylistAvailability,
} from '../../domain/phase6/types';
import { boundedText, validateTags } from '../../domain/phase6/validation';
import {
  playlistAllowsRouteContext,
  queryAcceptedMoves,
  trainingItemIdentityKey,
} from '../../domain/repertoire/graph';
import type {
  ImportCandidate,
  Playlist,
  RepertoireContext,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import type { DecisionRuleRecord, TrainingItemRecord } from './openingTrainerDatabase';
import { deriveTrainingRows } from './graphStorage';
import { Phase6RepositoryCore, nowIso, unique } from './phase6RepositoryCore';

export class Phase6ManagementRepository extends Phase6RepositoryCore {
  public createRepertoire(candidate: ImportCandidate, now = nowIso()): Promise<RepertoireGraph> {
    this.assertWritable();
    return this.enqueue(async () => {
      const graph = await this.base.createRepertoire(candidate, now);
      const repertoire = graph.repertoires[0];
      if (repertoire) {
        await this.database.repertoireStates.put({ id: repertoire.id, updatedAt: now });
      }
      return graph;
    });
  }
  public async listManagedRepertoires(): Promise<ManagedRepertoireSummary[]> {
    await this.awaitPendingOperations();
    const [rows, states, moves, contexts] = await Promise.all([
      this.database.repertoires.toArray(),
      this.database.repertoireStates.toArray(),
      this.database.repertoireMoves.toArray(),
      this.database.repertoireContexts.toArray(),
    ]);
    const stateById = new Map(states.map((row) => [row.id, row]));
    const repertoireByContext = new Map(contexts.map((row) => [row.id, row.repertoireId]));
    return rows
      .map((row) => {
        const archived = Boolean(stateById.get(row.id)?.archivedAt ?? row.archivedAt);
        return {
          id: row.id,
          name: row.name,
          userColour: row.userColour,
          archived,
          trainable:
            !archived &&
            row.rootContextIds.length > 0 &&
            moves.some(
              (move) =>
                move.actor === 'user' &&
                move.included &&
                repertoireByContext.get(move.contextId) === row.id,
            ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
  private async playlistAvailability(playlist: Playlist): Promise<{
    availability: PlaylistAvailability;
    availableRepertoireIds: string[];
    unavailableRepertoireIds: string[];
  }> {
    if (await this.playlistArchived(playlist.id)) {
      return { availability: 'archived', availableRepertoireIds: [], unavailableRepertoireIds: [...playlist.repertoireIds] };
    }
    const available: string[] = [];
    const unavailable: string[] = [];
    for (const id of playlist.repertoireIds) {
      if (await this.database.repertoires.get(id) && !(await this.repertoireArchived(id))) available.push(id);
      else unavailable.push(id);
    }
    const availability: PlaylistAvailability =
      available.length === 0 ? 'unavailable' : unavailable.length > 0 ? 'partially-unavailable' : 'ready';
    return { availability, availableRepertoireIds: available, unavailableRepertoireIds: unavailable };
  }
  public async listManagedPlaylists(): Promise<ManagedPlaylistSummary[]> {
    await this.awaitPendingOperations();
    const graph = await this.base.loadCompleteGraph();
    const result: ManagedPlaylistSummary[] = [];
    for (const playlist of graph.playlists) {
      const availability = await this.playlistAvailability(playlist);
      result.push({
        id: playlist.id,
        name: playlist.name,
        archived: availability.availability === 'archived',
        ...availability,
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
  public async getPlaylist(id: string): Promise<Playlist> {
    await this.awaitPendingOperations();
    return this.getPlaylistUnsafe(id);
  }
  private validatePlaylist(playlist: Playlist): void {
    const name = boundedText(playlist.name, 'Playlist name', 120);
    if (name !== playlist.name.trim()) throw new Error('Playlist name contains invalid surrounding whitespace.');
    validateTags(playlist.tags);
    if (playlist.repertoireIds.length === 0) throw new Error('Playlist requires at least one repertoire.');
    if (unique(playlist.repertoireIds).length !== playlist.repertoireIds.length) throw new Error('Playlist repertoires must be unique.');
    const overlap = playlist.includedContextIds.filter((id) => playlist.excludedContextIds.includes(id));
    if (overlap.length > 0) throw new Error('Playlist cannot both include and exclude the same context.');
    if (playlist.maxPly !== undefined && (!Number.isInteger(playlist.maxPly) || playlist.maxPly < 0 || playlist.maxPly > 200)) {
      throw new Error('Playlist maximum ply must be an integer between 0 and 200.');
    }
  }
  public savePlaylist(playlist: Playlist, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      this.validatePlaylist(playlist);
      await this.assertMutationUnlocked(playlist.repertoireIds, [playlist.id]);
      for (const repertoireId of playlist.repertoireIds) {
        if (!(await this.database.repertoires.get(repertoireId))) throw new Error(`Playlist references missing repertoire ${repertoireId}.`);
      }
      const contexts = new Map(
        (await this.database.repertoireContexts.toArray()).map((row) => [row.id, row]),
      );
      const repertoireIds = new Set(playlist.repertoireIds);
      for (const contextId of [
        ...playlist.includedContextIds,
        ...playlist.excludedContextIds,
      ]) {
        const context = contexts.get(contextId);
        if (!context) throw new Error(`Playlist references missing context ${contextId}.`);
        if (!repertoireIds.has(context.repertoireId)) {
          throw new Error(`Playlist context ${contextId} is outside its repertoire set.`);
        }
      }
      await this.base.savePlaylist({ ...playlist, name: playlist.name.trim(), tags: validateTags(playlist.tags), updatedAt: now }, now);
      const state = await this.database.playlistStates.get(playlist.id);
      await this.database.playlistStates.put({ id: playlist.id, ...(state?.archivedAt ? { archivedAt: state.archivedAt } : {}), updatedAt: now });
      await this.materializePlaylistNormalItems(playlist.id, now);
    });
  }
  public renameRepertoire(id: string, name: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const nextName = boundedText(name, 'Repertoire name', 120);
      const row = await this.database.repertoires.get(id);
      if (!row) throw new Error(`Missing repertoire ${id}.`);
      await this.database.repertoires.put({ ...row, name: nextName, updatedAt: now });
    });
  }
  public previewRepertoireArchive(id: string): Promise<ManagementImpact> {
    return this.enqueue(async () => {
      const repertoire = await this.database.repertoires.get(id);
      if (!repertoire) throw new Error(`Missing repertoire ${id}.`);
      let blockedReason: string | undefined;
      try { await this.assertMutationUnlocked([id]); } catch (error) { blockedReason = error instanceof Error ? error.message : String(error); }
      const graph = await this.base.loadCompleteGraph();
      const affected = graph.playlists.filter((playlist) => playlist.repertoireIds.includes(id));
      return {
        title: `Archive ${repertoire.name}?`,
        details: [
          'The repertoire graph, move/name/contrast evidence and scheduler history will be retained.',
          affected.length > 0 ? `${affected.length} playlist(s) will become partially or fully unavailable until this repertoire is restored.` : 'No playlists depend on this repertoire.',
        ],
        ...(blockedReason ? { blockedReason } : {}),
      };
    });
  }
  public archiveRepertoire(id: string, archived: boolean, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      if (!(await this.database.repertoires.get(id))) throw new Error(`Missing repertoire ${id}.`);
      await this.assertMutationUnlocked([id]);
      await this.database.repertoireStates.put({ id, ...(archived ? { archivedAt: now } : {}), updatedAt: now });
    });
  }
  public archivePlaylist(id: string, archived: boolean, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const playlist = await this.getPlaylistUnsafe(id);
      await this.assertMutationUnlocked(playlist.repertoireIds, [id]);
      await this.database.playlistStates.put({ id, ...(archived ? { archivedAt: now } : {}), updatedAt: now });
    });
  }
  public previewBranchInclusion(contextId: string, included: boolean): Promise<ManagementImpact> {
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      let blockedReason: string | undefined;
      try { await this.assertMutationUnlocked([context.repertoireId]); } catch (error) { blockedReason = error instanceof Error ? error.message : String(error); }
      const graph = await this.base.loadCompleteGraph();
      const byId = new Map(graph.contexts.map((row) => [row.id, row]));
      const descendants = graph.contexts.filter((row) => {
        let current: RepertoireContext | undefined = row;
        while (current) {
          if (current.id === contextId) return true;
          current = current.parentContextId ? byId.get(current.parentContextId) : undefined;
        }
        return false;
      });
      const decisionCount = descendants.filter((row) => graph.moves.some((move) => move.contextId === row.id && move.actor === 'user')).length;
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
  public updateBranchInclusion(contextId: string, included: boolean, now = nowIso()): Promise<void> {
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
      for (const playlist of graph.playlists.filter((row) => row.repertoireIds.includes(context.repertoireId))) {
        await this.materializePlaylistNormalItems(playlist.id, now);
      }
    });
  }
  protected async reconcileBaseNormalItems(repertoireId: string, now: string): Promise<void> {
    const graph = await this.base.loadCompleteGraph();
    const contexts = graph.contexts.filter((row) => row.repertoireId === repertoireId);
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
    const existingNormalRows = (await this.database.trainingItems.where('repertoireId').equals(repertoireId).toArray())
      .filter((row) => row.promptMode === 'normal' && (!row.playlistIds || row.playlistIds.length === 0));
    const derived = deriveTrainingRows(repertoireGraph, now, new Map(existingNormalRows.map((row) => [row.id, row])));
    const oldNormalRules = (await this.database.decisionRules.where('repertoireId').equals(repertoireId).toArray())
      .filter((row) => row.promptMode === 'normal' && !row.playlistId);
    await this.database.transaction('rw', [this.database.decisionRules, this.database.trainingItems, this.database.schedulerStates], async () => {
      if (oldNormalRules.length > 0) await this.database.decisionRules.bulkDelete(oldNormalRules.map((row) => row.id));
      if (derived.decisionRules.length > 0) await this.database.decisionRules.bulkPut(derived.decisionRules);
      if (derived.trainingItems.length > 0) await this.database.trainingItems.bulkPut(derived.trainingItems);
      for (const item of derived.trainingItems.filter((row) => row.status === 'active')) {
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
    });
  }
  protected async materializePlaylistNormalItems(playlistId: string, now: string): Promise<void> {
    const graph = await this.base.loadCompleteGraph();
    const playlist = graph.playlists.find((row) => row.id === playlistId);
    if (!playlist) return;
    const positions = new Map(graph.positions.map((row) => [row.id, row]));
    const activeIds = new Set<string>();
    const rules: DecisionRuleRecord[] = [];
    const items: TrainingItemRecord[] = [];
    for (const context of graph.contexts.filter((row) => playlist.repertoireIds.includes(row.repertoireId))) {
      if (!playlistAllowsRouteContext(graph, playlist, context)) continue;
      const hasUserMove = graph.moves.some((move) => move.contextId === context.id && move.actor === 'user' && move.included);
      if (!hasUserMove) continue;
      const accepted = queryAcceptedMoves(graph, {
        repertoireId: context.repertoireId,
        activeContextIds: [context.id],
        playlistId,
        positionId: context.entryPositionId,
        promptMode: 'normal',
      });
      if (accepted.moves.length === 0) continue;
      const position = positions.get(context.entryPositionId);
      if (!position) continue;
      const itemId = trainingItemIdentityKey({
        repertoireId: context.repertoireId,
        contextScopeKey: position.key,
        positionKey: position.key,
        acceptedMoveSetKey: accepted.normalizedKey,
        promptMode: 'normal',
      });
      const prior = await this.database.trainingItems.get(itemId);
      const unscoped = prior && (!prior.playlistIds || prior.playlistIds.length === 0);
      const playlistIds = unscoped ? undefined : unique([...(prior?.playlistIds ?? []), playlistId]).sort();
      const contextIds = unique([...(prior?.contextIds ?? []), context.id]).sort();
      const item: TrainingItemRecord = prior
        ? { ...prior, contextIds, ...(playlistIds ? { playlistIds } : {}), status: 'active', updatedAt: now }
        : {
            id: itemId,
            repertoireId: context.repertoireId,
            contextScopeKey: position.key,
            positionKey: position.key,
            acceptedMoveSetKey: accepted.normalizedKey,
            promptMode: 'normal',
            contextIds,
            ...(playlistIds ? { playlistIds } : { playlistIds: [playlistId] }),
            status: 'active',
            createdAt: now,
            updatedAt: now,
          };
      items.push(item);
      activeIds.add(itemId);
      rules.push({
        id: `decision-rule:${context.id}:normal:${playlistId}`,
        repertoireId: context.repertoireId,
        contextId: context.id,
        positionId: context.entryPositionId,
        promptMode: 'normal',
        acceptedMoveSetKey: accepted.normalizedKey,
        acceptedUci: accepted.moves.map((move) => move.uci),
        trainingItemId: itemId,
        playlistId,
        updatedAt: now,
      });
    }
    const oldRules = (await this.database.decisionRules.toArray()).filter((row) => row.playlistId === playlistId && row.promptMode === 'normal');
    const oldScoped = (await this.database.trainingItems.toArray()).filter((row) => row.promptMode === 'normal' && row.playlistIds?.includes(playlistId) && !activeIds.has(row.id));
    const obsolete = oldScoped.map((row) => {
      const remaining = (row.playlistIds ?? []).filter((id) => id !== playlistId);
      return { ...row, playlistIds: remaining, status: remaining.length > 0 ? ('active' as const) : ('superseded' as const), updatedAt: now };
    });
    await this.database.transaction('rw', [this.database.decisionRules, this.database.trainingItems, this.database.schedulerStates], async () => {
      if (oldRules.length > 0) await this.database.decisionRules.bulkDelete(oldRules.map((row) => row.id));
      if (rules.length > 0) await this.database.decisionRules.bulkPut(rules);
      if (items.length > 0 || obsolete.length > 0) await this.database.trainingItems.bulkPut([...items, ...obsolete]);
      for (const item of items) {
        if (!(await this.database.schedulerStates.get(item.id))) {
          await this.database.schedulerStates.put({
            id: item.id,
            trainingItemId: item.id,
            state: this.scheduler.createNew(new Date(now)),
            adapterVersion: this.scheduler.adapterVersion,
            parametersVersion: this.scheduler.parametersVersion,
            mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    });
  }
}
