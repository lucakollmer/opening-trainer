import Dexie, { type Table } from 'dexie';
import type {
  Colour,
  PlaylistWeighting,
  PromptMode,
  Repertoire,
  RepertoireContext,
  RepertoireMove,
  RepertoireSource,
  PositionNode,
  MoveEdge,
  ImportSummary,
  ImportWarning,
} from '../../domain/repertoire/types';
import {
  SCHEDULER_MAPPING_POLICY_VERSION,
  type ResponseTimeBand,
  type SchedulerObservationAction,
} from '../../domain/scheduling/observationPolicy';
import {
  createEmptySchedulerState,
  type SchedulerGrade,
  type SchedulerState,
} from '../../domain/scheduling/schedulerPort';
import type {
  ReviewObservation,
  TrainingSessionState,
  TrainingStatus,
} from '../../domain/training/session';
import {
  TS_FSRS_ADAPTER_VERSION,
  TS_FSRS_PARAMETERS_VERSION,
} from '../scheduling/tsFsrsAdapter';

export const OPENING_TRAINER_DATABASE_NAME = 'opening-trainer';
export const OPENING_TRAINER_DATABASE_SCHEMA_VERSION = 2;
export const OPENING_TRAINER_PORTABLE_SCHEMA_VERSION = 2;
export const DATABASE_META_ID = 'database';

const PHASE4_DATABASE_SCHEMA_VERSION = 1;

export interface DatabaseMetaRecord {
  id: typeof DATABASE_META_ID;
  databaseSchemaVersion: number;
  portableSchemaVersion: number;
  createdAt: string;
  updatedAt: string;
  appVersion?: string;
  lastSuccessfulBackupAt?: string;
  schedulerCutoverAt?: string;
}

export type RepertoireRecord = Repertoire;
export type RepertoireContextRecord = RepertoireContext;
export type PositionRecord = PositionNode;
export type MoveEdgeRecord = MoveEdge;
export type RepertoireMoveRecord = RepertoireMove;

export interface DecisionRuleRecord {
  id: string;
  repertoireId: string;
  contextId: string;
  positionId: string;
  promptMode: PromptMode;
  acceptedMoveSetKey: string;
  acceptedUci: readonly string[];
  trainingItemId: string;
  playlistId?: string;
  updatedAt: string;
}

export interface PlaylistRecord {
  id: string;
  name: string;
  colour?: Colour;
  maxPly?: number;
  weighting: PlaylistWeighting;
  createdAt: string;
  updatedAt: string;
}

export type PlaylistEntryKind =
  | 'repertoire'
  | 'include-context'
  | 'exclude-context'
  | 'tag';

export interface PlaylistEntryRecord {
  id: string;
  playlistId: string;
  kind: PlaylistEntryKind;
  value: string;
  order: number;
}

export interface TrainingItemRecord {
  id: string;
  repertoireId: string;
  contextScopeKey: string;
  positionKey: string;
  acceptedMoveSetKey: string;
  promptMode: PromptMode;
  contextIds: readonly string[];
  playlistIds?: readonly string[];
  status: 'active' | 'superseded';
  createdAt: string;
  updatedAt: string;
}

export type ReviewLogRecord = ReviewObservation;

