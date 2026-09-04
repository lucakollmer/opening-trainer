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
  USER_DATA_TABLE_NAMES,
  type DatabaseMetaRecord,
} from '../db/openingTrainerDatabase';
import {
  PHASE6_DATABASE_SCHEMA_VERSION,
  PHASE6_PORTABLE_SCHEMA_VERSION,
  PHASE6_USER_DATA_TABLE_NAMES,
  type Phase6OpeningTrainerDatabase,
} from '../db/phase6Database';
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
} from '../db/phase6Validation';
import {
  MAX_BACKUP_BYTES,
  OPENING_TRAINER_BACKUP_FORMAT,
  previewBackupJson,
  verifyBackupIntegrity,
  type BackupIntegrity,
  type BackupPreview,
  type OpeningTrainerBackup,
  type OpeningTrainerBackupData,
} from './backup';

export interface Phase6BackupData extends OpeningTrainerBackupData {
  repertoireStates: RepertoireLifecycleRecord[];
  playlistStates: PlaylistLifecycleRecord[];
  managedOpeningNames: ManagedOpeningNameRecord[];
  nameTrainingItems: NameTrainingItemRecord[];
  nameReviewLogs: NameReviewLogRecord[];
  nameSchedulerStates: IndependentSchedulerStateRecord[];
  nameSchedulerDecisions: IndependentSchedulerDecisionRecord[];
  nameSessions: NameSessionRecord[];
  contrastItems: ContrastItemRecord[];
  contrastReviewLogs: ContrastReviewLogRecord[];
  contrastSchedulerStates: IndependentSchedulerStateRecord[];
  contrastSchedulerDecisions: IndependentSchedulerDecisionRecord[];
  contrastSessions: ContrastSessionRecord[];
}

export interface Phase6Backup {
  format: typeof OPENING_TRAINER_BACKUP_FORMAT;
  version: typeof PHASE6_PORTABLE_SCHEMA_VERSION;
  exportedAt: string;
  databaseMeta: DatabaseMetaRecord;
  data: Phase6BackupData;
  integrity?: BackupIntegrity;
}

export interface Phase6BackupPreview {
  backup: Phase6Backup;
  warnings: readonly string[];
  sourceLegacyPreview?: BackupPreview;
}

