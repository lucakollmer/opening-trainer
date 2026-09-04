import { describe, expect, it } from 'vitest';
import { createPhase6GraphExercisePlan } from '../../domain/phase6/exercisePlan';
import { createGraphTrainingSession } from '../../domain/repertoire/trainingIntegration';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import type { Playlist } from '../../domain/repertoire/types';
import { Phase6OpeningTrainerDatabase } from './phase6Database';
import { Phase6OpeningTrainerRepository } from './phase6Repository';

const TEST_PGN = `[Event "PHASE-6 test"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *`;

function importCandidate(id: string, name: string) {
  const candidate = previewPgnImport(TEST_PGN, {
    repertoireId: id,
    repertoireName: name,
    userColour: 'white',
    sourceLabel: `PHASE-6 test ${id}`,
  });
  expect(candidate.errors).toHaveLength(0);
  return candidate;
}

async function createRepository(label: string) {
  const database = new Phase6OpeningTrainerDatabase(
    `phase6-${label}-${crypto.randomUUID()}`,
  );
  const repository = new Phase6OpeningTrainerRepository(database);
  await repository.initialize('2026-09-03T12:00:00.000Z');
  return { database, repository };
}

async function destroy(repository: Phase6OpeningTrainerRepository) {
  await repository.deleteDatabase();
}

function flattenTree<T extends { children: readonly T[] }>(roots: readonly T[]): T[] {
  const result: T[] = [];
  const visit = (nodes: readonly T[]) => {
    for (const node of nodes) {
      result.push(node);
      visit(node.children);
    }
  };
  visit(roots);
  return result;
}

