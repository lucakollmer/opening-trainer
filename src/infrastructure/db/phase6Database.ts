import type { Table } from 'dexie';
import type {
  ContrastItemRecord,
  ContrastReviewLogRecord,
  ContrastSessionRecord,
  IndependentSchedulerDecisionRecord,
  IndependentSchedulerStateRecord,
  ManagedOpeningNameRecord,
  NameReviewLogRecord,
  NameSessionRecord,
  NameTrainingItemRecord,
  PlaylistLifecycleRecord,
  RepertoireLifecycleRecord,
} from '../../domain/phase6/types';
import {
  DATABASE_META_ID,
  OpeningTrainerDatabase,
} from './openingTrainerDatabase';
import {
  assertContrastItemRecord,
  assertContrastReviewLogRecord,
  assertContrastSessionRecord,
  assertIndependentSchedulerDecisionRecord,
  assertIndependentSchedulerStateRecord,
  assertLifecycleRecord,
  assertManagedOpeningNameRecord,
  assertNameReviewLogRecord,
  assertNameSessionRecord,
  assertNameTrainingItemRecord,
  PHASE6_CONTRAST_POLICY_VERSION,
  PHASE6_NAME_POLICY_VERSION,
} from './phase6Validation';

export const PHASE6_DATABASE_SCHEMA_VERSION = 3;
export const PHASE6_PORTABLE_SCHEMA_VERSION = 3;

const PHASE6_STORES = {
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
  schedulerStates:
    'id, &trainingItemId, updatedAt, [trainingItemId+mappingPolicyVersion]',
  schedulerDecisions:
    'id, &observationId, trainingItemId, action, grade, decidedAt, policyVersion',
  sessions: 'id, planId, status, updatedAt',
  settings: 'id, updatedAt',
  imports: 'id, repertoireId, importedAt',
  openingNames: 'id, repertoireId, contextId, updatedAt',
  confusionRelations:
    'id, expectedTrainingItemId, confusionContextId, lastObservedAt',
  repertoireStates: 'id, archivedAt, updatedAt',
  playlistStates: 'id, archivedAt, updatedAt',
  managedOpeningNames:
    'id, repertoireId, &contextId, answerSetKey, archivedAt, updatedAt',
  nameTrainingItems:
    'id, repertoireId, contextId, answerSetKey, status, [repertoireId+status]',
  nameReviewLogs:
    'id, nameTrainingItemId, sessionId, observedAt, outcome, &[sessionId+itemIndex]',
  nameSchedulerStates: 'id, &itemId, updatedAt, mappingPolicyVersion',
  nameSchedulerDecisions:
    'id, &observationId, itemId, grade, decidedAt, policyVersion',
  nameSessions: 'id, status, updatedAt',
  contrastItems:
    'id, pairId, repertoireId, expectedContextId, confusedContextId, status, [repertoireId+status]',
  contrastReviewLogs:
    'id, contrastItemId, sessionId, observedAt, outcome, &[sessionId+itemIndex]',
  contrastSchedulerStates: 'id, &itemId, updatedAt, mappingPolicyVersion',
  contrastSchedulerDecisions:
    'id, &observationId, itemId, grade, decidedAt, policyVersion',
  contrastSessions: 'id, status, updatedAt',
} as const;

export const PHASE6_USER_DATA_TABLE_NAMES = [
  'repertoireStates',
  'playlistStates',
  'managedOpeningNames',
  'nameTrainingItems',
  'nameReviewLogs',
  'nameSchedulerStates',
  'nameSchedulerDecisions',
  'nameSessions',
  'contrastItems',
  'contrastReviewLogs',
  'contrastSchedulerStates',
  'contrastSchedulerDecisions',
  'contrastSessions',
] as const;

export class Phase6OpeningTrainerDatabase extends OpeningTrainerDatabase {
  public repertoireStates!: Table<RepertoireLifecycleRecord, string>;
  public playlistStates!: Table<PlaylistLifecycleRecord, string>;
  public managedOpeningNames!: Table<ManagedOpeningNameRecord, string>;
  public nameTrainingItems!: Table<NameTrainingItemRecord, string>;
  public nameReviewLogs!: Table<NameReviewLogRecord, string>;
  public nameSchedulerStates!: Table<IndependentSchedulerStateRecord, string>;
  public nameSchedulerDecisions!: Table<IndependentSchedulerDecisionRecord, string>;
  public nameSessions!: Table<NameSessionRecord, string>;
  public contrastItems!: Table<ContrastItemRecord, string>;
  public contrastReviewLogs!: Table<ContrastReviewLogRecord, string>;
  public contrastSchedulerStates!: Table<IndependentSchedulerStateRecord, string>;
  public contrastSchedulerDecisions!: Table<IndependentSchedulerDecisionRecord, string>;
  public contrastSessions!: Table<ContrastSessionRecord, string>;