const PHASE6_KEYS = [
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function canonicalBackupText(backup: Phase6Backup): string {
  const unsigned: Phase6Backup = {
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

function sortRows<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function emptyPhase6Data(): Pick<Phase6BackupData, (typeof PHASE6_KEYS)[number]> {
  return {
    repertoireStates: [],
    playlistStates: [],
    managedOpeningNames: [],
    nameTrainingItems: [],
    nameReviewLogs: [],
    nameSchedulerStates: [],
    nameSchedulerDecisions: [],
    nameSessions: [],
    contrastItems: [],
    contrastReviewLogs: [],
    contrastSchedulerStates: [],
    contrastSchedulerDecisions: [],
    contrastSessions: [],
  };
}

function baseData(data: Phase6BackupData): OpeningTrainerBackupData {
  return {
    repertoires: data.repertoires,
    repertoireContexts: data.repertoireContexts,
    positions: data.positions,
    moveEdges: data.moveEdges,
    repertoireMoves: data.repertoireMoves,
    decisionRules: data.decisionRules,
    playlists: data.playlists,
    playlistEntries: data.playlistEntries,
    trainingItems: data.trainingItems,
    reviewLogs: data.reviewLogs,
    schedulerStates: data.schedulerStates,
    schedulerDecisions: data.schedulerDecisions,
    sessions: data.sessions,
    settings: data.settings,
    imports: data.imports,
    openingNames: data.openingNames,
    confusionRelations: data.confusionRelations,
  };
}

function baseValidationPreview(
  data: OpeningTrainerBackupData,
  exportedAt: string,
  meta: DatabaseMetaRecord,
): BackupPreview {
  const pseudo: OpeningTrainerBackup = {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: 2,
    exportedAt,
    databaseMeta: {
      ...meta,
      databaseSchemaVersion: 2,
      portableSchemaVersion: 2,
    },
    data,
  };
  return previewBackupJson(`${JSON.stringify(pseudo)}\n`);
}

function assertUnique(rows: readonly { id: string }[], label: string): void {
  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length) {
    throw new Error(`Backup contains duplicate ${label} identities.`);
  }
}

function validatePhase6Data(data: Phase6BackupData): void {
  for (const key of PHASE6_KEYS) assertUnique(data[key], key);
  data.repertoireStates.forEach((row) =>
    assertLifecycleRecord(row, `Repertoire state ${row.id}`),
  );
  data.playlistStates.forEach((row) =>
    assertLifecycleRecord(row, `Playlist state ${row.id}`),
  );
  data.managedOpeningNames.forEach(assertManagedOpeningNameRecord);
  data.nameTrainingItems.forEach(assertNameTrainingItemRecord);
  data.nameReviewLogs.forEach(assertNameReviewLogRecord);
  data.nameSchedulerStates.forEach((row) =>
    assertIndependentSchedulerStateRecord(row, PHASE6_NAME_POLICY_VERSION),
  );
  data.nameSchedulerDecisions.forEach((row) =>
    assertIndependentSchedulerDecisionRecord(row, PHASE6_NAME_POLICY_VERSION),
  );
  data.nameSessions.forEach(assertNameSessionRecord);
  data.contrastItems.forEach(assertContrastItemRecord);
  data.contrastReviewLogs.forEach(assertContrastReviewLogRecord);
  data.contrastSchedulerStates.forEach((row) =>
    assertIndependentSchedulerStateRecord(row, PHASE6_CONTRAST_POLICY_VERSION),
  );
  data.contrastSchedulerDecisions.forEach((row) =>
    assertIndependentSchedulerDecisionRecord(row, PHASE6_CONTRAST_POLICY_VERSION),
  );
  data.contrastSessions.forEach(assertContrastSessionRecord);

  const repertoireIds = new Set(data.repertoires.map((row) => row.id));
  const playlistIds = new Set(data.playlists.map((row) => row.id));
  const contextIds = new Set(data.repertoireContexts.map((row) => row.id));
  const trainingItemIds = new Set(data.trainingItems.map((row) => row.id));
  const nameItemIds = new Set(data.nameTrainingItems.map((row) => row.id));
  const nameSessionIds = new Set(data.nameSessions.map((row) => row.id));
  const nameReviewIds = new Set(data.nameReviewLogs.map((row) => row.id));
  const contrastItemIds = new Set(data.contrastItems.map((row) => row.id));
  const contrastSessionIds = new Set(data.contrastSessions.map((row) => row.id));
  const contrastReviewIds = new Set(data.contrastReviewLogs.map((row) => row.id));

  for (const state of data.repertoireStates) {
    if (!repertoireIds.has(state.id)) {
      throw new Error(`Repertoire state ${state.id} references a missing repertoire.`);
    }
  }
  for (const state of data.playlistStates) {
    if (!playlistIds.has(state.id)) {
      throw new Error(`Playlist state ${state.id} references a missing playlist.`);
    }
  }
  const nameContexts = new Set<string>();
  for (const name of data.managedOpeningNames) {
    if (
      !repertoireIds.has(name.repertoireId) ||
      !contextIds.has(name.contextId)
    ) {
      throw new Error(`Opening name ${name.id} references missing graph state.`);
    }
    if (nameContexts.has(name.contextId)) {
      throw new Error(`Multiple managed opening names target context ${name.contextId}.`);
    }
    nameContexts.add(name.contextId);
  }
  for (const item of data.nameTrainingItems) {
    if (
      !repertoireIds.has(item.repertoireId) ||
      !contextIds.has(item.contextId)
    ) {
      throw new Error(`Name training item ${item.id} references missing graph state.`);
    }
  }
  for (const review of data.nameReviewLogs) {
    if (
      !nameItemIds.has(review.nameTrainingItemId) ||
      !nameSessionIds.has(review.sessionId)
    ) {
      throw new Error(`Name review ${review.id} references missing session or item.`);
    }
  }
  for (const state of data.nameSchedulerStates) {
    if (!nameItemIds.has(state.itemId)) {
      throw new Error(`Name scheduler state ${state.id} references a missing item.`);
    }
  }
  for (const decision of data.nameSchedulerDecisions) {
    if (
      !nameItemIds.has(decision.itemId) ||
      !nameReviewIds.has(decision.observationId)
    ) {
      throw new Error(`Name scheduler decision ${decision.id} is dangling.`);
    }
  }
  for (const session of data.nameSessions) {
    if (session.itemIds.some((id) => !nameItemIds.has(id))) {
      throw new Error(`Name session ${session.id} references a missing item.`);
    }
  }
  for (const item of data.contrastItems) {
    if (
      !repertoireIds.has(item.repertoireId) ||
      !contextIds.has(item.expectedContextId) ||
      !contextIds.has(item.confusedContextId) ||
      !trainingItemIds.has(item.sourceTrainingItemId)
    ) {
      throw new Error(`Contrast item ${item.id} references missing graph state.`);
    }
  }
  for (const review of data.contrastReviewLogs) {
    if (
      !contrastItemIds.has(review.contrastItemId) ||
      !contrastSessionIds.has(review.sessionId)
    ) {
      throw new Error(`Contrast review ${review.id} references missing session or item.`);
    }
  }
  for (const state of data.contrastSchedulerStates) {
    if (!contrastItemIds.has(state.itemId)) {
      throw new Error(`Contrast scheduler state ${state.id} references a missing item.`);
    }
  }
  for (const decision of data.contrastSchedulerDecisions) {
    if (
      !contrastItemIds.has(decision.itemId) ||
      !contrastReviewIds.has(decision.observationId)
    ) {
      throw new Error(`Contrast scheduler decision ${decision.id} is dangling.`);
    }
  }
  for (const session of data.contrastSessions) {
    if (session.itemIds.some((id) => !contrastItemIds.has(id))) {
      throw new Error(`Contrast session ${session.id} references a missing item.`);
    }
  }
}

async function readData(
  database: Phase6OpeningTrainerDatabase,
): Promise<Phase6BackupData> {
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
    repertoireStates,
    playlistStates,
    managedOpeningNames,
    nameTrainingItems,
    nameReviewLogs,
    nameSchedulerStates,
    nameSchedulerDecisions,
    nameSessions,
    contrastItems,
    contrastReviewLogs,
    contrastSchedulerStates,
    contrastSchedulerDecisions,
    contrastSessions,
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
    database.repertoireStates.toArray(),
    database.playlistStates.toArray(),
    database.managedOpeningNames.toArray(),
    database.nameTrainingItems.toArray(),
    database.nameReviewLogs.toArray(),
    database.nameSchedulerStates.toArray(),
    database.nameSchedulerDecisions.toArray(),
    database.nameSessions.toArray(),
    database.contrastItems.toArray(),
    database.contrastReviewLogs.toArray(),
    database.contrastSchedulerStates.toArray(),
    database.contrastSchedulerDecisions.toArray(),
    database.contrastSessions.toArray(),
  ]);
  return {
    repertoires: sortRows(repertoires),
    repertoireContexts: sortRows(repertoireContexts),
    positions: sortRows(positions),
    moveEdges: sortRows(moveEdges),
    repertoireMoves: sortRows(repertoireMoves),
    decisionRules: sortRows(decisionRules),
    playlists: sortRows(playlists),
    playlistEntries: sortRows(playlistEntries),
    trainingItems: sortRows(trainingItems),
    reviewLogs: sortRows(reviewLogs),
    schedulerStates: sortRows(schedulerStates),
    schedulerDecisions: sortRows(schedulerDecisions),
    sessions: sortRows(sessions),
    settings: sortRows(settings),
    imports: sortRows(imports),
    openingNames: sortRows(openingNames),
    confusionRelations: sortRows(confusionRelations),
    repertoireStates: sortRows(repertoireStates),
    playlistStates: sortRows(playlistStates),
    managedOpeningNames: sortRows(managedOpeningNames),
    nameTrainingItems: sortRows(nameTrainingItems),
    nameReviewLogs: sortRows(nameReviewLogs),
    nameSchedulerStates: sortRows(nameSchedulerStates),
    nameSchedulerDecisions: sortRows(nameSchedulerDecisions),
    nameSessions: sortRows(nameSessions),
    contrastItems: sortRows(contrastItems),
    contrastReviewLogs: sortRows(contrastReviewLogs),
    contrastSchedulerStates: sortRows(contrastSchedulerStates),
    contrastSchedulerDecisions: sortRows(contrastSchedulerDecisions),
    contrastSessions: sortRows(contrastSessions),
  };
}

