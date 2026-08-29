import {
  SCHEDULER_MAPPING_POLICY_VERSION,
  RESPONSE_TIME_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import { createEmptySchedulerState } from '../../domain/scheduling/schedulerPort';
import {
  DATABASE_META_ID,
  OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
  OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
  USER_DATA_TABLE_NAMES,
  type ConfusionRelationRecord,
  type DatabaseMetaRecord,
  type DecisionRuleRecord,
  type ImportRecord,
  type MoveEdgeRecord,
  type OpeningNameRecord,
  type OpeningTrainerDatabase,
  type PlaylistEntryRecord,
  type PlaylistRecord,
  type PositionRecord,
  type RepertoireContextRecord,
  type RepertoireMoveRecord,
  type RepertoireRecord,
  type ReviewLogRecord,
  type SchedulerDecisionRecord,
  type SchedulerStateRecord,
  type SessionRecord,
  type SettingRecord,
  type TrainingItemRecord,
} from '../db/openingTrainerDatabase';
import { storedRowsToGraph } from '../db/graphStorage';
import {
  TS_FSRS_ADAPTER_VERSION,
  TS_FSRS_PARAMETERS_VERSION,
} from '../scheduling/tsFsrsAdapter';

export const OPENING_TRAINER_BACKUP_FORMAT = 'opening-trainer-backup';
export const MAX_BACKUP_BYTES = 5_000_000;

const COLOURS = new Set(['white', 'black']);
const PROMPT_MODES = new Set(['normal', 'guided', 'strict', 'contrast', 'name']);
const MOVE_ACTORS = new Set(['user', 'opponent']);
const PLAYLIST_ENTRY_KINDS = new Set([
  'repertoire',
  'include-context',
  'exclude-context',
  'tag',
]);
const TRAINING_ITEM_STATUSES = new Set(['active', 'superseded']);
const EVIDENCE_ROLES = new Set(['targeted', 'incidental']);
const TRAINING_OUTCOMES = new Set([
  'instant-correct',
  'correct',
  'hesitant-correct',
  'hinted-correct',
  'wrong-variation',
  'outside-repertoire',
  'illegal-attempt',
  'revealed',
  'repair-correct',
]);
const TRAINING_STATUSES = new Set([
  'awaiting-user-move',
  'opponent-moving',
  'correct-feedback',
  'illegal-feedback',
  'outside-repertoire-feedback',
  'wrong-variation-feedback',
  'hint-offered',
  'answer-revealed',
  'repair-replay',
  'line-complete',
  'session-complete',
  'abandoned',
  'error',
]);
const SCHEDULER_STAGES = new Set(['new', 'learning', 'review', 'relearning']);
const SCHEDULER_ACTIONS = new Set(['review', 'none', 'promote-target']);
const SCHEDULER_GRADES = new Set(['Again', 'Hard', 'Good', 'Easy']);
const RESPONSE_BANDS = new Set(['fast', 'ordinary', 'hesitant']);

export interface BackupIntegrity {
  algorithm: 'SHA-256';
  digest: string;
}

export interface OpeningTrainerBackupData {
  repertoires: RepertoireRecord[];
  repertoireContexts: RepertoireContextRecord[];
  positions: PositionRecord[];
  moveEdges: MoveEdgeRecord[];
  repertoireMoves: RepertoireMoveRecord[];
  decisionRules: DecisionRuleRecord[];
  playlists: PlaylistRecord[];
  playlistEntries: PlaylistEntryRecord[];
  trainingItems: TrainingItemRecord[];
  reviewLogs: ReviewLogRecord[];
  schedulerStates: SchedulerStateRecord[];
  schedulerDecisions: SchedulerDecisionRecord[];
  sessions: SessionRecord[];
  settings: SettingRecord[];
  imports: ImportRecord[];
  openingNames: OpeningNameRecord[];
  confusionRelations: ConfusionRelationRecord[];
}

export interface OpeningTrainerBackup {
  format: typeof OPENING_TRAINER_BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  databaseMeta: DatabaseMetaRecord;
  data: OpeningTrainerBackupData;
  integrity?: BackupIntegrity;
}

export interface BackupPreview {
  backup: OpeningTrainerBackup;
  summary: {
    repertoires: number;
    playlists: number;
    trainingItems: number;
    reviewLogs: number;
    schedulerStates: number;
    schedulerDecisions: number;
    sessions: number;
    settings: number;
  };
  warnings: readonly string[];
  sourceForIntegrity?: OpeningTrainerBackup;
}

const BACKUP_DATA_KEYS_V1 = [
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
  'sessions',
  'settings',
  'imports',
  'openingNames',
  'confusionRelations',
] as const;

const BACKUP_DATA_KEYS_V2 = [
  ...BACKUP_DATA_KEYS_V1,
  'schedulerStates',
  'schedulerDecisions',
] as const satisfies readonly (keyof OpeningTrainerBackupData)[];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Backup field ${key} must be a non-empty string.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): void {
  const value = record[key];
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`Backup field ${key} must be a string when present.`);
  }
}

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Backup field ${key} must be a finite number.`);
  }
  return value;
}

function requireNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = requireNumber(record, key);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Backup field ${key} must be a non-negative integer.`);
  }
  return value;
}

function requireBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Backup field ${key} must be a boolean.`);
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Backup field ${key} must be an array of strings.`);
  }
  return value.map(String);
}

function requireEnum(
  record: Record<string, unknown>,
  key: string,
  values: ReadonlySet<string>,
): string {
  const value = requireString(record, key);
  if (!values.has(value)) {
    throw new Error(`Backup field ${key} has unsupported value ${value}.`);
  }
  return value;
}