  public constructor(name?: string) {
    super(name);
    this.version(PHASE6_DATABASE_SCHEMA_VERSION)
      .stores(PHASE6_STORES)
      .upgrade(async (transaction) => {
        const now = new Date().toISOString();
        const meta = await transaction.table('meta').get(DATABASE_META_ID);
        if (meta && typeof meta === 'object') {
          await transaction.table('meta').put({
            ...meta,
            databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
            portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
            updatedAt: now,
          });
        }
      });

    this.table<IndependentSchedulerStateRecord, string>('nameSchedulerStates').hook(
      'creating',
      (_primaryKey, record) =>
        assertIndependentSchedulerStateRecord(record, PHASE6_NAME_POLICY_VERSION),
    );
    this.table<IndependentSchedulerDecisionRecord, string>(
      'nameSchedulerDecisions',
    ).hook('creating', (_primaryKey, record) =>
      assertIndependentSchedulerDecisionRecord(record, PHASE6_NAME_POLICY_VERSION),
    );
    this.table<NameReviewLogRecord, string>('nameReviewLogs').hook(
      'creating',
      (_primaryKey, record) => assertNameReviewLogRecord(record),
    );
    this.table<NameSessionRecord, string>('nameSessions').hook(
      'creating',
      (_primaryKey, record) => assertNameSessionRecord(record),
    );
    this.table<NameTrainingItemRecord, string>('nameTrainingItems').hook(
      'creating',
      (_primaryKey, record) => assertNameTrainingItemRecord(record),
    );
    this.table<IndependentSchedulerStateRecord, string>(
      'contrastSchedulerStates',
    ).hook('creating', (_primaryKey, record) =>
      assertIndependentSchedulerStateRecord(
        record,
        PHASE6_CONTRAST_POLICY_VERSION,
      ),
    );
    this.table<IndependentSchedulerDecisionRecord, string>(
      'contrastSchedulerDecisions',
    ).hook('creating', (_primaryKey, record) =>
      assertIndependentSchedulerDecisionRecord(
        record,
        PHASE6_CONTRAST_POLICY_VERSION,
      ),
    );
    this.table<ContrastReviewLogRecord, string>('contrastReviewLogs').hook(
      'creating',
      (_primaryKey, record) => assertContrastReviewLogRecord(record),
    );
    this.table<ContrastSessionRecord, string>('contrastSessions').hook(
      'creating',
      (_primaryKey, record) => assertContrastSessionRecord(record),
    );
    this.table<ContrastItemRecord, string>('contrastItems').hook(
      'creating',
      (_primaryKey, record) => assertContrastItemRecord(record),
    );
    this.table<ManagedOpeningNameRecord, string>('managedOpeningNames').hook(
      'creating',
      (_primaryKey, record) => assertManagedOpeningNameRecord(record),
    );

    this.on('ready', async () => {
      const [
        repertoireStates,
        playlistStates,
        names,
        nameItems,
        nameStates,
        nameDecisions,
        nameReviews,
        nameSessions,
        contrastItems,
        contrastStates,
        contrastDecisions,
        contrastReviews,
        contrastSessions,
      ] = await Promise.all([
        this.repertoireStates.toArray(),
        this.playlistStates.toArray(),
        this.managedOpeningNames.toArray(),
        this.nameTrainingItems.toArray(),
        this.nameSchedulerStates.toArray(),
        this.nameSchedulerDecisions.toArray(),
        this.nameReviewLogs.toArray(),
        this.nameSessions.toArray(),
        this.contrastItems.toArray(),
        this.contrastSchedulerStates.toArray(),
        this.contrastSchedulerDecisions.toArray(),
        this.contrastReviewLogs.toArray(),
        this.contrastSessions.toArray(),
      ]);
      repertoireStates.forEach((record) =>
        assertLifecycleRecord(record, `Repertoire state ${record.id}`),
      );
      playlistStates.forEach((record) =>
        assertLifecycleRecord(record, `Playlist state ${record.id}`),
      );
      names.forEach(assertManagedOpeningNameRecord);
      nameItems.forEach(assertNameTrainingItemRecord);
      nameStates.forEach((record) =>
        assertIndependentSchedulerStateRecord(record, PHASE6_NAME_POLICY_VERSION),
      );
      nameDecisions.forEach((record) =>
        assertIndependentSchedulerDecisionRecord(
          record,
          PHASE6_NAME_POLICY_VERSION,
        ),
      );
      nameReviews.forEach(assertNameReviewLogRecord);
      nameSessions.forEach(assertNameSessionRecord);
      contrastItems.forEach(assertContrastItemRecord);
      contrastStates.forEach((record) =>
        assertIndependentSchedulerStateRecord(
          record,
          PHASE6_CONTRAST_POLICY_VERSION,
        ),
      );
      contrastDecisions.forEach((record) =>
        assertIndependentSchedulerDecisionRecord(
          record,
          PHASE6_CONTRAST_POLICY_VERSION,
        ),
      );
      contrastReviews.forEach(assertContrastReviewLogRecord);
      contrastSessions.forEach(assertContrastSessionRecord);
    });
  }
}