export async function exportPhase6Backup(
  database: Phase6OpeningTrainerDatabase,
  exportedAt = new Date().toISOString(),
): Promise<{ backup: Phase6Backup; json: string }> {
  const meta = await database.meta.get(DATABASE_META_ID);
  if (!meta) throw new Error('Opening Trainer database metadata is missing.');
  const data = await readData(database);
  baseValidationPreview(baseData(data), exportedAt, meta);
  validatePhase6Data(data);
  const databaseMeta: DatabaseMetaRecord = {
    ...meta,
    databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
    portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
    updatedAt: exportedAt,
    lastSuccessfulBackupAt: exportedAt,
  };
  const unsigned: Phase6Backup = {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: PHASE6_PORTABLE_SCHEMA_VERSION,
    exportedAt,
    databaseMeta,
    data,
  };
  const backup: Phase6Backup = {
    ...unsigned,
    integrity: {
      algorithm: 'SHA-256',
      digest: await sha256Hex(canonicalBackupText(unsigned)),
    },
  };
  const json = `${JSON.stringify(stableJsonValue(backup), null, 2)}\n`;
  if (new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) {
    throw new Error(
      `Complete backup exceeds the ${MAX_BACKUP_BYTES}-byte portable backup limit.`,
    );
  }
  await database.meta.put(databaseMeta);
  return { backup, json };
}

