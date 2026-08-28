import { createGraphExercisePlan } from '../../domain/repertoire/exercisePlan';
import { contextPly } from '../../domain/repertoire/graph';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from '../../domain/repertoire/trainingIntegration';
import type { RepertoireGraph } from '../../domain/repertoire/types';
import { phase3DemoPgn } from '../../fixtures/phase3Demo';
import {
  commitBackupRestore,
  exportCompleteBackup,
  previewBackupJson,
  validateDatabaseIntegrity,
} from '../import-export/backup';
import { exportRepertoirePgn } from '../import-export/pgnExport';
import { OpeningTrainerDatabase } from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';

function candidate(
  id = `test-repertoire-${crypto.randomUUID()}`,
  name = 'Persisted repertoire',
) {
  const result = previewPgnImport(phase3DemoPgn, {
    repertoireId: id,
    repertoireName: name,
    userColour: 'white',
    sourceLabel: 'PHASE-4 synthetic persistence test',
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

async function repository() {
  const database = new OpeningTrainerDatabase(
    `opening-trainer-phase4-${crypto.randomUUID()}`,
  );
  const result = new OpeningTrainerRepository(database);
  await result.initialize('2026-08-27T15:00:00.000Z');
  return result;
}

async function dispose(result: OpeningTrainerRepository) {
  await result.deleteDatabase();
}

function canonicalGraphContent(graph: RepertoireGraph): RepertoireGraph {
  const byId = <T extends { id: string }>(rows: readonly T[]) =>
    [...rows].sort((left, right) => left.id.localeCompare(right.id));
  return {
    repertoires: byId(graph.repertoires),
    positions: byId(graph.positions),
    edges: byId(graph.edges),
    contexts: byId(graph.contexts),
    moves: byId(graph.moves),
    playlists: byId(graph.playlists),
  };
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

describe('PHASE-4 Opening Trainer persistence', () => {
  it('creates a truly absent production schema without synthetic user data', async () => {
    const result = await repository();
    try {
      expect(await result.database.meta.count()).toBe(1);
      expect(await result.database.repertoires.count()).toBe(0);
      expect(await result.database.reviewLogs.count()).toBe(0);
      expect(await result.database.sessions.count()).toBe(0);
    } finally {
      await dispose(result);
    }
  });

  it('commits a canonical graph transactionally and reconstructs it after reload', async () => {
    const result = await repository();
    try {
      const stored = await result.createRepertoire(
        candidate('persist-roundtrip'),
        '2026-08-27T15:01:00.000Z',
      );
      expect(
        stored.positions.every((position) => position.id.startsWith('position:')),
      ).toBe(true);
      expect(
        stored.contexts.every((context) => context.id.includes('persist-roundtrip')),
      ).toBe(true);
      result.close();
      await result.initialize('2026-08-27T15:02:00.000Z');
      const after = await result.loadRepertoireGraph('persist-roundtrip');
      expect(canonicalGraphContent(after)).toEqual(canonicalGraphContent(stored));
      expect(await result.database.trainingItems.count()).toBeGreaterThan(0);
      expect(await result.database.decisionRules.count()).toBeGreaterThan(0);
    } finally {
      await dispose(result);
    }
  });

  it('updates branch inclusion and derived training identity in one transaction', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('branch-atomic'));
      const branch = graph.contexts.find(
        (context) =>
          graph.moves.filter(
            (move) => move.contextId === context.id && move.actor === 'user',
          ).length > 1,
      );
      expect(branch).toBeDefined();
      const alternative = graph.moves.find(
        (move) => move.contextId === branch!.id && move.actor === 'user',
      )!;
      await result.updateBranchInclusion(
        alternative.destinationContextId,
        false,
        '2026-08-27T15:03:00.000Z',
      );
      const changed = await result.loadRepertoireGraph('branch-atomic');
      expect(
        changed.contexts.find(
          (context) => context.id === alternative.destinationContextId,
        )?.included,
      ).toBe(false);
      const rules = await result.database.decisionRules
        .where('repertoireId')
        .equals('branch-atomic')
        .toArray();
      expect(
        rules.every((rule) => rule.contextId !== alternative.destinationContextId),
      ).toBe(true);
      await validateDatabaseIntegrity(result.database);
    } finally {
      await dispose(result);
    }
  });

  it('persists interrupted sessions and commits raw review evidence idempotently', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('session-idempotency'));
      const repertoire = graph.repertoires[0]!;
      const target = deepestUserTarget(graph);
      const plan = createGraphExercisePlan(graph, {
        repertoireId: repertoire.id,
        ...target,
      });
      const started = createGraphTrainingSession(plan, 1_000, {
        sessionId: 'session-idempotency-1',
      });
      const progressed = reduceGraphTrainingSession(started, plan, {
        type: 'user-move',
        move: { from: 'e2', to: 'e4' },
        nowMs: 1_500,
      });
      expect(progressed.evidence).toHaveLength(1);
      await result.saveSession(progressed, '2026-08-27T15:04:00.000Z');
      await result.saveSession(progressed, '2026-08-27T15:04:01.000Z');
      expect(await result.database.reviewLogs.count()).toBe(1);
      expect(await result.database.sessions.count()).toBe(1);
      const interrupted = await result.latestInterruptedSession();
      expect(interrupted?.id).toBe('session-idempotency-1');
      expect(interrupted?.committedObservationIds).toEqual([
        progressed.evidence[0]!.id,
      ]);
    } finally {
      await dispose(result);
    }
  });

  it('exports deterministic complete JSON and round-trips it into a clean database', async () => {
    const source = await repository();
    const target = await repository();
    try {
      const graph = await source.createRepertoire(candidate('backup-roundtrip'));
      const repertoire = graph.repertoires[0]!;
      const targetIds = deepestUserTarget(graph);
      const plan = createGraphExercisePlan(graph, {
        repertoireId: repertoire.id,
        ...targetIds,
      });
      const progressed = reduceGraphTrainingSession(
        createGraphTrainingSession(plan, 1_000, { sessionId: 'backup-session' }),
        plan,
        {
          type: 'user-move',
          move: { from: 'e2', to: 'e4' },
          nowMs: 1_400,
        },
      );
      await source.saveSession(progressed, '2026-08-27T15:05:00.000Z');
      await source.putSetting('board-orientation', 'white', '2026-08-27T15:05:00.000Z');

      const first = await exportCompleteBackup(
        source.database,
        '2026-08-27T15:06:00.000Z',
      );
      const second = await exportCompleteBackup(
        source.database,
        '2026-08-27T15:06:00.000Z',
      );
      expect(second.json).toBe(first.json);
      const preview = previewBackupJson(first.json);
      expect(preview.summary).toMatchObject({
        repertoires: 1,
        reviewLogs: 1,
        sessions: 1,
        settings: 1,
      });
      expect(preview.summary.trainingItems).toBeGreaterThan(0);

      await commitBackupRestore(target.database, preview, {
        restoredAt: '2026-08-27T15:07:00.000Z',
      });
      await validateDatabaseIntegrity(target.database);
      const targetExport = await exportCompleteBackup(
        target.database,
        '2026-08-27T15:06:00.000Z',
      );
      expect(previewBackupJson(targetExport.json).backup.data).toEqual(
        preview.backup.data,
      );
    } finally {
      await dispose(source);
      await dispose(target);
    }
  });

  it('rejects future backups before mutation and rolls back an injected restore failure', async () => {
    const source = await repository();
    const target = await repository();
    try {
      await source.createRepertoire(candidate('restore-source', 'Restore source'));
      await target.createRepertoire(candidate('restore-target', 'Keep me'));
      const exported = await exportCompleteBackup(
        source.database,
        '2026-08-27T15:08:00.000Z',
      );
      const future = JSON.parse(exported.json) as Record<string, unknown>;
      future.version = 999;
      expect(() => previewBackupJson(JSON.stringify(future))).toThrow(/newer/u);
      expect((await target.listRepertoireGraphs())[0]?.repertoires[0]?.name).toBe(
        'Keep me',
      );

      const preview = previewBackupJson(exported.json);
      await expect(
        commitBackupRestore(target.database, preview, {
          restoredAt: '2026-08-27T15:09:00.000Z',
          injectFailureBeforeCommit: () => {
            throw new Error('synthetic transaction failure');
          },
        }),
      ).rejects.toThrow('synthetic transaction failure');
      expect((await target.listRepertoireGraphs())[0]?.repertoires[0]?.name).toBe(
        'Keep me',
      );
    } finally {
      await dispose(source);
      await dispose(target);
    }
  });

  it('keeps reload/cache lifecycle separate from explicit user-data reset', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('reload-survives'));
      result.close();
      await result.initialize('2026-08-27T15:10:00.000Z');
      expect(await result.database.repertoires.count()).toBe(1);
      await expect(result.clearUserData('wrong confirmation')).rejects.toThrow(
        /confirmation/u,
      );
      expect(await result.database.repertoires.count()).toBe(1);
      await result.clearUserData('RESET LOCAL DATA', '2026-08-27T15:11:00.000Z');
      expect(await result.database.repertoires.count()).toBe(0);
      expect(await result.database.meta.count()).toBe(1);
    } finally {
      await dispose(result);
    }
  });

  it('exports repertoire-only PGN with variations and an importable move tree', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('pgn-portability'));
      const exported = exportRepertoirePgn(graph, 'pgn-portability');
      expect(exported).toContain('Opening Trainer repertoire export');
      expect(exported).toContain('(');
      const reparsed = previewPgnImport(exported, {
        repertoireId: 'pgn-reimport',
        repertoireName: 'Reimported',
        userColour: 'white',
        sourceLabel: 'Round-trip PGN',
      });
      expect(reparsed.errors).toHaveLength(0);
      expect(reparsed.summary.variations).toBeGreaterThan(0);
    } finally {
      await dispose(result);
    }
  });
});
