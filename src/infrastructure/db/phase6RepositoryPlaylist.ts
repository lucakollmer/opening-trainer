import {
  SCHEDULER_MAPPING_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import { boundedText, validateTags } from '../../domain/phase6/validation';
import {
  playlistAllowsRouteContext,
  queryAcceptedMoves,
  trainingItemIdentityKey,
} from '../../domain/repertoire/graph';
import type { Playlist } from '../../domain/repertoire/types';
import {
  DATABASE_META_ID,
  type DecisionRuleRecord,
  type PlaylistRecord,
  type TrainingItemRecord,
} from './openingTrainerDatabase';
import { Phase6LifecycleRepository } from './phase6RepositoryLifecycle';
import { nowIso, playlistEntries, unique } from './phase6RepositoryCore';

export class Phase6PlaylistRepository extends Phase6LifecycleRepository {
  private validatePlaylist(playlist: Playlist): void {
    const name = boundedText(playlist.name, 'Playlist name', 120);
    if (name !== playlist.name.trim()) {
      throw new Error('Playlist name contains invalid surrounding whitespace.');
    }
    validateTags(playlist.tags);
    if (playlist.repertoireIds.length === 0) {
      throw new Error('Playlist requires at least one repertoire.');
    }
    if (unique(playlist.repertoireIds).length !== playlist.repertoireIds.length) {
      throw new Error('Playlist repertoires must be unique.');
    }
    if (
      unique(playlist.includedContextIds).length !==
        playlist.includedContextIds.length ||
      unique(playlist.excludedContextIds).length !==
        playlist.excludedContextIds.length
    ) {
      throw new Error('Playlist context filters must be unique.');
    }
    if (
      playlist.colour !== undefined &&
      playlist.colour !== 'white' &&
      playlist.colour !== 'black'
    ) {
      throw new Error('Playlist colour filter is invalid.');
    }
    if (
      playlist.weighting.kind !== 'due-first' &&
      playlist.weighting.kind !== 'balanced'
    ) {
      throw new Error('Playlist weighting policy is invalid.');
    }
    const overlap = playlist.includedContextIds.filter((id) =>
      playlist.excludedContextIds.includes(id),
    );
    if (overlap.length > 0) {
      throw new Error('Playlist cannot both include and exclude the same context.');
    }
    if (
      playlist.maxPly !== undefined &&
      (!Number.isInteger(playlist.maxPly) ||
        playlist.maxPly < 0 ||
        playlist.maxPly > 200)
    ) {
      throw new Error('Playlist maximum ply must be an integer between 0 and 200.');
    }
  }

  public savePlaylist(playlist: Playlist, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      this.validatePlaylist(playlist);
      await this.assertMutationUnlocked(playlist.repertoireIds, [playlist.id]);
      for (const repertoireId of playlist.repertoireIds) {
        if (!(await this.database.repertoires.get(repertoireId))) {
          throw new Error(`Playlist references missing repertoire ${repertoireId}.`);
        }
      }
      const contexts = new Map(
        (await this.database.repertoireContexts.toArray()).map((row) => [
          row.id,
          row,
        ]),
      );
      const repertoireIds = new Set(playlist.repertoireIds);
      for (const contextId of [
        ...playlist.includedContextIds,
        ...playlist.excludedContextIds,
      ]) {
        const context = contexts.get(contextId);
        if (!context) {
          throw new Error(`Playlist references missing context ${contextId}.`);
        }
        if (!repertoireIds.has(context.repertoireId)) {
          throw new Error(
            `Playlist context ${contextId} is outside its repertoire set.`,
          );
        }
      }

      const normalized: Playlist = {
        ...playlist,
        name: playlist.name.trim(),
        tags: validateTags(playlist.tags),
        updatedAt: now,
      };
      const existing = await this.database.playlists.get(playlist.id);
      const record: PlaylistRecord = {
        id: normalized.id,
        name: normalized.name,
        ...(normalized.colour ? { colour: normalized.colour } : {}),
        ...(normalized.maxPly !== undefined
          ? { maxPly: normalized.maxPly }
          : {}),
        weighting: structuredClone(normalized.weighting),
        createdAt: existing?.createdAt ?? normalized.createdAt ?? now,
        updatedAt: now,
      };
      const entries = playlistEntries(normalized);

      await this.database.transaction(
        'rw',
        [
          this.database.playlists,
          this.database.playlistEntries,
          this.database.meta,
        ],
        async () => {
          await this.database.playlists.put(record);
          await this.database.playlistEntries
            .where('playlistId')
            .equals(playlist.id)
            .delete();
          if (entries.length > 0) {
            await this.database.playlistEntries.bulkPut(entries);
          }
          const meta = await this.database.meta.get(DATABASE_META_ID);
          if (meta) {
            await this.database.meta.put({ ...meta, updatedAt: now });
          }
        },
      );

      const state = await this.database.playlistStates.get(playlist.id);
      await this.database.playlistStates.put({
        id: playlist.id,
        ...(state?.archivedAt ? { archivedAt: state.archivedAt } : {}),
        updatedAt: now,
      });
      await this.materializePlaylistNormalItems(playlist.id, now);
    });
  }

  protected async materializePlaylistNormalItems(
    playlistId: string,
    now: string,
  ): Promise<void> {
    const graph = await this.base.loadCompleteGraph();
    const playlist = graph.playlists.find((row) => row.id === playlistId);
    if (!playlist) return;
    const positions = new Map(graph.positions.map((row) => [row.id, row]));
    const activeIds = new Set<string>();
    const rules: DecisionRuleRecord[] = [];
    const items: TrainingItemRecord[] = [];
    for (const context of graph.contexts.filter((row) =>
      playlist.repertoireIds.includes(row.repertoireId),
    )) {
      if (!playlistAllowsRouteContext(graph, playlist, context)) continue;
      const hasUserMove = graph.moves.some(
        (move) =>
          move.contextId === context.id &&
          move.actor === 'user' &&
          move.included,
      );
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
      const unscoped =
        prior && (!prior.playlistIds || prior.playlistIds.length === 0);
      const playlistIds = unscoped
        ? undefined
        : unique([...(prior?.playlistIds ?? []), playlistId]).sort();
      const contextIds = unique([...(prior?.contextIds ?? []), context.id]).sort();
      const item: TrainingItemRecord = prior
        ? {
            ...prior,
            contextIds,
            ...(playlistIds ? { playlistIds } : {}),
            status: 'active',
            updatedAt: now,
          }
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
    const oldRules = (await this.database.decisionRules.toArray()).filter(
      (row) => row.playlistId === playlistId && row.promptMode === 'normal',
    );
    const oldScoped = (await this.database.trainingItems.toArray()).filter(
      (row) =>
        row.promptMode === 'normal' &&
        row.playlistIds?.includes(playlistId) &&
        !activeIds.has(row.id),
    );
    const obsolete = oldScoped.map((row) => {
      const remaining = (row.playlistIds ?? []).filter((id) => id !== playlistId);
      return {
        ...row,
        playlistIds: remaining,
        status:
          remaining.length > 0 ? ('active' as const) : ('superseded' as const),
        updatedAt: now,
      };
    });
    await this.database.transaction(
      'rw',
      [
        this.database.decisionRules,
        this.database.trainingItems,
        this.database.schedulerStates,
      ],
      async () => {
        if (oldRules.length > 0) {
          await this.database.decisionRules.bulkDelete(
            oldRules.map((row) => row.id),
          );
        }
        if (rules.length > 0) await this.database.decisionRules.bulkPut(rules);
        if (items.length > 0 || obsolete.length > 0) {
          await this.database.trainingItems.bulkPut([...items, ...obsolete]);
        }
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
      },
    );
  }
}