function requireObject(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key];
  if (!isObject(value)) throw new Error(`Backup field ${key} must be an object.`);
  return value;
}

function validateLocator(value: unknown, label: string): void {
  if (value === undefined) return;
  if (!isObject(value)) throw new Error(`${label} sourceLocator must be an object.`);
  for (const key of ['game', 'line', 'column']) {
    const number = requireNonNegativeInteger(value, key);
    if (number < 1)
      throw new Error(`${label} sourceLocator.${key} must be at least 1.`);
  }
}

function validateSource(value: unknown, label: string): void {
  if (!isObject(value)) throw new Error(`${label} source must be an object.`);
  requireEnum(value, 'kind', new Set(['synthetic', 'pgn']));
  requireString(value, 'label');
  optionalString(value, 'hash');
  optionalString(value, 'parserVersion');
}

function validateImportSummary(value: unknown, label: string): void {
  if (!isObject(value)) throw new Error(`${label} summary must be an object.`);
  for (const key of [
    'games',
    'positions',
    'moves',
    'contexts',
    'variations',
    'comments',
    'nags',
  ]) {
    requireNonNegativeInteger(value, key);
  }
}

function validateWarnings(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} warnings must be an array.`);
  value.forEach((warning, index) => {
    if (!isObject(warning)) throw new Error(`${label} warning ${index} is invalid.`);
    requireString(warning, 'code');
    requireString(warning, 'message');
    validateLocator(warning.sourceLocator, `${label} warning ${index}`);
  });
}

function validateReviewRecord(value: unknown, label: string): void {
  if (!isObject(value)) throw new Error(`${label} must be an object.`);
  requireString(value, 'id');
  requireString(value, 'trainingItemId');
  requireString(value, 'sessionId');
  requireString(value, 'observedAt');
  requireEnum(value, 'evidenceRole', EVIDENCE_ROLES);
  requireEnum(value, 'outcome', TRAINING_OUTCOMES);
  const responseTime = requireNumber(value, 'responseTimeMs');
  if (responseTime < 0)
    throw new Error(`${label} responseTimeMs must be non-negative.`);
  const hintLevel = requireNonNegativeInteger(value, 'hintLevel');
  if (hintLevel > 4) throw new Error(`${label} hintLevel must be between 0 and 4.`);
  requireNonNegativeInteger(value, 'illegalAttemptCount');
  requireString(value, 'expectedMoveSetKey');
  optionalString(value, 'playedUci');
  optionalString(value, 'confusionContextId');
}

function validateSchedulerState(value: unknown, label: string): void {
  if (!isObject(value)) throw new Error(`${label} state must be an object.`);
  const schemaVersion = requireNonNegativeInteger(value, 'schemaVersion');
  if (schemaVersion !== 1) throw new Error(`${label} state schema is unsupported.`);
  requireString(value, 'dueAt');
  for (const key of ['stability', 'difficulty', 'elapsedDays', 'scheduledDays']) {
    const number = requireNumber(value, key);
    if (number < 0) throw new Error(`${label} ${key} must be non-negative.`);
  }
  for (const key of ['learningSteps', 'reps', 'lapses']) {
    requireNonNegativeInteger(value, key);
  }
  requireEnum(value, 'stage', SCHEDULER_STAGES);
  optionalString(value, 'lastReviewAt');
}

function validateAdaptiveState(value: unknown, label: string): void {
  if (value === undefined) return;
  if (!isObject(value))
    throw new Error(`${label} adaptive metadata must be an object.`);
  requireString(value, 'generatorVersion');
  requireString(value, 'seed');
  const exerciseIndex = requireNonNegativeInteger(value, 'exerciseIndex');
  const requestedTargetCount = requireNonNegativeInteger(value, 'requestedTargetCount');
  if (requestedTargetCount < 1) {
    throw new Error(`${label} requestedTargetCount must be at least 1.`);
  }
  requireNonNegativeInteger(value, 'newItemLimit');
  requireStringArray(value, 'targetTrainingItemIds');
  if (!Array.isArray(value.exercises) || value.exercises.length === 0) {
    throw new Error(`${label} adaptive exercises must be a non-empty array.`);
  }
  if (exerciseIndex >= value.exercises.length) {
    throw new Error(`${label} adaptive exerciseIndex is outside the exercise list.`);
  }
  value.exercises.forEach((exercise, index) => {
    if (!isObject(exercise)) {
      throw new Error(`${label} adaptive exercise ${index} is invalid.`);
    }
    for (const key of ['repertoireId', 'rootContextId', 'targetContextId']) {
      requireString(exercise, key);
    }
    requireStringArray(exercise, 'targetContextIds');
    requireEnum(exercise, 'promptMode', PROMPT_MODES);
    if (exercise.kind !== undefined) {
      requireEnum(exercise, 'kind', new Set(['scheduled', 'retest']));
    }
    optionalString(exercise, 'playlistId');
  });
}

function validateSessionState(value: unknown, label: string): void {
  if (!isObject(value)) throw new Error(`${label} state must be an object.`);
  requireString(value, 'sessionId');
  requireString(value, 'planId');
  requireString(value, 'fixtureId');
  requireEnum(value, 'status', TRAINING_STATUSES);
  requireString(value, 'fen');
  optionalString(value, 'currentStepId');
  requireNonNegativeInteger(value, 'plyIndex');
  requireString(value, 'targetStepId');
  requireStringArray(value, 'targetStepIds');
  requireStringArray(value, 'targetTrainingItemIds');
  requireNonNegativeInteger(value, 'targetPly');
  requireEnum(value, 'runKind', new Set(['primary', 'retest']));
  requireNonNegativeInteger(value, 'treeRevealedPlyCount');
  requireStringArray(value, 'treeRevealedItemIds');
  const hintLevel = requireNonNegativeInteger(value, 'hintLevel');
  if (hintLevel > 4) throw new Error(`${label} hintLevel must be between 0 and 4.`);
  requireNonNegativeInteger(value, 'illegalAttemptCount');
  for (const key of ['attemptStartedAtMs', 'pausedDurationMs']) {
    const number = requireNumber(value, key);
    if (number < 0) throw new Error(`${label} ${key} must be non-negative.`);
  }
  if (value.pauseStartedAtMs !== undefined) {
    const pause = requireNumber(value, 'pauseStartedAtMs');
    if (pause < 0) throw new Error(`${label} pauseStartedAtMs must be non-negative.`);
  }
  if (!Array.isArray(value.evidence))
    throw new Error(`${label} evidence must be an array.`);
  value.evidence.forEach((review, index) =>
    validateReviewRecord(review, `${label} evidence ${index}`),
  );
  if (!Array.isArray(value.retestQueue)) {
    throw new Error(`${label} retestQueue must be an array.`);
  }
  value.retestQueue.forEach((ticket, index) => {
    if (!isObject(ticket))
      throw new Error(`${label} retest ticket ${index} is invalid.`);
    requireString(ticket, 'id');
    requireString(ticket, 'targetStepId');
    requireNonNegativeInteger(ticket, 'separationRemaining');
    requireString(ticket, 'sourceObservationId');
    requireNonNegativeInteger(ticket, 'attempt');
  });
  if (!isObject(value.retestAttemptsByStep)) {
    throw new Error(`${label} retestAttemptsByStep must be an object.`);
  }
  for (const [stepId, attempt] of Object.entries(value.retestAttemptsByStep)) {
    if (
      !stepId ||
      typeof attempt !== 'number' ||
      !Number.isInteger(attempt) ||
      attempt < 0
    ) {
      throw new Error(`${label} retestAttemptsByStep contains invalid data.`);
    }
  }
  if (value.lastMove !== undefined && !isObject(value.lastMove)) {
    throw new Error(`${label} lastMove must be an object when present.`);
  }
  if (value.feedback !== undefined) {
    if (!isObject(value.feedback))
      throw new Error(`${label} feedback must be an object.`);
    requireEnum(
      value.feedback,
      'kind',
      new Set([
        'info',
        'correct',
        'illegal',
        'outside',
        'variation',
        'reveal',
        'repair',
      ]),
    );
    requireString(value.feedback, 'title');
    requireString(value.feedback, 'message');
  }
  validateAdaptiveState(value.adaptive, label);
}

function assertRecordArray(
  value: unknown,
  name: string,
): asserts value is Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error(`Backup table ${name} must be an array.`);
  const seen = new Set<string>();
  value.forEach((item, index) => {
    if (!isObject(item)) throw new Error(`Backup table ${name}[${index}] is invalid.`);
    const id = requireString(item, 'id');
    if (seen.has(id))
      throw new Error(`Backup table ${name} contains duplicate ID ${id}.`);
    seen.add(id);
  });
}

function ids<T extends { id: string }>(rows: readonly T[]): Set<string> {
  return new Set(rows.map((row) => row.id));
}

function validateRecordSchemas(data: OpeningTrainerBackupData): void {
  data.repertoires.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'name');
    requireEnum(record, 'userColour', COLOURS);
    requireStringArray(record, 'rootContextIds');
    validateSource(record.source, `repertoires[${index}]`);
    requireString(record, 'createdAt');
    requireString(record, 'updatedAt');
    optionalString(record, 'archivedAt');
  });
  data.repertoireContexts.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'repertoireId');
    optionalString(record, 'parentContextId');
    requireString(record, 'entryPositionId');
    optionalString(record, 'label');
    optionalString(record, 'openingNameId');
    requireStringArray(record, 'tags');
    requireBoolean(record, 'included');
    requireString(record, 'pathFingerprint');
    optionalString(record, 'note');
    validateLocator(record.sourceLocator, `repertoireContexts[${index}]`);
  });
  data.positions.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'key');
    requireString(record, 'fen');
    requireString(record, 'createdAt');
  });
  data.moveEdges.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'fromPositionId');
    requireString(record, 'toPositionId');
    requireString(record, 'uci');
    requireString(record, 'san');
    if (record.promotion !== undefined) {
      requireEnum(record, 'promotion', new Set(['q', 'r', 'b', 'n']));
    }
  });
  data.repertoireMoves.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'contextId');
    requireString(record, 'edgeId');
    requireString(record, 'destinationContextId');
    requireEnum(record, 'actor', MOVE_ACTORS);
    requireBoolean(record, 'included');
    requireNonNegativeInteger(record, 'order');
    optionalString(record, 'note');
    optionalString(record, 'purpose');
    if (record.nags !== undefined) requireStringArray(record, 'nags');
    validateLocator(record.sourceLocator, `repertoireMoves[${index}]`);
  });
  data.decisionRules.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    for (const key of [
      'id',
      'repertoireId',
      'contextId',
      'positionId',
      'acceptedMoveSetKey',
      'trainingItemId',
      'updatedAt',
    ]) {
      requireString(record, key);
    }
    requireEnum(record, 'promptMode', PROMPT_MODES);
    requireStringArray(record, 'acceptedUci');
    optionalString(record, 'playlistId');
  });
  data.playlists.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'name');
    if (record.colour !== undefined) requireEnum(record, 'colour', COLOURS);
    if (record.maxPly !== undefined) requireNonNegativeInteger(record, 'maxPly');
    const weighting = requireObject(record, 'weighting');
    requireEnum(weighting, 'kind', new Set(['due-first', 'balanced']));
    requireString(record, 'createdAt');
    requireString(record, 'updatedAt');
  });
  data.playlistEntries.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'playlistId');
    requireEnum(record, 'kind', PLAYLIST_ENTRY_KINDS);
    requireString(record, 'value');
    requireNonNegativeInteger(record, 'order');
  });
  data.trainingItems.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    for (const key of [
      'id',
      'repertoireId',
      'contextScopeKey',
      'positionKey',
      'acceptedMoveSetKey',
      'createdAt',
      'updatedAt',
    ]) {
      requireString(record, key);
    }
    requireEnum(record, 'promptMode', PROMPT_MODES);
    requireStringArray(record, 'contextIds');
    if (record.playlistIds !== undefined) {
      requireStringArray(record, 'playlistIds');
    }
    requireEnum(record, 'status', TRAINING_ITEM_STATUSES);
  });
  data.reviewLogs.forEach((row, index) =>
    validateReviewRecord(row, `reviewLogs[${index}]`),
  );
  data.schedulerStates.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'trainingItemId');
    validateSchedulerState(record.state, `schedulerStates[${index}]`);
    requireString(record, 'adapterVersion');
    requireString(record, 'parametersVersion');
    requireString(record, 'mappingPolicyVersion');
    requireString(record, 'createdAt');
    requireString(record, 'updatedAt');
  });
  data.schedulerDecisions.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    for (const key of [
      'id',
      'observationId',
      'trainingItemId',
      'policyVersion',
      'responsePolicyVersion',
      'adapterVersion',
      'parametersVersion',
      'reason',
      'decidedAt',
      'previousDueAt',
      'resultingDueAt',
    ]) {
      requireString(record, key);
    }
    requireEnum(record, 'action', SCHEDULER_ACTIONS);
    if (record.grade !== undefined) requireEnum(record, 'grade', SCHEDULER_GRADES);
    requireEnum(record, 'responseBand', RESPONSE_BANDS);
    validateSchedulerState(record.resultingState, `schedulerDecisions[${index}]`);
    if (record.resultingRetrievability !== undefined) {
      const value = requireNumber(record, 'resultingRetrievability');
      if (value < 0 || value > 1) {
        throw new Error('Scheduler retrievability must be between 0 and 1.');
      }
    }
  });
  data.sessions.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    for (const key of [
      'id',
      'planId',
      'fixtureId',
      'seed',
      'policyVersion',
      'createdAt',
      'updatedAt',
    ]) {
      requireString(record, key);
    }
    requireEnum(record, 'status', TRAINING_STATUSES);
    requireStringArray(record, 'targetIds');
    if (record.targetIdentityKind !== undefined) {
      requireEnum(
        record,
        'targetIdentityKind',
        new Set(['training-item', 'legacy-step']),
      );
    }
    requireStringArray(record, 'pendingRepairIds');
    requireStringArray(record, 'committedObservationIds');
    optionalString(record, 'completedAt');
    validateSessionState(record.state, `sessions[${index}]`);
  });
  data.settings.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'updatedAt');
    if (!Object.hasOwn(record, 'value'))
      throw new Error('Backup setting is missing value.');
  });
  data.imports.forEach((row, index) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'repertoireId');
    validateSource(record.source, `imports[${index}]`);
    validateImportSummary(record.summary, `imports[${index}]`);
    validateWarnings(record.warnings, `imports[${index}]`);
    requireString(record, 'importedAt');
  });
  data.openingNames.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'repertoireId');
    requireString(record, 'contextId');
    requireStringArray(record, 'labels');
    requireString(record, 'createdAt');
    requireString(record, 'updatedAt');
  });
  data.confusionRelations.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'expectedTrainingItemId');
    requireString(record, 'confusionContextId');
    requireNonNegativeInteger(record, 'count');
    requireString(record, 'lastObservedAt');
  });
}

function validateSupplementalRows(data: OpeningTrainerBackupData): void {
  const repertoireIds = ids(data.repertoires);
  const contextIds = ids(data.repertoireContexts);
  const trainingItemIds = ids(data.trainingItems);
  const reviewIds = ids(data.reviewLogs);
  const sessionIds = ids(data.sessions);
  const playlistIds = ids(data.playlists);
  const schedulerStateIds = new Set(
    data.schedulerStates.map((row) => row.trainingItemId),
  );
  if (schedulerStateIds.size !== data.schedulerStates.length) {
    throw new Error(
      'Backup contains duplicate scheduler state training-item identities.',
    );
  }
  const schedulerDecisionObservationIds = new Set(
    data.schedulerDecisions.map((row) => row.observationId),
  );
  if (schedulerDecisionObservationIds.size !== data.schedulerDecisions.length) {
    throw new Error(
      'Backup contains duplicate scheduler decisions for one observation.',
    );
  }

  for (const rule of data.decisionRules) {
    if (!repertoireIds.has(rule.repertoireId)) {
      throw new Error(`Decision rule ${rule.id} references missing repertoire.`);
    }
    if (!contextIds.has(rule.contextId)) {
      throw new Error(`Decision rule ${rule.id} references missing context.`);
    }
    if (!trainingItemIds.has(rule.trainingItemId)) {
      throw new Error(`Decision rule ${rule.id} references missing training item.`);
    }
    if (rule.playlistId && !playlistIds.has(rule.playlistId)) {
      throw new Error(`Decision rule ${rule.id} references missing playlist.`);
    }
  }
  for (const entry of data.playlistEntries) {
    if (!playlistIds.has(entry.playlistId)) {
      throw new Error(`Playlist entry ${entry.id} references missing playlist.`);
    }
  }
  for (const item of data.trainingItems) {
    if (!repertoireIds.has(item.repertoireId)) {
      throw new Error(`Training item ${item.id} references missing repertoire.`);
    }
    if (item.contextIds.some((contextId) => !contextIds.has(contextId))) {
      throw new Error(`Training item ${item.id} references missing context.`);
    }
    if (item.playlistIds?.some((playlistId) => !playlistIds.has(playlistId))) {
      throw new Error(`Training item ${item.id} references missing playlist.`);
    }
    if (item.status === 'active' && !schedulerStateIds.has(item.id)) {
      throw new Error(`Active training item ${item.id} is missing scheduler state.`);
    }
  }
  for (const review of data.reviewLogs) {
    if (!trainingItemIds.has(review.trainingItemId)) {
      throw new Error(`Review ${review.id} references missing training item.`);
    }
    if (!sessionIds.has(review.sessionId)) {
      throw new Error(`Review ${review.id} references missing session.`);
    }
    if (
      review.confusionContextId &&
      !contextIds.has(review.confusionContextId) &&
      !review.confusionContextId.includes(':sibling:')
    ) {
      throw new Error(`Review ${review.id} references missing confusion context.`);
    }
  }
  for (const scheduler of data.schedulerStates) {
    if (scheduler.id !== scheduler.trainingItemId) {
      throw new Error(`Scheduler state ${scheduler.id} has a mismatched identity.`);
    }
    if (!trainingItemIds.has(scheduler.trainingItemId)) {
      throw new Error(
        `Scheduler state ${scheduler.id} references missing training item.`,
      );
    }
  }
  for (const decision of data.schedulerDecisions) {
    if (decision.id !== decision.observationId) {
      throw new Error(
        `Scheduler decision ${decision.id} has a mismatched observation ID.`,
      );
    }

    if (!reviewIds.has(decision.observationId)) {
      throw new Error(
        `Scheduler decision ${decision.id} references missing observation.`,
      );
    }
    const review = data.reviewLogs.find((row) => row.id === decision.observationId);
    if (!review || review.trainingItemId !== decision.trainingItemId) {
      throw new Error(
        `Scheduler decision ${decision.id} does not match its raw observation training item.`,
      );
    }
    if (!trainingItemIds.has(decision.trainingItemId)) {
      throw new Error(
        `Scheduler decision ${decision.id} references missing training item.`,
      );
    }
    if (decision.action === 'review' && !decision.grade) {
      throw new Error(`Scheduler decision ${decision.id} is missing its review grade.`);
    }
    if (
      decision.resultingState &&
      decision.resultingDueAt !== decision.resultingState.dueAt
    ) {
      throw new Error(
        `Scheduler decision ${decision.id} has inconsistent resulting due state.`,
      );
    }
  }
  for (const session of data.sessions) {
    if (session.state.sessionId !== session.id) {
      throw new Error(`Session ${session.id} state has a mismatched session ID.`);
    }
    if (
      session.state.planId !== session.planId ||
      session.state.fixtureId !== session.fixtureId
    ) {
      throw new Error(`Session ${session.id} state identity is inconsistent.`);
    }
    if (
      session.committedObservationIds.some(
        (observationId) => !reviewIds.has(observationId),
      )
    ) {
      throw new Error(
        `Session ${session.id} references missing committed observation.`,
      );
    }
    if (
      session.targetIdentityKind === 'training-item' &&
      session.targetIds.some((trainingItemId) => !trainingItemIds.has(trainingItemId))
    ) {
      throw new Error(`Session ${session.id} references missing target training item.`);
    }
    if (
      session.state.targetTrainingItemIds.some(
        (trainingItemId) => !trainingItemIds.has(trainingItemId),
      )
    ) {
      throw new Error(
        `Session ${session.id} state references missing target training item.`,
      );
    }
    if (
      session.state.adaptive?.targetTrainingItemIds.some(
        (trainingItemId) => !trainingItemIds.has(trainingItemId),
      )
    ) {
      throw new Error(
        `Session ${session.id} adaptive metadata references missing training item.`,
      );
    }
    for (const exercise of session.state.adaptive?.exercises ?? []) {
      if (!repertoireIds.has(exercise.repertoireId)) {
        throw new Error(
          `Session ${session.id} adaptive exercise references missing repertoire.`,
        );
      }
      if (
        !contextIds.has(exercise.rootContextId) ||
        !contextIds.has(exercise.targetContextId) ||
        exercise.targetContextIds.some((contextId) => !contextIds.has(contextId))
      ) {
        throw new Error(
          `Session ${session.id} adaptive exercise references missing context.`,
        );
      }
      if (exercise.playlistId && !playlistIds.has(exercise.playlistId)) {
        throw new Error(
          `Session ${session.id} adaptive exercise references missing playlist.`,
        );
      }
    }
  }
  for (const item of data.imports) {
    if (!repertoireIds.has(item.repertoireId)) {
      throw new Error(`Import ${item.id} references missing repertoire.`);
    }
  }
  for (const name of data.openingNames) {
    if (!repertoireIds.has(name.repertoireId) || !contextIds.has(name.contextId)) {
      throw new Error(`Opening name ${name.id} references missing repertoire context.`);
    }
  }
  for (const confusion of data.confusionRelations) {
    if (!trainingItemIds.has(confusion.expectedTrainingItemId)) {
      throw new Error(
        `Confusion relation ${confusion.id} references a missing training item.`,
      );
    }
    if (
      !contextIds.has(confusion.confusionContextId) &&
      !confusion.confusionContextId.includes(':sibling:')
    ) {
      throw new Error(
        `Confusion relation ${confusion.id} references a missing repertoire context.`,
      );
    }
  }
}

function validateBackupData(data: OpeningTrainerBackupData): void {
  validateRecordSchemas(data);
  if (data.repertoires.length > 0) {
    storedRowsToGraph({
      repertoires: data.repertoires,
      repertoireContexts: data.repertoireContexts,
      positions: data.positions,
      moveEdges: data.moveEdges,
      repertoireMoves: data.repertoireMoves,
      playlists: data.playlists,
      playlistEntries: data.playlistEntries,
    });
  } else if (
    data.repertoireContexts.length > 0 ||
    data.positions.length > 0 ||
    data.moveEdges.length > 0 ||
    data.repertoireMoves.length > 0 ||
    data.playlists.length > 0 ||
    data.playlistEntries.length > 0
  ) {
    throw new Error('Backup contains graph data without a repertoire.');
  }
  validateSupplementalRows(data);
}

async function readBackupData(
  database: OpeningTrainerDatabase,
): Promise<OpeningTrainerBackupData> {
  const [
    repertoires,
    repertoireContexts,
    positions,
    moveEdges,
    repertoireMoves,
    decisionRules,
    playlists,
    playlistEntries,
    trainingItems,
    reviewLogs,
    schedulerStates,
    schedulerDecisions,
    sessions,
    settings,
    imports,
    openingNames,
    confusionRelations,
  ] = await Promise.all([
    database.repertoires.toArray(),
    database.repertoireContexts.toArray(),
    database.positions.toArray(),
    database.moveEdges.toArray(),
    database.repertoireMoves.toArray(),
    database.decisionRules.toArray(),
    database.playlists.toArray(),
    database.playlistEntries.toArray(),
    database.trainingItems.toArray(),
    database.reviewLogs.toArray(),
    database.schedulerStates.toArray(),
    database.schedulerDecisions.toArray(),
    database.sessions.toArray(),
    database.settings.toArray(),
    database.imports.toArray(),
    database.openingNames.toArray(),
    database.confusionRelations.toArray(),
  ]);
  return {
    repertoires,
    repertoireContexts,
    positions,
    moveEdges,
    repertoireMoves,
    decisionRules,
    playlists,
    playlistEntries,
    trainingItems,
    reviewLogs,
    schedulerStates,
    schedulerDecisions,
    sessions,
    settings,
    imports,
    openingNames,
    confusionRelations,
  };
}

function sortRows<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function stableData(data: OpeningTrainerBackupData): OpeningTrainerBackupData {
  return {
    repertoires: sortRows(data.repertoires),
    repertoireContexts: sortRows(data.repertoireContexts),
    positions: sortRows(data.positions),
    moveEdges: sortRows(data.moveEdges),
    repertoireMoves: sortRows(data.repertoireMoves),
    decisionRules: sortRows(data.decisionRules),
    playlists: sortRows(data.playlists),
    playlistEntries: sortRows(data.playlistEntries),
    trainingItems: sortRows(data.trainingItems),
    reviewLogs: sortRows(data.reviewLogs),
    schedulerStates: sortRows(data.schedulerStates),
    schedulerDecisions: sortRows(data.schedulerDecisions),
    sessions: sortRows(data.sessions),
    settings: sortRows(data.settings),
    imports: sortRows(data.imports),
    openingNames: sortRows(data.openingNames),
    confusionRelations: sortRows(data.confusionRelations),
  };
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])]),
  );
}

function canonicalBackupText(backup: OpeningTrainerBackup): string {
  const unsigned: OpeningTrainerBackup = {
    format: backup.format,
    version: backup.version,
    exportedAt: backup.exportedAt,
    databaseMeta: backup.databaseMeta,
    data: backup.data,
  };
  return `${JSON.stringify(stableJsonValue(unsigned), null, 2)}\n`;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeLegacySession(session: unknown): SessionRecord {
  const cloned = structuredClone(session) as SessionRecord & {
    state: SessionRecord['state'] & {
      targetStepIds?: readonly string[];
      targetTrainingItemIds?: readonly string[];
    };
  };
  const targetStepIds = cloned.state.targetStepIds ?? [cloned.state.targetStepId];
  return {
    ...cloned,
    targetIdentityKind: cloned.targetIdentityKind ?? 'legacy-step',
    state: {
      ...cloned.state,
      targetStepIds,
      targetTrainingItemIds: cloned.state.targetTrainingItemIds ?? [],
    },
  };
}

function normalizeLegacyV1Backup(source: OpeningTrainerBackup): OpeningTrainerBackup {
  const cutoverAt = source.exportedAt;
  const oldData = source.data as unknown as Record<string, unknown>;
  const trainingItems = structuredClone(oldData.trainingItems as TrainingItemRecord[]);
  const schedulerStates = trainingItems
    .filter((item) => item.status === 'active')
    .map((item): SchedulerStateRecord => ({
      id: item.id,
      trainingItemId: item.id,
      state: createEmptySchedulerState(new Date(cutoverAt)),
      adapterVersion: TS_FSRS_ADAPTER_VERSION,
      parametersVersion: TS_FSRS_PARAMETERS_VERSION,
      mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
      createdAt: cutoverAt,
      updatedAt: cutoverAt,
    }));
  return {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
    exportedAt: source.exportedAt,
    databaseMeta: {
      ...structuredClone(source.databaseMeta),
      databaseSchemaVersion: OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
      portableSchemaVersion: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
      schedulerCutoverAt: source.databaseMeta.schedulerCutoverAt ?? source.exportedAt,
    },
    data: {
      repertoires: structuredClone(oldData.repertoires as RepertoireRecord[]),
      repertoireContexts: structuredClone(
        oldData.repertoireContexts as RepertoireContextRecord[],
      ),
      positions: structuredClone(oldData.positions as PositionRecord[]),
      moveEdges: structuredClone(oldData.moveEdges as MoveEdgeRecord[]),
      repertoireMoves: structuredClone(
        oldData.repertoireMoves as RepertoireMoveRecord[],
      ),
      decisionRules: structuredClone(oldData.decisionRules as DecisionRuleRecord[]),
      playlists: structuredClone(oldData.playlists as PlaylistRecord[]),
      playlistEntries: structuredClone(
        oldData.playlistEntries as PlaylistEntryRecord[],
      ),
      trainingItems,
      reviewLogs: structuredClone(oldData.reviewLogs as ReviewLogRecord[]),
      schedulerStates,
      schedulerDecisions: [],
      sessions: (oldData.sessions as unknown[]).map(normalizeLegacySession),
      settings: structuredClone(oldData.settings as SettingRecord[]),
      imports: structuredClone(oldData.imports as ImportRecord[]),
      openingNames: structuredClone(oldData.openingNames as OpeningNameRecord[]),
      confusionRelations: structuredClone(
        oldData.confusionRelations as ConfusionRelationRecord[],
      ),
    },
  };
}

export async function exportCompleteBackup(
  database: OpeningTrainerDatabase,
  exportedAt = new Date().toISOString(),
): Promise<{ backup: OpeningTrainerBackup; json: string }> {
  const meta = await database.meta.get(DATABASE_META_ID);
  if (!meta) throw new Error('Opening Trainer database metadata is missing.');
  const data = stableData(await readBackupData(database));
  validateBackupData(data);
  const databaseMeta: DatabaseMetaRecord = {
    ...meta,
    updatedAt: exportedAt,
    lastSuccessfulBackupAt: exportedAt,
  };
  const unsigned: OpeningTrainerBackup = {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
    exportedAt,
    databaseMeta,
    data,
  };
  const backup: OpeningTrainerBackup = {
    ...unsigned,
    integrity: {
      algorithm: 'SHA-256',
      digest: await sha256Hex(canonicalBackupText(unsigned)),
    },
  };
  const json = `${JSON.stringify(stableJsonValue(backup), null, 2)}\n`;
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > MAX_BACKUP_BYTES) {
    throw new Error(
      `Complete backup is ${bytes} bytes and exceeds the ${MAX_BACKUP_BYTES}-byte portable backup limit. No backup file was created.`,
    );
  }
  await database.meta.put(databaseMeta);
  return { backup, json };
}

export function previewBackupJson(text: string): BackupPreview {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error(`Backup exceeds ${MAX_BACKUP_BYTES} bytes.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup is not valid JSON.');
  }
  if (!isObject(parsed)) throw new Error('Backup envelope is invalid.');
  if (parsed.format !== OPENING_TRAINER_BACKUP_FORMAT) {
    throw new Error('File is not an Opening Trainer backup.');
  }
  const version = requireNumber(parsed, 'version');
  if (version > OPENING_TRAINER_PORTABLE_SCHEMA_VERSION) {
    throw new Error(
      `Backup version ${version} is newer than this app supports (${OPENING_TRAINER_PORTABLE_SCHEMA_VERSION}).`,
    );
  }
  if (version !== 1 && version !== OPENING_TRAINER_PORTABLE_SCHEMA_VERSION) {
    throw new Error(`Backup version ${version} is not supported.`);
  }
  requireString(parsed, 'exportedAt');
  if (!isObject(parsed.databaseMeta)) {
    throw new Error('Backup database metadata is invalid.');
  }
  const databaseMetaObject = parsed.databaseMeta;
  requireString(databaseMetaObject, 'id');
  requireString(databaseMetaObject, 'createdAt');
  requireString(databaseMetaObject, 'updatedAt');
  optionalString(databaseMetaObject, 'appVersion');
  optionalString(databaseMetaObject, 'lastSuccessfulBackupAt');
  optionalString(databaseMetaObject, 'schedulerCutoverAt');
  const databaseSchemaVersion = requireNumber(
    databaseMetaObject,
    'databaseSchemaVersion',
  );
  const portableSchemaVersion = requireNumber(
    databaseMetaObject,
    'portableSchemaVersion',
  );
  if (databaseSchemaVersion > OPENING_TRAINER_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Backup database schema ${databaseSchemaVersion} is newer than this app supports.`,
    );
  }
  if (version === 2 && portableSchemaVersion !== 2) {
    throw new Error('Backup portable schema metadata is inconsistent.');
  }
  if (version === 1 && portableSchemaVersion !== 1) {
    throw new Error('Legacy backup portable schema metadata is inconsistent.');
  }
  if (!isObject(parsed.data)) throw new Error('Backup data envelope is invalid.');
  const keys = version === 1 ? BACKUP_DATA_KEYS_V1 : BACKUP_DATA_KEYS_V2;
  for (const key of keys) {
    assertRecordArray(parsed.data[key], key);
  }
  if (parsed.integrity !== undefined) {
    if (!isObject(parsed.integrity))
      throw new Error('Backup integrity field is invalid.');
    if (parsed.integrity.algorithm !== 'SHA-256') {
      throw new Error('Backup integrity algorithm is not supported.');
    }
    const digest = requireString(parsed.integrity, 'digest');
    if (!/^[a-f0-9]{64}$/u.test(digest)) {
      throw new Error('Backup SHA-256 digest is invalid.');
    }
  }

  const sourceForIntegrity = structuredClone(parsed) as unknown as OpeningTrainerBackup;
  const backup =
    version === 1
      ? normalizeLegacyV1Backup(sourceForIntegrity)
      : structuredClone(sourceForIntegrity);
  validateBackupData(backup.data);
  const warnings: string[] = [];
  if (version === 1) {
    warnings.push(
      'Legacy PHASE-4 backup will be migrated to scheduler schema v2. Historical review observations remain raw evidence and are not retroactively graded.',
    );
  }
  if (!sourceForIntegrity.integrity) {
    warnings.push(
      'This backup has no embedded SHA-256 verification. Its structure will still be validated before restore.',
    );
  }
  if (backup.data.sessions.some((session) => session.status !== 'session-complete')) {
    warnings.push(
      'The backup contains session state that may be resumable after restore.',
    );
  }
  return {
    backup,
    sourceForIntegrity,
    summary: {
      repertoires: backup.data.repertoires.length,
      playlists: backup.data.playlists.length,
      trainingItems: backup.data.trainingItems.length,
      reviewLogs: backup.data.reviewLogs.length,
      schedulerStates: backup.data.schedulerStates.length,
      schedulerDecisions: backup.data.schedulerDecisions.length,
      sessions: backup.data.sessions.length,
      settings: backup.data.settings.length,
    },
    warnings,
  };
}

export async function verifyBackupIntegrity(preview: BackupPreview): Promise<void> {
  const source = preview.sourceForIntegrity ?? preview.backup;
  const integrity = source.integrity;
  if (!integrity) return;
  const actual = await sha256Hex(canonicalBackupText(source));
  if (actual !== integrity.digest) {
    throw new Error(
      'Backup SHA-256 verification failed. The file may be corrupted or modified.',
    );
  }
}

async function putBackupData(
  database: OpeningTrainerDatabase,
  data: OpeningTrainerBackupData,
): Promise<void> {
  if (data.repertoires.length) await database.repertoires.bulkPut(data.repertoires);
  if (data.repertoireContexts.length) {
    await database.repertoireContexts.bulkPut(data.repertoireContexts);
  }
  if (data.positions.length) await database.positions.bulkPut(data.positions);
  if (data.moveEdges.length) await database.moveEdges.bulkPut(data.moveEdges);
  if (data.repertoireMoves.length) {
    await database.repertoireMoves.bulkPut(data.repertoireMoves);
  }
  if (data.decisionRules.length)
    await database.decisionRules.bulkPut(data.decisionRules);
  if (data.playlists.length) await database.playlists.bulkPut(data.playlists);
  if (data.playlistEntries.length) {
    await database.playlistEntries.bulkPut(data.playlistEntries);
  }
  if (data.trainingItems.length) {
    await database.trainingItems.bulkPut(data.trainingItems);
  }
  if (data.reviewLogs.length) await database.reviewLogs.bulkPut(data.reviewLogs);
  if (data.schedulerStates.length) {
    await database.schedulerStates.bulkPut(data.schedulerStates);
  }
  if (data.schedulerDecisions.length) {
    await database.schedulerDecisions.bulkPut(data.schedulerDecisions);
  }
  if (data.sessions.length) await database.sessions.bulkPut(data.sessions);
  if (data.settings.length) await database.settings.bulkPut(data.settings);
  if (data.imports.length) await database.imports.bulkPut(data.imports);
  if (data.openingNames.length) await database.openingNames.bulkPut(data.openingNames);
  if (data.confusionRelations.length) {
    await database.confusionRelations.bulkPut(data.confusionRelations);
  }
}

export async function validateDatabaseIntegrity(
  database: OpeningTrainerDatabase,
): Promise<void> {
  const data = await readBackupData(database);
  validateBackupData(data);
}

export async function commitBackupRestore(
  database: OpeningTrainerDatabase,
  preview: BackupPreview,
  options: {
    restoredAt?: string;
    injectFailureBeforeCommit?: () => void;
  } = {},
): Promise<void> {
  validateBackupData(preview.backup.data);
  await verifyBackupIntegrity(preview);
  const restoredAt = options.restoredAt ?? new Date().toISOString();
  await database.transaction('rw', database.tables, async () => {
    for (const name of USER_DATA_TABLE_NAMES) {
      await database.table(name).clear();
    }
    await putBackupData(database, structuredClone(preview.backup.data));
    await database.meta.put({
      ...preview.backup.databaseMeta,
      id: DATABASE_META_ID,
      databaseSchemaVersion: OPENING_TRAINER_DATABASE_SCHEMA_VERSION,
      portableSchemaVersion: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
      schedulerCutoverAt: preview.backup.databaseMeta.schedulerCutoverAt ?? restoredAt,
      updatedAt: restoredAt,
    });
    const staged = await readBackupData(database);
    validateBackupData(staged);
    options.injectFailureBeforeCommit?.();
  });
  await validateDatabaseIntegrity(database);
}

export const PHASE5_BACKUP_POLICY = {
  mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
  responsePolicyVersion: RESPONSE_TIME_POLICY_VERSION,
  adapterVersion: TS_FSRS_ADAPTER_VERSION,
  parametersVersion: TS_FSRS_PARAMETERS_VERSION,
} as const;
