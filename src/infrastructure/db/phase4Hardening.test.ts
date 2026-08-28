import { createGraphExercisePlan } from '../../domain/repertoire/exercisePlan';
import { contextPly } from '../../domain/repertoire/graph';
import {
  MAX_PGN_GAMES,
  MAX_PGN_VARIATION_DEPTH,
  previewPgnImport,
} from '../../domain/repertoire/pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from '../../domain/repertoire/trainingIntegration';
import type { RepertoireGraph } from '../../domain/repertoire/types';
import { phase3DemoPgn } from '../../fixtures/phase3Demo';
import {
  MAX_BACKUP_BYTES,
  previewBackupJson,
  verifyBackupIntegrity,
} from '../import-export/backup';
import { OpeningTrainerDatabase } from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';

function candidate(id: string, name = id) {
  const result = previewPgnImport(phase3DemoPgn, {
    repertoireId: id,
    repertoireName: name,
    userColour: 'white',
    sourceLabel: 'PHASE-4 final hardening regression',
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

async function repository() {
  const result = new OpeningTrainerRepository(
    new OpeningTrainerDatabase(`opening-trainer-hardening-${crypto.randomUUID()}`),
  );
  await result.initialize('2026-08-28T09:10:00.000Z');
  return result;
}

function deepestUserTarget(graph: RepertoireGraph): {
  rootContextId: string;
  targetContextId: string;
} {
  const repertoire = graph.repertoires[0]!;
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const userContextIds = new Set(
    graph.moves
      .filter((move) => move.actor === 'user' && move.included)
      .map((move) => move.contextId),
  );
  const target = graph.contexts
    .filter((context) => userContextIds.has(context.id))
    .sort(
      (a, b) =>
        contextPly(b, contexts) - contextPly(a, contexts) || a.id.localeCompare(b.id),
    )[0]!;
  return {
    rootContextId: repertoire.rootContextIds[0]!,
    targetContextId: target.id,
  };
}

function progressedSession(graph: RepertoireGraph, sessionId: string) {
  const repertoire = graph.repertoires[0]!;
  const plan = createGraphExercisePlan(graph, {
    repertoireId: repertoire.id,
    ...deepestUserTarget(graph),
  });
  return reduceGraphTrainingSession(
    createGraphTrainingSession(plan, 1_000, { sessionId }),
    plan,
    {
      type: 'user-move',
      move: { from: 'e2', to: 'e4' },
      nowMs: 1_500,
    },
  );
}

describe('PHASE-4 final persistence hardening', () => {
  it('waits for a pending session write before taking a complete backup snapshot', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('barrier-export'));
      const pendingSave = result.saveSession(
        progressedSession(graph, 'barrier-export-session'),
        '2026-08-28T09:11:00.000Z',
      );
      const exported = await result.exportCompleteBackup('2026-08-28T09:12:00.000Z');
      await pendingSave;
      const preview = previewBackupJson(exported.json);
      expect(preview.summary.sessions).toBe(1);
      expect(preview.summary.reviewLogs).toBe(1);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('drops stale session writes requested after a restore has begun', async () => {
    const source = await repository();
    const target = await repository();
    try {
      await source.createRepertoire(candidate('restore-new', 'Restored new data'));
      const sourceBackup = previewBackupJson(
        (await source.exportCompleteBackup('2026-08-28T09:13:00.000Z')).json,
      );

      const oldGraph = await target.createRepertoire(candidate('restore-old', 'Old data'));
      const staleSession = progressedSession(oldGraph, 'stale-after-restore');
      const restore = target.restoreCompleteBackup(
        sourceBackup,
        '2026-08-28T09:14:00.000Z',
      );
      const lateSave = target.saveSession(staleSession, '2026-08-28T09:14:01.000Z');
      await Promise.all([restore, lateSave]);

      expect(await target.database.reviewLogs.count()).toBe(0);
      expect(await target.database.sessions.count()).toBe(0);
      expect((await target.listRepertoireGraphs())[0]?.repertoires[0]?.name).toBe(
        'Restored new data',
      );
    } finally {
      await source.deleteDatabase();
      await target.deleteDatabase();
    }
  });

  it('embeds SHA-256 in new backups and detects a structurally valid modification', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('digest-repertoire'));
      const exported = await result.exportCompleteBackup('2026-08-28T09:15:00.000Z');
      expect(exported.backup.integrity).toMatchObject({ algorithm: 'SHA-256' });
      expect(exported.backup.integrity?.digest).toMatch(/^[a-f0-9]{64}$/u);
      await expect(verifyBackupIntegrity(previewBackupJson(exported.json))).resolves.toBeUndefined();

      const tampered = JSON.parse(exported.json) as {
        exportedAt: string;
      };
      tampered.exportedAt = '2026-08-28T09:15:01.000Z';
      await expect(
        verifyBackupIntegrity(previewBackupJson(JSON.stringify(tampered))),
      ).rejects.toThrow(/SHA-256 verification failed/u);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('refuses to export a complete backup that exceeds the restore ceiling', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('oversized-export'));
      await result.putSetting('oversized-setting', 'x'.repeat(MAX_BACKUP_BYTES));
      await expect(
        result.exportCompleteBackup('2026-08-28T09:16:00.000Z'),
      ).rejects.toThrow(/No backup file was created/u);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('rejects invalid supplemental row enums before restore', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('strict-schema'));
      await result.saveSession(
        progressedSession(graph, 'strict-schema-session'),
        '2026-08-28T09:17:00.000Z',
      );
      const exported = await result.exportCompleteBackup('2026-08-28T09:18:00.000Z');
      const malformed = JSON.parse(exported.json) as {
        data: { reviewLogs: Array<{ outcome: string }> };
      };
      malformed.data.reviewLogs[0]!.outcome = 'not-a-training-outcome';
      expect(() => previewBackupJson(JSON.stringify(malformed))).toThrow(
        /unsupported value/u,
      );
    } finally {
      await result.deleteDatabase();
    }
  });
});

describe('PHASE-4 bounded PGN parsing', () => {
  it('rejects excessive game counts before graph construction', () => {
    const game = '[Event "Limit"]\n\n1. e4 *\n';
    const result = previewPgnImport(game.repeat(MAX_PGN_GAMES + 1), {
      repertoireId: 'too-many-games',
      repertoireName: 'Too many games',
      userColour: 'white',
    });
    expect(result.errors[0]?.message).toMatch(/game/u);
  });

  it('rejects excessive recursive variation depth', () => {
    const nested =
      '1. e4' +
      ' (1. d4'.repeat(MAX_PGN_VARIATION_DEPTH + 1) +
      ')'.repeat(MAX_PGN_VARIATION_DEPTH + 1) +
      ' *';
    const result = previewPgnImport(nested, {
      repertoireId: 'too-deep',
      repertoireName: 'Too deep',
      userColour: 'white',
    });
    expect(result.errors[0]?.message).toMatch(/variation nesting/u);
  });
});
