import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import type { Playlist } from '../../domain/repertoire/types';
import { phase3DemoPgn } from '../../fixtures/phase3Demo';
import { MAX_BACKUP_BYTES, previewBackupJson } from '../import-export/backup';
import { OpeningTrainerDatabase } from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';

function candidate(id: string) {
  const result = previewPgnImport(phase3DemoPgn, {
    repertoireId: id,
    repertoireName: id,
    userColour: 'white',
    sourceLabel: 'PHASE-4 repository hardening test',
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

async function repository() {
  const database = new OpeningTrainerDatabase(
    `opening-trainer-phase4-repository-${crypto.randomUUID()}`,
  );
  const result = new OpeningTrainerRepository(database);
  await result.initialize('2026-08-27T17:00:00.000Z');
  return result;
}

async function dispose(result: OpeningTrainerRepository) {
  await result.deleteDatabase();
}

describe('PHASE-4 repository hardening', () => {
  it('keeps independent imports with identical candidate-local IDs isolated', async () => {
    const result = await repository();
    try {
      const first = await result.createRepertoire(
        candidate('coexist-a'),
        '2026-08-27T17:01:00.000Z',
      );
      const second = await result.createRepertoire(
        candidate('coexist-b'),
        '2026-08-27T17:02:00.000Z',
      );

      expect(await result.database.repertoires.count()).toBe(2);
      expect(await result.database.positions.count()).toBe(first.positions.length);
      expect(await result.database.repertoireContexts.count()).toBe(
        first.contexts.length + second.contexts.length,
      );
      expect(
        (await result.loadRepertoireGraph('coexist-a')).contexts.every((context) =>
          context.id.includes('coexist-a'),
        ),
      ).toBe(true);
      expect(
        (await result.loadRepertoireGraph('coexist-b')).contexts.every((context) =>
          context.id.includes('coexist-b'),
        ),
      ).toBe(true);
    } finally {
      await dispose(result);
    }
  });

  it('replaces playlist membership atomically and preserves the last valid state', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(
        candidate('playlist-repertoire'),
        '2026-08-27T17:03:00.000Z',
      );
      const context =
        graph.contexts.find((item) => item.parentContextId) ?? graph.contexts[0]!;
      const initial: Playlist = {
        id: 'playlist-focus',
        name: 'Focus',
        repertoireIds: ['playlist-repertoire'],
        includedContextIds: [context.id],
        excludedContextIds: [],
        tags: ['focus'],
        weighting: { kind: 'balanced' },
        createdAt: '2026-08-27T17:04:00.000Z',
        updatedAt: '2026-08-27T17:04:00.000Z',
      };
      await result.savePlaylist(initial, '2026-08-27T17:04:00.000Z');

      const updated: Playlist = {
        ...initial,
        name: 'Exclude branch',
        includedContextIds: [],
        excludedContextIds: [context.id],
        tags: [],
        weighting: { kind: 'due-first' },
      };
      await result.savePlaylist(updated, '2026-08-27T17:05:00.000Z');

      const saved = await result.database.playlists.get(initial.id);
      const entries = await result.database.playlistEntries
        .where('playlistId')
        .equals(initial.id)
        .sortBy('order');
      expect(saved).toMatchObject({
        id: initial.id,
        name: 'Exclude branch',
        weighting: { kind: 'due-first' },
        createdAt: '2026-08-27T17:04:00.000Z',
        updatedAt: '2026-08-27T17:05:00.000Z',
      });
      expect(entries.map((entry) => [entry.kind, entry.value])).toEqual([
        ['repertoire', 'playlist-repertoire'],
        ['exclude-context', context.id],
      ]);
      const validState = structuredClone({ saved, entries });

      await expect(
        result.savePlaylist(
          { ...updated, includedContextIds: ['missing-context'] },
          '2026-08-27T17:06:00.000Z',
        ),
      ).rejects.toThrow(/missing context/u);
      expect({
        saved: await result.database.playlists.get(initial.id),
        entries: await result.database.playlistEntries
          .where('playlistId')
          .equals(initial.id)
          .sortBy('order'),
      }).toEqual(validState);
    } finally {
      await dispose(result);
    }
  });

  it('enforces the agreed five-megabyte backup preview ceiling', () => {
    expect(MAX_BACKUP_BYTES).toBe(5_000_000);
    expect(() => previewBackupJson(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow(
      /exceeds/u,
    );
  });
});
