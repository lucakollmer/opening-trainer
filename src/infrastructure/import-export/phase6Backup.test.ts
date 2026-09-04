import { describe, expect, it } from 'vitest';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import { OpeningTrainerDatabase } from '../db/openingTrainerDatabase';
import { OpeningTrainerRepository } from '../db/openingTrainerRepository';
import {
  Phase6OpeningTrainerDatabase,
  PHASE6_DATABASE_SCHEMA_VERSION,
  PHASE6_PORTABLE_SCHEMA_VERSION,
} from '../db/phase6Database';
import { Phase6OpeningTrainerRepository } from '../db/phase6Repository';
import {
  commitPhase6BackupRestore,
  previewPhase6BackupJson,
} from './phase6Backup';
import { exportCompleteBackup } from './backup';

const PGN = `[Event "backup test"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 *`;

function candidate(id: string, name: string) {
  const result = previewPgnImport(PGN, {
    repertoireId: id,
    repertoireName: name,
    userColour: 'white',
    sourceLabel: `Backup fixture ${id}`,
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

describe('PHASE-6 complete backup', () => {
  it('accepts a PHASE-5 v2 backup and restores it into empty PHASE-6 tables', async () => {
    const sourceDatabase = new OpeningTrainerDatabase(
      `phase6-v2-source-${crypto.randomUUID()}`,
    );
    const source = new OpeningTrainerRepository(sourceDatabase);
    const targetDatabase = new Phase6OpeningTrainerDatabase(
      `phase6-v2-target-${crypto.randomUUID()}`,
    );
    const target = new Phase6OpeningTrainerRepository(targetDatabase);
    try {
      await source.initialize('2026-09-03T09:00:00.000Z');
      await source.createRepertoire(
        candidate('legacy-v2-rep', 'Legacy v2 repertoire'),
        '2026-09-03T09:01:00.000Z',
      );
      const { json } = await exportCompleteBackup(
        sourceDatabase,
        '2026-09-03T09:02:00.000Z',
      );

      await target.initialize('2026-09-03T10:00:00.000Z');
      const preview = target.previewBackupJson(json);
      expect(preview.warnings.length).toBeGreaterThan(0);
      await target.restoreCompleteBackup(
        preview,
        '2026-09-03T10:01:00.000Z',
      );
      expect((await target.listManagedRepertoires()).map((row) => row.id)).toEqual([
        'legacy-v2-rep',
      ]);
      expect(await targetDatabase.nameReviewLogs.count()).toBe(0);
      expect(await targetDatabase.contrastReviewLogs.count()).toBe(0);
      const meta = await targetDatabase.meta.get('database');
      expect(meta?.databaseSchemaVersion).toBe(PHASE6_DATABASE_SCHEMA_VERSION);
      expect(meta?.portableSchemaVersion).toBe(PHASE6_PORTABLE_SCHEMA_VERSION);
    } finally {
      await source.deleteDatabase();
      await target.deleteDatabase();
    }
  });

  it('round-trips PHASE-6 archive and name state and rolls back a failed restore atomically', async () => {
    const sourceDatabase = new Phase6OpeningTrainerDatabase(
      `phase6-v3-source-${crypto.randomUUID()}`,
    );
    const source = new Phase6OpeningTrainerRepository(sourceDatabase);
    const targetDatabase = new Phase6OpeningTrainerDatabase(
      `phase6-v3-target-${crypto.randomUUID()}`,
    );
    const target = new Phase6OpeningTrainerRepository(targetDatabase);
    try {
      await source.initialize('2026-09-03T11:00:00.000Z');
      const graph = await source.createRepertoire(
        candidate('v3-rep', 'V3 repertoire'),
        '2026-09-03T11:01:00.000Z',
      );
      const root = graph.repertoires[0]!.rootContextIds[0]!;
      await source.saveOpeningName(
        root,
        "Queen's Gambit",
        ['QG'],
        '2026-09-03T11:02:00.000Z',
      );
      await source.archiveRepertoire(
        'v3-rep',
        true,
        '2026-09-03T11:03:00.000Z',
      );
      const exported = await source.exportCompleteBackup(
        '2026-09-03T11:04:00.000Z',
      );

      await target.initialize('2026-09-03T12:00:00.000Z');
      await target.createRepertoire(
        candidate('preexisting', 'Pre-existing target data'),
        '2026-09-03T12:01:00.000Z',
      );
      const preview = target.previewBackupJson(exported.json);
      await expect(
        commitPhase6BackupRestore(targetDatabase, preview, {
          restoredAt: '2026-09-03T12:02:00.000Z',
          injectFailureBeforeCommit: () => {
            throw new Error('synthetic restore failure');
          },
        }),
      ).rejects.toThrow(/synthetic restore failure/u);
      expect(await targetDatabase.repertoires.get('preexisting')).toBeDefined();
      expect(await targetDatabase.repertoires.get('v3-rep')).toBeUndefined();

      await target.restoreCompleteBackup(
        preview,
        '2026-09-03T12:03:00.000Z',
      );
      expect(await targetDatabase.repertoires.get('preexisting')).toBeUndefined();
      expect(
        (await target.listManagedRepertoires()).find((row) => row.id === 'v3-rep'),
      ).toMatchObject({ archived: true });
      expect(await targetDatabase.managedOpeningNames.count()).toBe(1);
      expect((await targetDatabase.managedOpeningNames.toArray())[0]).toMatchObject({
        primaryLabel: "Queen's Gambit",
        aliases: ['QG'],
      });
    } finally {
      await source.deleteDatabase();
      await target.deleteDatabase();
    }
  });
});