describe('PHASE-6 repository hardening', () => {
  it('supports multi-repertoire balanced playlists and reversible archive dependencies', async () => {
    const { repository } = await createRepository('multi-playlist');
    try {
      const first = await repository.createRepertoire(
        importCandidate('rep-one', 'First repertoire'),
        '2026-09-03T12:01:00.000Z',
      );
      const second = await repository.createRepertoire(
        importCandidate('rep-two', 'Second repertoire'),
        '2026-09-03T12:02:00.000Z',
      );
      const playlist: Playlist = {
        id: 'both-repertoires',
        name: 'Both repertoires',
        repertoireIds: [first.repertoires[0]!.id, second.repertoires[0]!.id],
        includedContextIds: [],
        excludedContextIds: [],
        tags: [],
        weighting: { kind: 'balanced' },
        createdAt: '2026-09-03T12:03:00.000Z',
        updatedAt: '2026-09-03T12:03:00.000Z',
      };
      await repository.savePlaylist(playlist, '2026-09-03T12:03:00.000Z');
      const plan = await repository.createMoveSessionPlan(
        { kind: 'playlist', id: playlist.id },
        {
          targetCount: 6,
          newItemLimit: 6,
          seed: 'balanced-multi-repertoire',
          now: new Date('2026-09-03T12:04:00.000Z'),
        },
      );
      expect(
        new Set(plan.exercises.map((exercise) => exercise.descriptor.repertoireId)),
      ).toEqual(new Set(['rep-one', 'rep-two']));

      await repository.archiveRepertoire(
        'rep-one',
        true,
        '2026-09-03T12:05:00.000Z',
      );
      expect(
        (await repository.listManagedPlaylists()).find(
          (row) => row.id === playlist.id,
        )?.availability,
      ).toBe('partially-unavailable');
      await repository.archiveRepertoire(
        'rep-one',
        false,
        '2026-09-03T12:06:00.000Z',
      );
      expect(
        (await repository.listManagedPlaylists()).find(
          (row) => row.id === playlist.id,
        )?.availability,
      ).toBe('ready');
      expect((await repository.getPlaylist(playlist.id)).repertoireIds).toEqual([
        'rep-one',
        'rep-two',
      ]);
    } finally {
      await destroy(repository);
    }
  });

  it('locks semantic management while a name session is active and keeps excluded branches browsable without review evidence', async () => {
    const { database, repository } = await createRepository('lock-browse');
    try {
      const graph = await repository.createRepertoire(
        importCandidate('lock-rep', 'Lock repertoire'),
        '2026-09-03T12:01:00.000Z',
      );
      const root = graph.repertoires[0]!.rootContextIds[0]!;
      await repository.saveOpeningName(
        root,
        'King Pawn Opening',
        [],
        '2026-09-03T12:02:00.000Z',
      );
      const prompt = await repository.startNameSession(
        { kind: 'repertoire', id: 'lock-rep' },
        { targetCount: 1, now: new Date('2026-09-03T12:03:00.000Z') },
      );
      await expect(
        repository.updateBranchInclusion(
          root,
          false,
          '2026-09-03T12:04:00.000Z',
        ),
      ).rejects.toThrow(/SESSION_SCOPE_LOCKED/u);
      await repository.abandonNameSession(
        prompt.sessionId,
        '2026-09-03T12:04:30.000Z',
      );

      const reviewCount = await database.reviewLogs.count();
      await repository.updateBranchInclusion(
        root,
        false,
        '2026-09-03T12:05:00.000Z',
      );
      const browse = await repository.browseWorkspace(
        { kind: 'repertoire', id: 'lock-rep' },
        { contextId: root, now: new Date('2026-09-03T12:06:00.000Z') },
      );
      const rootNode = flattenTree(browse.tree).find(
        (node) => node.contextId === root,
      );
      expect(rootNode).toMatchObject({
        explicitIncluded: false,
        effectiveIncluded: false,
      });
      expect(browse.selectedContextId).toBe(root);
      expect(await database.reviewLogs.count()).toBe(reviewCount);
      expect(await database.nameReviewLogs.count()).toBe(0);
      expect(await database.contrastReviewLogs.count()).toBe(0);
    } finally {
      await destroy(repository);
    }
  });

  it('reconstructs an interrupted non-adaptive PHASE-5 move session without changing its plan identity', async () => {
    const { repository } = await createRepository('legacy-move-recovery');
    try {
      const graph = await repository.createRepertoire(
        importCandidate('legacy-rep', 'Legacy recovery repertoire'),
        '2026-09-03T12:01:00.000Z',
      );
      const activeItem = (await repository.database.trainingItems.toArray()).find(
        (row) =>
          row.repertoireId === 'legacy-rep' &&
          row.promptMode === 'normal' &&
          row.status === 'active',
      )!;
      const targetContextId = activeItem.contextIds[0]!;
      const contextById = new Map(graph.contexts.map((row) => [row.id, row]));
      const path: string[] = [];
      let current = contextById.get(targetContextId);
      while (current) {
        path.push(current.id);
        current = current.parentContextId
          ? contextById.get(current.parentContextId)
          : undefined;
      }
      const rootContextId = path.at(-1)!;
      const plan = createPhase6GraphExercisePlan(graph, {
        repertoireId: 'legacy-rep',
        rootContextId,
        targetContextId,
        targetContextIds: [targetContextId],
        promptMode: 'normal',
      });
      const state = createGraphTrainingSession(plan, 1_000, {
        sessionId: 'legacy-non-adaptive-session',
      });
      await repository.saveMoveSession(state, '2026-09-03T12:02:00.000Z');
      const saved = await repository.latestInterruptedMoveSession();
      expect(saved?.state.adaptive).toBeUndefined();
      const rebuilt = await repository.rebuildLegacyMoveSession(saved!);
      expect(rebuilt.scope).toEqual({ kind: 'repertoire', id: 'legacy-rep' });
      expect(rebuilt.exercise.plan.id).toBe(plan.id);
      expect(rebuilt.exercise.plan.id).toBe(saved!.planId);
      expect(rebuilt.exercise.descriptor.targetContextId).toBe(targetContextId);
    } finally {
      await destroy(repository);
    }
  });

  it('schedules opening names independently and supersedes changed answer sets without rewriting history', async () => {
    const { database, repository } = await createRepository('names');
    try {
      const graph = await repository.createRepertoire(
        importCandidate('name-rep', 'Name repertoire'),
        '2026-09-03T12:01:00.000Z',
      );
      const root = graph.repertoires[0]!.rootContextIds[0]!;
      await repository.saveOpeningName(
        root,
        'King Pawn Opening',
        ['King Pawn Game'],
        '2026-09-03T12:02:00.000Z',
      );
      const moveStateBefore = structuredClone(
        await database.schedulerStates.toArray(),
      );
      const moveReviewsBefore = await database.reviewLogs.count();
      const prompt = await repository.startNameSession(
        { kind: 'repertoire', id: 'name-rep' },
        { targetCount: 1, now: new Date('2026-09-03T12:03:00.000Z') },
      );
      expect(prompt).not.toHaveProperty('expectedPrimaryLabel');
      const result = await repository.reviewName(
        prompt.sessionId,
        prompt.itemIndex,
        'not the opening',
        2_000,
        { observedAt: '2026-09-03T12:04:00.000Z' },
      );
      expect(result).toMatchObject({ accepted: false, outcome: 'incorrect' });
      expect(await database.schedulerStates.toArray()).toEqual(moveStateBefore);
      expect(await database.reviewLogs.count()).toBe(moveReviewsBefore);
      expect(await database.nameReviewLogs.count()).toBe(1);

      const oldActive = (await database.nameTrainingItems.toArray()).find(
        (row) => row.status === 'active',
      )!;
      await repository.saveOpeningName(
        root,
        'Open Game',
        [],
        '2026-09-03T12:05:00.000Z',
      );
      const items = await database.nameTrainingItems.toArray();
      expect(items.find((row) => row.id === oldActive.id)?.status).toBe(
        'superseded',
      );
      expect(items.find((row) => row.status === 'active')?.primaryLabel).toBe(
        'Open Game',
      );
      expect(await database.nameReviewLogs.count()).toBe(1);
    } finally {
      await destroy(repository);
    }
  });
});
