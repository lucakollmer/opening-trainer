import type {
  ManagedPlaylistSummary,
  ManagedRepertoireSummary,
  ManagementImpact,
  PlaylistAvailability,
} from '../../domain/phase6/types';
import { boundedText } from '../../domain/phase6/validation';
import type {
  ImportCandidate,
  Playlist,
  RepertoireGraph,
} from '../../domain/repertoire/types';
import { Phase6RepositoryCore, nowIso } from './phase6RepositoryCore';

export class Phase6LifecycleRepository extends Phase6RepositoryCore {
  public createRepertoire(
    candidate: ImportCandidate,
    now = nowIso(),
  ): Promise<RepertoireGraph> {
    this.assertWritable();
    return this.enqueue(async () => {
      const graph = await this.base.createRepertoire(candidate, now);
      const repertoire = graph.repertoires[0];
      if (repertoire) {
        await this.database.repertoireStates.put({
          id: repertoire.id,
          updatedAt: now,
        });
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
    const contextById = new Map(contexts.map((row) => [row.id, row]));

    const effectivelyIncluded = (contextId: string): boolean => {
      let current = contextById.get(contextId);
      const seen = new Set<string>();
      while (current) {
        if (!current.included || seen.has(current.id)) return false;
        seen.add(current.id);
        current = current.parentContextId
          ? contextById.get(current.parentContextId)
          : undefined;
      }
      return true;
    };

    return rows
      .map((row) => {
        const state = stateById.get(row.id);
        const archived = state
          ? Boolean(state.archivedAt)
          : Boolean(row.archivedAt);
        return {
          id: row.id,
          name: row.name,
          userColour: row.userColour,
          archived,
          trainable:
            !archived &&
            row.rootContextIds.length > 0 &&
            moves.some((move) => {
              const context = contextById.get(move.contextId);
              return Boolean(
                move.actor === 'user' &&
                  move.included &&
                  context?.repertoireId === row.id &&
                  effectivelyIncluded(move.contextId),
              );
            }),
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
      return {
        availability: 'archived',
        availableRepertoireIds: [],
        unavailableRepertoireIds: [...playlist.repertoireIds],
      };
    }
    const available: string[] = [];
    const unavailable: string[] = [];
    for (const id of playlist.repertoireIds) {
      if (
        (await this.database.repertoires.get(id)) &&
        !(await this.repertoireArchived(id))
      ) {
        available.push(id);
      } else {
        unavailable.push(id);
      }
    }
    const availability: PlaylistAvailability =
      available.length === 0
        ? 'unavailable'
        : unavailable.length > 0
          ? 'partially-unavailable'
          : 'ready';
    return {
      availability,
      availableRepertoireIds: available,
      unavailableRepertoireIds: unavailable,
    };
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
    return result.sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }

  public async getPlaylist(id: string): Promise<Playlist> {
    await this.awaitPendingOperations();
    return this.getPlaylistUnsafe(id);
  }

  public renameRepertoire(
    id: string,
    name: string,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const nextName = boundedText(name, 'Repertoire name', 120);
      const row = await this.database.repertoires.get(id);
      if (!row) throw new Error(`Missing repertoire ${id}.`);
      await this.database.repertoires.put({
        ...row,
        name: nextName,
        updatedAt: now,
      });
    });
  }

  public previewRepertoireArchive(id: string): Promise<ManagementImpact> {
    return this.enqueue(async () => {
      const repertoire = await this.database.repertoires.get(id);
      if (!repertoire) throw new Error(`Missing repertoire ${id}.`);
      let blockedReason: string | undefined;
      try {
        await this.assertMutationUnlocked([id]);
      } catch (error) {
        blockedReason = error instanceof Error ? error.message : String(error);
      }
      const graph = await this.base.loadCompleteGraph();
      const affected = graph.playlists.filter((playlist) =>
        playlist.repertoireIds.includes(id),
      );
      return {
        title: `Archive ${repertoire.name}?`,
        details: [
          'The repertoire graph, move/name/contrast evidence and scheduler history will be retained.',
          affected.length > 0
            ? `${affected.length} playlist(s) will become partially or fully unavailable until this repertoire is restored.`
            : 'No playlists depend on this repertoire.',
        ],
        ...(blockedReason ? { blockedReason } : {}),
      };
    });
  }

  public archiveRepertoire(
    id: string,
    archived: boolean,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      if (!(await this.database.repertoires.get(id))) {
        throw new Error(`Missing repertoire ${id}.`);
      }
      await this.assertMutationUnlocked([id]);
      await this.database.repertoireStates.put({
        id,
        ...(archived ? { archivedAt: now } : {}),
        updatedAt: now,
      });
    });
  }

  public archivePlaylist(
    id: string,
    archived: boolean,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const playlist = await this.getPlaylistUnsafe(id);
      await this.assertMutationUnlocked(playlist.repertoireIds, [id]);
      await this.database.playlistStates.put({
        id,
        ...(archived ? { archivedAt: now } : {}),
        updatedAt: now,
      });
    });
  }
}
