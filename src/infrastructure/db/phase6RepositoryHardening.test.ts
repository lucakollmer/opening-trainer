import { describe, expect, it } from 'vitest';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import type { Playlist, RepertoireGraph } from '../../domain/repertoire/types';
import type { ReviewObservation } from '../../domain/training/session';
import { Phase6OpeningTrainerDatabase } from './phase6Database';
import { Phase6OpeningTrainerRepository } from './phase6Repository';

const LINE_PGN = `[Event "PHASE-6 hardening line"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *`;

const BRANCH_PGN = `[Event "PHASE-6 hardening branch"]

1. e4 e5 2. Nf3 (2. Bc4 Nf6) 2... Nc6 3. Bb5 a6 *`;

function candidate(id: string, name: string, pgn = LINE_PGN) {
  const result = previewPgnImport(pgn, {
    repertoireId: id,
    repertoireName: name,
    userColour: 'white',
    sourceLabel: `PHASE-6 hardening ${id}`,
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

async function repositoryFor(label: string) {
  const database = new Phase6OpeningTrainerDatabase(
    `phase6-hardening-${label}-${crypto.randomUUID()}`,
  );
  const repository = new Phase6OpeningTrainerRepository(database);
  await repository.initialize('2026-09-04T09:00:00.000Z');
  return { database, repository };
}

async function destroy(repository: Phase6OpeningTrainerRepository) {
  await repository.deleteDatabase();
}

function branchingDecision(graph: RepertoireGraph) {
  const edgeById = new Map(graph.edges.map((row) => [row.id, row]));
  const byContext = new Map<string, typeof graph.moves>();
  for (const move of graph.moves.filter((row) => row.actor === 'user')) {
    const rows = byContext.get(move.contextId) ?? [];
    rows.push(move);
    byContext.set(move.contextId, rows);
  }
  const branch = [...byContext.entries()].find(([, rows]) => rows.length >= 2);
  expect(branch).toBeDefined();
  const [contextId, rows] = branch!;
  const ordered = [...rows].sort((left, right) => {
    const leftSan = edgeById.get(left.edgeId)?.san ?? left.id;
    const rightSan = edgeById.get(right.edgeId)?.san ?? right.id;
    return leftSan.localeCompare(rightSan);
  });
  expect(ordered).toHaveLength(2);
  return {
    contextId,
    selected: ordered[0]!,
    sibling: ordered[1]!,
  };
}

function playlistForBranch(
  graph: RepertoireGraph,
  id: string,
  includedContextId: string,
  weighting: Playlist['weighting'] = { kind: 'due-first' },
): Playlist {
  const now = '2026-09-04T09:05:00.000Z';
  return {
    id,
    name: 'Narrow branch playlist',
    repertoireIds: [graph.repertoires[0]!.id],
    includedContextIds: [includedContextId],
    excludedContextIds: [],
    tags: [],
    weighting,
    createdAt: now,
    updatedAt: now,
  };
}

describe('PHASE-6 second-pass hardening', () => {
  it('keeps degraded playlists editable while preserving archived membership', async () => {
    const { repository } = await repositoryFor('degraded-playlist');
    try {
      await repository.createRepertoire(candidate('archive-a', 'Archive A'));
      await repository.createRepertoire(candidate('archive-b', 'Archive B'));
      const now = '2026-09-04T09:10:00.000Z';
      const playlist: Playlist = {
        id: 'archive-pair',
        name: 'Archive pair',
        repertoireIds: ['archive-a', 'archive-b'],
        includedContextIds: [],
        excludedContextIds: [],
        tags: [],
        weighting: { kind: 'due-first' },
        createdAt: now,
        updatedAt: now,
      };
      await repository.savePlaylist(playlist, now);
      await repository.archiveRepertoire(
        'archive-a',
        true,
        '2026-09-04T09:11:00.000Z',
      );

      await repository.savePlaylist(
        {
          ...playlist,
          name: 'Edited while degraded',
          updatedAt: '2026-09-04T09:12:00.000Z',
        },
        '2026-09-04T09:12:00.000Z',
      );

      expect((await repository.getPlaylist(playlist.id)).repertoireIds).toEqual([
        'archive-a',
        'archive-b',
      ]);
      expect(
        (await repository.listManagedPlaylists()).find(
          (row) => row.id === playlist.id,
        ),
      ).toMatchObject({
        name: 'Edited while degraded',
        availability: 'partially-unavailable',
      });
    } finally {
      await destroy(repository);
    }
  });

  it('uses the exact playlist decision identity and applies the new-item limit globally', async () => {
    const { database, repository } = await repositoryFor('scope-identities');
    try {
      const graph = await repository.createRepertoire(
        candidate('branch-rep', 'Branch repertoire', BRANCH_PGN),
      );
      const branch = branchingDecision(graph);
      const playlist = playlistForBranch(
        graph,
        'narrow-branch',
        branch.selected.destinationContextId,
      );
      await repository.savePlaylist(playlist);

      const baseRule = (await database.decisionRules.toArray()).find(
        (row) =>
          row.contextId === branch.contextId &&
          row.promptMode === 'normal' &&
          !row.playlistId,
      );
      const playlistRule = (await database.decisionRules.toArray()).find(
        (row) =>
          row.contextId === branch.contextId &&
          row.promptMode === 'normal' &&
          row.playlistId === playlist.id,
      );
      expect(baseRule).toBeDefined();
      expect(playlistRule).toBeDefined();
      expect(playlistRule!.acceptedUci).toHaveLength(1);
      expect(baseRule!.acceptedUci.length).toBeGreaterThan(
        playlistRule!.acceptedUci.length,
      );
      expect(playlistRule!.trainingItemId).not.toBe(baseRule!.trainingItemId);

      const playlistPlan = await repository.createMoveSessionPlan(
        { kind: 'playlist', id: playlist.id },
        {
          targetCount: 20,
          newItemLimit: 20,
          seed: 'exact-playlist-identity',
          now: new Date('2026-09-04T09:20:00.000Z'),
        },
      );
      const branchExercise = playlistPlan.exercises.find(
        (row) => row.descriptor.targetContextId === branch.contextId,
      );
      expect(branchExercise?.targetTrainingItemIds).toEqual([
        playlistRule!.trainingItemId,
      ]);

      await repository.createRepertoire(candidate('limit-two', 'Limit two'));
      const balanced: Playlist = {
        id: 'global-new-limit',
        name: 'Global new limit',
        repertoireIds: ['branch-rep', 'limit-two'],
        includedContextIds: [],
        excludedContextIds: [],
        tags: [],
        weighting: { kind: 'balanced' },
        createdAt: '2026-09-04T09:21:00.000Z',
        updatedAt: '2026-09-04T09:21:00.000Z',
      };
      await repository.savePlaylist(balanced);
      const limited = await repository.createMoveSessionPlan(
        { kind: 'playlist', id: balanced.id },
        {
          targetCount: 8,
          newItemLimit: 1,
          seed: 'one-new-globally',
          now: new Date('2026-09-04T09:22:00.000Z'),
        },
      );
      expect(limited.exercises.length).toBeLessThanOrEqual(1);
    } finally {
      await destroy(repository);
    }
  });

  it('keeps Browse confusion projection read-only and materializes contrast only on start', async () => {
    const { database, repository } = await repositoryFor('pure-confusions');
    try {
      const graph = await repository.createRepertoire(
        candidate('confusion-rep', 'Confusion repertoire', BRANCH_PGN),
      );
      const branch = branchingDecision(graph);
      const playlist = playlistForBranch(
        graph,
        'confusion-playlist',
        branch.selected.destinationContextId,
      );
      await repository.savePlaylist(playlist);
      const sourceRule = (await database.decisionRules.toArray()).find(
        (row) =>
          row.contextId === branch.contextId &&
          row.promptMode === 'normal' &&
          row.playlistId === playlist.id,
      );
      expect(sourceRule).toBeDefined();
      const sourceItem = await database.trainingItems.get(
        sourceRule!.trainingItemId,
      );
      expect(sourceItem).toBeDefined();

      for (const [index, observedAt] of [
        '2026-09-01T12:00:00.000Z',
        '2026-09-02T12:00:00.000Z',
      ].entries()) {
        const observation = {
          id: `pure-confusion-${index}`,
          trainingItemId: sourceItem!.id,
          sessionId: 'synthetic-confusion-session',
          observedAt,
          evidenceRole: 'targeted' as const,
          outcome: 'wrong-variation' as const,
          responseTimeMs: 1_000,
          hintLevel: 0 as const,
          illegalAttemptCount: 0,
          expectedMoveSetKey: sourceItem!.acceptedMoveSetKey,
          confusionContextId: branch.sibling.destinationContextId,
          contextId: branch.contextId,
        } satisfies ReviewObservation & { contextId: string };
        await database.reviewLogs.put(observation);
      }

      const scope = { kind: 'playlist' as const, id: playlist.id };
      const browse = await repository.browseWorkspace(scope, {
        repertoireId: 'confusion-rep',
        contextId: branch.contextId,
        now: new Date('2026-09-04T09:30:00.000Z'),
      });
      expect(browse.confusions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            expectedContextId: branch.contextId,
            confusedContextId: branch.sibling.destinationContextId,
            countInWindow: 2,
            contrastDue: true,
          }),
        ]),
      );
      expect(await database.contrastItems.count()).toBe(0);
      expect(await database.contrastSchedulerStates.count()).toBe(0);

      const prompt = await repository.startContrastSession(scope, {
        targetCount: 1,
        now: new Date('2026-09-04T09:31:00.000Z'),
      });
      expect(prompt.expectedContextId).toBe(branch.contextId);
      expect(await database.contrastItems.count()).toBe(1);
      expect(await database.contrastSchedulerStates.count()).toBe(1);
    } finally {
      await destroy(repository);
    }
  });

  it('enforces one active recall session across move, name, and contrast controllers', async () => {
    const { repository } = await repositoryFor('single-active');
    try {
      const graph = await repository.createRepertoire(
        candidate('active-rep', 'Active repertoire'),
      );
      const root = graph.repertoires[0]!.rootContextIds[0]!;
      await repository.saveOpeningName(root, 'King Pawn Opening', []);
      const prompt = await repository.startNameSession(
        { kind: 'repertoire', id: 'active-rep' },
        { targetCount: 1, now: new Date('2026-09-04T09:40:00.000Z') },
      );

      await expect(
        repository.startNameSession(
          { kind: 'repertoire', id: 'active-rep' },
          { targetCount: 1, now: new Date('2026-09-04T09:41:00.000Z') },
        ),
      ).rejects.toThrow(/ACTIVE_RECALL_SESSION/u);
      await expect(
        repository.createMoveSessionPlan(
          { kind: 'repertoire', id: 'active-rep' },
          { targetCount: 1, newItemLimit: 1 },
        ),
      ).rejects.toThrow(/ACTIVE_RECALL_SESSION/u);
      await expect(
        repository.startContrastSession(
          { kind: 'repertoire', id: 'active-rep' },
          { targetCount: 1, now: new Date('2026-09-04T09:41:30.000Z') },
        ),
      ).rejects.toThrow(/ACTIVE_RECALL_SESSION/u);

      await repository.abandonNameSession(prompt.sessionId);
      await expect(
        repository.createMoveSessionPlan(
          { kind: 'repertoire', id: 'active-rep' },
          { targetCount: 1, newItemLimit: 1 },
        ),
      ).resolves.toBeDefined();
    } finally {
      await destroy(repository);
    }
  });

  it('reconciles existing playlists during initialization without changing membership', async () => {
    const { database, repository } = await repositoryFor('initialize-playlist');
    try {
      const graph = await repository.createRepertoire(
        candidate('initialize-rep', 'Initialize repertoire', BRANCH_PGN),
      );
      const branch = branchingDecision(graph);
      const playlist = playlistForBranch(
        graph,
        'initialize-playlist',
        branch.selected.destinationContextId,
      );
      await repository.savePlaylist(playlist, '2026-09-04T09:50:00.000Z');
      const ruleIds = (await database.decisionRules.toArray())
        .filter((row) => row.playlistId === playlist.id)
        .map((row) => row.id);
      expect(ruleIds.length).toBeGreaterThan(0);
      await database.decisionRules.bulkDelete(ruleIds);
      expect(
        (await database.decisionRules.toArray()).filter(
          (row) => row.playlistId === playlist.id,
        ),
      ).toHaveLength(0);

      await repository.initialize('2026-09-04T09:51:00.000Z');

      expect(
        (await database.decisionRules.toArray()).filter(
          (row) => row.playlistId === playlist.id,
        ).length,
      ).toBeGreaterThan(0);
      expect((await repository.getPlaylist(playlist.id)).repertoireIds).toEqual([
        'initialize-rep',
      ]);
    } finally {
      await destroy(repository);
    }
  });

  it('normalizes legacy repertoire archive flags into reversible PHASE-6 lifecycle state', async () => {
    const { database, repository } = await repositoryFor('legacy-archive');
    try {
      await repository.createRepertoire(
        candidate('legacy-archive-rep', 'Legacy archive repertoire'),
      );
      const row = await database.repertoires.get('legacy-archive-rep');
      expect(row).toBeDefined();
      await database.repertoireStates.delete('legacy-archive-rep');
      await database.repertoires.put({
        ...row!,
        archivedAt: '2026-09-04T09:55:00.000Z',
      });

      await repository.initialize('2026-09-04T09:56:00.000Z');

      expect((await database.repertoires.get('legacy-archive-rep'))?.archivedAt).toBeUndefined();
      expect(
        (await database.repertoireStates.get('legacy-archive-rep'))?.archivedAt,
      ).toBe('2026-09-04T09:55:00.000Z');
      await repository.archiveRepertoire(
        'legacy-archive-rep',
        false,
        '2026-09-04T09:57:00.000Z',
      );
      expect(
        (await repository.listManagedRepertoires()).find(
          (item) => item.id === 'legacy-archive-rep',
        )?.archived,
      ).toBe(false);
    } finally {
      await destroy(repository);
    }
  });

});
