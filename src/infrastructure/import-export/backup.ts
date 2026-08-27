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
export const MAX_BACKUP_BYTES = 20_000_000;

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

function requireNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Backup field ${key} must be a finite number.`);
  }
  return value;
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

function validateSupplementalRows(data: OpeningTrainerBackupData): void {
  const repertoireIds = ids(data.repertoires);
  const contextIds = ids(data.repertoireContexts);
  const trainingItemIds = ids(data.trainingItems);
  const reviewIds = ids(data.reviewLogs);
  const sessionIds = ids(data.sessions);

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
    if (
      session.committedObservationIds.some(
        (observationId) => !reviewIds.has(observationId),
      )
    ) {
      throw new Error(
        `Session ${session.id} references missing committed observation.`,
      );
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
  const backup: OpeningTrainerBackup = {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: OPENING_TRAINER_PORTABLE_SCHEMA_VERSION,
    exportedAt,
    databaseMeta,
    data,
  };
  const json = `${JSON.stringify(stableJsonValue(backup), null, 2)}\n`;
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
  if (!isObject(parsed.databaseMeta))
    throw new Error('Backup database metadata is invalid.');
  const databaseMetaObject = parsed.databaseMeta;
  requireString(databaseMetaObject, 'id');
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

  const backup = structuredClone(parsed) as unknown as OpeningTrainerBackup;
  validateBackupData(backup.data);
  const warnings: string[] = [];
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

async function putBackupData(
  database: OpeningTrainerDatabase,
  data: OpeningTrainerBackupData,
): Promise<void> {
  if (data.repertoires.length) await database.repertoires.bulkPut(data.repertoires);
  if (data.repertoireContexts.length)
    await database.repertoireContexts.bulkPut(data.repertoireContexts);
  if (data.positions.length) await database.positions.bulkPut(data.positions);
  if (data.moveEdges.length) await database.moveEdges.bulkPut(data.moveEdges);
  if (data.repertoireMoves.length)
    await database.repertoireMoves.bulkPut(data.repertoireMoves);
  if (data.decisionRules.length)
    await database.decisionRules.bulkPut(data.decisionRules);
  if (data.playlists.length) await database.playlists.bulkPut(data.playlists);
  if (data.playlistEntries.length)
    await database.playlistEntries.bulkPut(data.playlistEntries);
  if (data.trainingItems.length)
    await database.trainingItems.bulkPut(data.trainingItems);
  if (data.reviewLogs.length) await database.reviewLogs.bulkPut(data.reviewLogs);
  if (data.sessions.length) await database.sessions.bulkPut(data.sessions);
  if (data.settings.length) await database.settings.bulkPut(data.settings);
  if (data.imports.length) await database.imports.bulkPut(data.imports);
  if (data.openingNames.length) await database.openingNames.bulkPut(data.openingNames);
  if (data.confusionRelations.length)
    await database.confusionRelations.bulkPut(data.confusionRelations);
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
    options.injectFailureBeforeCommit?.();
  });
  await validateDatabaseIntegrity(database);
}