export interface SchedulerStateRecord {
  id: string;
  trainingItemId: string;
  state: SchedulerState;
  adapterVersion: string;
  parametersVersion: string;
  mappingPolicyVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulerDecisionRecord {
  id: string;
  observationId: string;
  trainingItemId: string;
  action: SchedulerObservationAction;
  grade?: SchedulerGrade;
  responseBand: ResponseTimeBand;
  policyVersion: string;
  responsePolicyVersion: string;
  adapterVersion: string;
  parametersVersion: string;
  reason: string;
  decidedAt: string;
  previousDueAt: string;
  resultingDueAt: string;
  resultingState: SchedulerState;
  resultingRetrievability?: number;
}

export interface SessionRecord {
  id: string;
  planId: string;
  fixtureId: string;
  status: TrainingStatus;
  state: TrainingSessionState;
  targetIds: readonly string[];
  targetIdentityKind?: 'training-item' | 'legacy-step';
  seed: string;
  policyVersion: string;
  pendingRepairIds: readonly string[];
  committedObservationIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface SettingRecord {
  id: string;
  value: unknown;
  updatedAt: string;
}

export interface ImportRecord {
  id: string;
  repertoireId: string;
  source: RepertoireSource;
  summary: ImportSummary;
  warnings: readonly ImportWarning[];
  importedAt: string;
}

export interface OpeningNameRecord {
  id: string;
  repertoireId: string;
  contextId: string;
  labels: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface ConfusionRelationRecord {
  id: string;
  expectedTrainingItemId: string;
  confusionContextId: string;
  count: number;
  lastObservedAt: string;
}

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

const PHASE5_STORES = {
  ...PHASE4_STORES,
  schedulerStates:
    'id, &trainingItemId, updatedAt, [trainingItemId+mappingPolicyVersion]',
  schedulerDecisions:
    'id, &observationId, trainingItemId, action, grade, decidedAt, policyVersion',
} as const;

function migratedSchedulerRecord(
  item: TrainingItemRecord,
  cutoverAt: string,
): SchedulerStateRecord {
  return {
    id: item.id,
    trainingItemId: item.id,
    state: createEmptySchedulerState(new Date(cutoverAt)),
    adapterVersion: TS_FSRS_ADAPTER_VERSION,
    parametersVersion: TS_FSRS_PARAMETERS_VERSION,
    mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
    createdAt: cutoverAt,
    updatedAt: cutoverAt,
  };
}

export class OpeningTrainerDatabase extends Dexie {
  public meta!: Table<DatabaseMetaRecord, string>;
  public repertoires!: Table<RepertoireRecord, string>;
  public repertoireContexts!: Table<RepertoireContextRecord, string>;
  public positions!: Table<PositionRecord, string>;
  public moveEdges!: Table<MoveEdgeRecord, string>;
  public repertoireMoves!: Table<RepertoireMoveRecord, string>;
  public decisionRules!: Table<DecisionRuleRecord, string>;
  public playlists!: Table<PlaylistRecord, string>;
  public playlistEntries!: Table<PlaylistEntryRecord, string>;
  public trainingItems!: Table<TrainingItemRecord, string>;
  public reviewLogs!: Table<ReviewLogRecord, string>;
  public schedulerStates!: Table<SchedulerStateRecord, string>;
  public schedulerDecisions!: Table<SchedulerDecisionRecord, string>;
  public sessions!: Table<SessionRecord, string>;
  public settings!: Table<SettingRecord, string>;
  public imports!: Table<ImportRecord, string>;
  public openingNames!: Table<OpeningNameRecord, string>;
  public confusionRelations!: Table<ConfusionRelationRecord, string>;

  public constructor(name = OPENING_TRAINER_DATABASE_NAME) {
    super(name);
    this.version(PHASE4_DATABASE_SCHEMA_VERSION).stores(PHASE4_STORES);
    this.version(OPENING_TRAINER_DATABASE_SCHEMA_VERSION)
      .stores(PHASE5_STORES)
      .upgrade(async (transaction) => {
        const cutoverAt = new Date().toISOString();
        const trainingItems = (await transaction
          .table('trainingItems')
          .toArray()) as TrainingItemRecord[];
        const schedulerRows = trainingItems
          .filter((item) => item.status === 'active')
          .map((item) => migratedSchedulerRecord(item, cutoverAt));
        if (schedulerRows.length > 0) {
          await transaction.table('schedulerStates').bulkPut(schedulerRows);
        }
        const meta = (await transaction
          .table('meta')
          .get(DATABASE_META_ID)) as DatabaseMetaRecord | undefined;
        if (meta) {
          await transaction.table('meta').put({
            ...meta,
            databaseSchemaVersion: OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
            portableSchemaVersion: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
            schedulerCutoverAt: meta.schedulerCutoverAt ?? cutoverAt,
            updatedAt: cutoverAt,
          });
        }
      });
  }
}

export function createDatabaseMeta(now: string): DatabaseMetaRecord {
  return {
    id: DATABASE_META_ID,
    databaseSchemaVersion: OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
    portableSchemaVersion: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    schedulerCutoverAt: now,
  };
}

export const USER_DATA_TABLE_NAMES = [
  'repertoires',
  'repertoireContexts',
  'positions',
  'moveEdges',
  'repertoireMoves',
  'decisionRules',
  'playlists',
  'playlistEntries',
  'trainingItems',
  'reviewLogs',
  'schedulerStates',
  'schedulerDecisions',
  'sessions',
  'settings',
  'imports',
  'openingNames',
  'confusionRelations',
] as const;