function normalizedLegacyBackup(preview: BackupPreview): Phase6Backup {
  return {
    format: OPENING_TRAINER_BACKUP_FORMAT,
    version: PHASE6_PORTABLE_SCHEMA_VERSION,
    exportedAt: preview.backup.exportedAt,
    databaseMeta: {
      ...preview.backup.databaseMeta,
      databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
      portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
    },
    data: {
      ...structuredClone(preview.backup.data),
      ...emptyPhase6Data(),
    },
  };
}

export function previewPhase6BackupJson(text: string): Phase6BackupPreview {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error(`Backup exceeds ${MAX_BACKUP_BYTES} bytes.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Backup is not valid JSON.');
  }
  if (!isObject(parsed) || parsed.format !== OPENING_TRAINER_BACKUP_FORMAT) {
    throw new Error('File is not an Opening Trainer backup.');
  }
  const version = Number(parsed.version);
  if (version === 1 || version === 2) {
    const sourceLegacyPreview = previewBackupJson(text);
    const backup = normalizedLegacyBackup(sourceLegacyPreview);
    return {
      backup,
      sourceLegacyPreview,
      warnings: [
        ...sourceLegacyPreview.warnings,
        'Legacy backup contains no PHASE-6 archive, name-recall or contrast state; those tables will be restored empty.',
      ],
    };
  }
  if (version !== PHASE6_PORTABLE_SCHEMA_VERSION) {
    throw new Error(`Backup version ${version} is not supported.`);
  }
  if (!isObject(parsed.databaseMeta) || !isObject(parsed.data)) {
    throw new Error('Backup envelope is invalid.');
  }
  for (const key of PHASE6_KEYS) {
    if (!Array.isArray(parsed.data[key])) {
      throw new Error(`Backup data.${key} must be an array.`);
    }
  }
  const backup = structuredClone(parsed) as unknown as Phase6Backup;
  if (
    backup.databaseMeta.databaseSchemaVersion > PHASE6_DATABASE_SCHEMA_VERSION ||
    backup.databaseMeta.portableSchemaVersion !== PHASE6_PORTABLE_SCHEMA_VERSION
  ) {
    throw new Error('Backup PHASE-6 schema metadata is inconsistent.');
  }
  baseValidationPreview(
    baseData(backup.data),
    backup.exportedAt,
    backup.databaseMeta,
  );
  validatePhase6Data(backup.data);
  if (backup.integrity) {
    if (
      backup.integrity.algorithm !== 'SHA-256' ||
      !/^[a-f0-9]{64}$/u.test(backup.integrity.digest)
    ) {
      throw new Error('Backup SHA-256 integrity field is invalid.');
    }
  }
  return {
    backup,
    warnings: backup.integrity
      ? []
      : [
          'This backup has no embedded SHA-256 verification. Its full structure will still be validated before restore.',
        ],
  };
}

export async function verifyPhase6BackupIntegrity(
  preview: Phase6BackupPreview,
): Promise<void> {
  if (preview.sourceLegacyPreview) {
    await verifyBackupIntegrity(preview.sourceLegacyPreview);
    return;
  }
  const integrity = preview.backup.integrity;
  if (!integrity) return;
  const actual = await sha256Hex(canonicalBackupText(preview.backup));
  if (actual !== integrity.digest) {
    throw new Error(
      'Backup SHA-256 verification failed. The file may be corrupted or modified.',
    );
  }
}

async function putData(
  database: Phase6OpeningTrainerDatabase,
  data: Phase6BackupData,
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
  if (data.trainingItems.length) await database.trainingItems.bulkPut(data.trainingItems);
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
  if (data.repertoireStates.length) {
    await database.repertoireStates.bulkPut(data.repertoireStates);
  }
  if (data.playlistStates.length) {
    await database.playlistStates.bulkPut(data.playlistStates);
  }
  if (data.managedOpeningNames.length) {
    await database.managedOpeningNames.bulkPut(data.managedOpeningNames);
  }
  if (data.nameTrainingItems.length) {
    await database.nameTrainingItems.bulkPut(data.nameTrainingItems);
  }
  if (data.nameReviewLogs.length) {
    await database.nameReviewLogs.bulkPut(data.nameReviewLogs);
  }
  if (data.nameSchedulerStates.length) {
    await database.nameSchedulerStates.bulkPut(data.nameSchedulerStates);
  }
  if (data.nameSchedulerDecisions.length) {
    await database.nameSchedulerDecisions.bulkPut(data.nameSchedulerDecisions);
  }
  if (data.nameSessions.length) await database.nameSessions.bulkPut(data.nameSessions);
  if (data.contrastItems.length) await database.contrastItems.bulkPut(data.contrastItems);
  if (data.contrastReviewLogs.length) {
    await database.contrastReviewLogs.bulkPut(data.contrastReviewLogs);
  }
  if (data.contrastSchedulerStates.length) {
    await database.contrastSchedulerStates.bulkPut(data.contrastSchedulerStates);
  }
  if (data.contrastSchedulerDecisions.length) {
    await database.contrastSchedulerDecisions.bulkPut(data.contrastSchedulerDecisions);
  }
  if (data.contrastSessions.length) {
    await database.contrastSessions.bulkPut(data.contrastSessions);
  }
}

export async function validatePhase6Database(
  database: Phase6OpeningTrainerDatabase,
): Promise<void> {
  const data = await readData(database);
  const meta = await database.meta.get(DATABASE_META_ID);
  if (!meta) throw new Error('Opening Trainer database metadata is missing.');
  baseValidationPreview(baseData(data), meta.updatedAt, meta);
  validatePhase6Data(data);
}

export async function commitPhase6BackupRestore(
  database: Phase6OpeningTrainerDatabase,
  preview: Phase6BackupPreview,
  options: {
    restoredAt?: string;
    injectFailureBeforeCommit?: () => void;
  } = {},
): Promise<void> {
  await verifyPhase6BackupIntegrity(preview);
  const restoredAt = options.restoredAt ?? new Date().toISOString();
  const data = structuredClone(preview.backup.data);
  baseValidationPreview(baseData(data), preview.backup.exportedAt, preview.backup.databaseMeta);
  validatePhase6Data(data);
  await database.transaction('rw', database.tables, async () => {
    for (const name of [...USER_DATA_TABLE_NAMES, ...PHASE6_USER_DATA_TABLE_NAMES]) {
      await database.table(name).clear();
    }
    await putData(database, data);
    await database.meta.put({
      ...preview.backup.databaseMeta,
      id: DATABASE_META_ID,
      databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
      portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
      updatedAt: restoredAt,
    });
    const staged = await readData(database);
    baseValidationPreview(baseData(staged), restoredAt, {
      ...preview.backup.databaseMeta,
      databaseSchemaVersion: PHASE6_DATABASE_SCHEMA_VERSION,
      portableSchemaVersion: PHASE6_PORTABLE_SCHEMA_VERSION,
      updatedAt: restoredAt,
    });
    validatePhase6Data(staged);
    options.injectFailureBeforeCommit?.();
  });
  await validatePhase6Database(database);
}
