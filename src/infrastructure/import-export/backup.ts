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
  type SessionRecord,
  type SettingRecord,
  type TrainingItemRecord,
} from '../db/openingTrainerDatabase';
import { storedRowsToGraph } from '../db/graphStorage';

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
    sessions: number;
    settings: number;
  };
  warnings: readonly string[];
}

const BACKUP_DATA_KEYS = [
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

function requireNonNegativeInteger(record: Record<string, unknown>, key: string): number {
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
  return value;
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

function requireObject(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isObject(value)) throw new Error(`Backup field ${key} must be an object.`);
  return value;
}

function validateLocator(value: unknown, label: string): void {
  if (value === undefined) return;
  if (!isObject(value)) throw new Error(`${label} sourceLocator must be an object.`);
  for (const key of ['game', 'line', 'column']) {
    const number = requireNonNegativeInteger(value, key);
    if (number < 1) throw new Error(`${label} sourceLocator.${key} must be at least 1.`);
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
  if (responseTime < 0) throw new Error(`${label} responseTimeMs must be non-negative.`);
  const hintLevel = requireNonNegativeInteger(value, 'hintLevel');
  if (hintLevel > 4) throw new Error(`${label} hintLevel must be between 0 and 4.`);
  requireNonNegativeInteger(value, 'illegalAttemptCount');
  requireString(value, 'expectedMoveSetKey');
  optionalString(value, 'playedUci');
  optionalString(value, 'confusionContextId');
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
  if (!Array.isArray(value.evidence)) throw new Error(`${label} evidence must be an array.`);
  value.evidence.forEach((review, index) =>
    validateReviewRecord(review, `${label} evidence ${index}`),
  );
  if (!Array.isArray(value.retestQueue)) {
    throw new Error(`${label} retestQueue must be an array.`);
  }
  value.retestQueue.forEach((ticket, index) => {
    if (!isObject(ticket)) throw new Error(`${label} retest ticket ${index} is invalid.`);
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
    if (!stepId || !Number.isInteger(attempt) || Number(attempt) < 0) {
      throw new Error(`${label} retestAttemptsByStep contains invalid data.`);
    }
  }
  if (value.lastMove !== undefined && !isObject(value.lastMove)) {
    throw new Error(`${label} lastMove must be an object when present.`);
  }
  if (value.feedback !== undefined) {
    if (!isObject(value.feedback)) throw new Error(`${label} feedback must be an object.`);
    requireEnum(
      value.feedback,
      'kind',
      new Set(['info', 'correct', 'illegal', 'outside', 'variation', 'reveal', 'repair']),
    );
    requireString(value.feedback, 'title');
    requireString(value.feedback, 'message');
  }
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
    if (seen.has(id)) throw new Error(`Backup table ${name} contains duplicate ID ${id}.`);
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
    requireEnum(record, 'status', TRAINING_ITEM_STATUSES);
  });
  data.reviewLogs.forEach((row, index) =>
    validateReviewRecord(row, `reviewLogs[${index}]`),
  );
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
    requireStringArray(record, 'pendingRepairIds');
    requireStringArray(record, 'committedObservationIds');
    optionalString(record, 'completedAt');
    validateSessionState(record.state, `sessions[${index}]`);
  });
  data.settings.forEach((row) => {
    const record = row as unknown as Record<string, unknown>;
    requireString(record, 'id');
    requireString(record, 'updatedAt');
    if (!Object.hasOwn(record, 'value')) throw new Error('Backup setting is missing value.');
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
  }
  for (const review of data.reviewLogs) {
    if (!trainingItemIds.has(review.trainingItemId)) {
      throw new Error(`Review ${review.id} references missing training item.`);
    }
    if (!sessionIds.has(review.sessionId)) {
      throw new Error(`Review ${review.id} references missing session.`);
    }
  }
  for (const session of data.sessions) {
    if (session.state.sessionId !== session.id) {
      throw new Error(`Session ${session.id} state has a mismatched session ID.`);
    }
    if (session.state.planId !== session.planId || session.state.fixtureId !== session.fixtureId) {
      throw new Error(`Session ${session.id} state identity is inconsistent.`);
    }
    if (
      session.committedObservationIds.some(
        (observationId) => !reviewIds.has(observationId),
      )
    ) {
      throw new Error(`Session ${session.id} references missing committed observation.`);
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
    if (
      !trainingItemIds.has(confusion.expectedTrainingItemId) ||
      !contextIds.has(confusion.confusionContextId)
    ) {
      throw new Error(`Confusion relation ${confusion.id} references missing data.`);
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
  const { integrity: _integrity, ...unsigned } = backup;
  return `${JSON.stringify(stableJsonValue(unsigned), null, 2)}\n`;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
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
  if (version !== OPENING_TRAINER_PORTABLE_SCHEMA_VERSION) {
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
  if (portableSchemaVersion !== OPENING_TRAINER_PORTABLE_SCHEMA_VERSION) {
    throw new Error('Backup portable schema metadata is inconsistent.');
  }
  if (!isObject(parsed.data)) throw new Error('Backup data envelope is invalid.');
  for (const key of BACKUP_DATA_KEYS) {
    assertRecordArray(parsed.data[key], key);
  }
  if (parsed.integrity !== undefined) {
    if (!isObject(parsed.integrity)) throw new Error('Backup integrity field is invalid.');
    if (parsed.integrity.algorithm !== 'SHA-256') {
      throw new Error('Backup integrity algorithm is not supported.');
    }
    const digest = requireString(parsed.integrity, 'digest');
    if (!/^[a-f0-9]{64}$/u.test(digest)) {
      throw new Error('Backup SHA-256 digest is invalid.');
    }
  }

  const backup = structuredClone(parsed) as unknown as OpeningTrainerBackup;
  validateBackupData(backup.data);
  const warnings: string[] = [];
  if (!backup.integrity) {
    warnings.push(
      'This legacy v1 backup predates embedded SHA-256 verification. Its structure will still be validated before restore.',
    );
  }
  if (backup.data.sessions.some((session) => session.status !== 'session-complete')) {
    warnings.push(
      'The backup contains session state that may be resumable after restore.',
    );
  }
  return {
    backup,
    summary: {
      repertoires: backup.data.repertoires.length,
      playlists: backup.data.playlists.length,
      trainingItems: backup.data.trainingItems.length,
      reviewLogs: backup.data.reviewLogs.length,
      sessions: backup.data.sessions.length,
      settings: backup.data.settings.length,
    },
    warnings,
  };
}

export async function verifyBackupIntegrity(preview: BackupPreview): Promise<void> {
  const integrity = preview.backup.integrity;
  if (!integrity) return;
  const actual = await sha256Hex(canonicalBackupText(preview.backup));
  if (actual !== integrity.digest) {
    throw new Error('Backup SHA-256 verification failed. The file may be corrupted or modified.');
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
  if (data.decisionRules.length) await database.decisionRules.bulkPut(data.decisionRules);
  if (data.playlists.length) await database.playlists.bulkPut(data.playlists);
  if (data.playlistEntries.length) {
    await database.playlistEntries.bulkPut(data.playlistEntries);
  }
  if (data.trainingItems.length) {
    await database.trainingItems.bulkPut(data.trainingItems);
  }
  if (data.reviewLogs.length) await database.reviewLogs.bulkPut(data.reviewLogs);
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
      updatedAt: restoredAt,
    });
    const staged = await readBackupData(database);
    validateBackupData(staged);
    options.injectFailureBeforeCommit?.();
  });
  await validateDatabaseIntegrity(database);
}
