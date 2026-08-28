import Dexie from 'dexie';
import {
  DATABASE_META_ID,
  OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
  OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
  OpeningTrainerDatabase,
} from './openingTrainerDatabase';

const PHASE4_STORES = {
  meta: 'id',
  repertoires: 'id, name, userColour, updatedAt, archivedAt',
  repertoireContexts:
    'id, repertoireId, parentContextId, entryPositionId, included, &[repertoireId+pathFingerprint]',
  positions: 'id, &key, createdAt',
  moveEdges: 'id, fromPositionId, toPositionId, &[fromPositionId+uci]',
  repertoireMoves:
    'id, contextId, edgeId, destinationContextId, actor, included, [contextId+order]',
  decisionRules:
    'id, repertoireId, contextId, positionId, trainingItemId, [repertoireId+positionId]',
  playlists: 'id, name, colour, updatedAt',
  playlistEntries:
    'id, playlistId, kind, value, [playlistId+kind], [playlistId+value]',
  trainingItems:
    'id, repertoireId, positionKey, acceptedMoveSetKey, promptMode, status, [repertoireId+status]',
  reviewLogs: 'id, trainingItemId, sessionId, observedAt, outcome, evidenceRole',
  sessions: 'id, planId, status, updatedAt',
  settings: 'id, updatedAt',
  imports: 'id, repertoireId, importedAt',
  openingNames: 'id, repertoireId, contextId, updatedAt',
  confusionRelations:
    'id, expectedTrainingItemId, confusionContextId, lastObservedAt',
} as const;

it('migrates an existing PHASE-4 schema v1 in place without replaying review history', async () => {
  const name = `phase5-migration-${crypto.randomUUID()}`;
  const legacy = new Dexie(name);
  legacy.version(1).stores(PHASE4_STORES);
  await legacy.open();
  await legacy.table('meta').put({
    id: DATABASE_META_ID,
    databaseSchemaVersion: 1,
    portableSchemaVersion: 1,
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
  });
  await legacy.table('trainingItems').put({
    id: 'legacy-item',
    repertoireId: 'legacy-repertoire',
    contextScopeKey: 'scope',
    positionKey: 'position',
    acceptedMoveSetKey: 'e2e4',
    promptMode: 'normal',
    contextIds: ['legacy-context'],
    status: 'active',
    createdAt: '2026-08-27T10:00:00.000Z',
    updatedAt: '2026-08-27T10:00:00.000Z',
  });
  const legacyReview = {
    id: 'legacy-observation',
    trainingItemId: 'legacy-item',
    sessionId: 'legacy-session',
    observedAt: '2026-08-27T10:01:00.000Z',
    evidenceRole: 'targeted',
    outcome: 'correct',
    responseTimeMs: 5_000,
    hintLevel: 0,
    illegalAttemptCount: 0,
    expectedMoveSetKey: 'e2e4',
  };
  await legacy.table('reviewLogs').put(legacyReview);
  legacy.close();

  const current = new OpeningTrainerDatabase(name);
  try {
    await current.open();
    const meta = await current.meta.get(DATABASE_META_ID);
    expect(meta?.databaseSchemaVersion).toBe(OPENING_TRAINER_DATABASE_SCHEMA_VERSION);
    expect(meta?.portableSchemaVersion).toBe(OPENING_TRAINER_PORTABLE_SCHEMA_VERSION);
    expect(meta?.schedulerCutoverAt).toBeDefined();
    expect((await current.reviewLogs.get('legacy-observation'))).toEqual(legacyReview);
    expect(await current.schedulerDecisions.count()).toBe(0);
    expect((await current.schedulerStates.get('legacy-item'))?.state).toMatchObject({
      stage: 'new',
      reps: 0,
      lapses: 0,
    });
  } finally {
    current.close();
    await current.delete();
  }
});
