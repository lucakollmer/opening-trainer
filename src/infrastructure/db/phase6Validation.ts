import {
  OPENING_NAME_MAPPING_POLICY_VERSION,
  validateOpeningNameLabels,
} from '../../domain/phase6/nameRecall';
import { PHASE6_CONTRAST_MAPPING_POLICY_VERSION } from '../../domain/phase6/contrast';
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
  SCHEDULER_STATE_SCHEMA_VERSION,
  type SchedulerState,
} from '../../domain/scheduling/schedulerPort';
import {
  TS_FSRS_ADAPTER_VERSION,
  TS_FSRS_PARAMETERS_VERSION,
} from '../scheduling/tsFsrsAdapter';

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const SCHEDULER_STAGES = new Set(['new', 'learning', 'review', 'relearning']);

export const PHASE6_NAME_POLICY_VERSION = OPENING_NAME_MAPPING_POLICY_VERSION;
export const PHASE6_CONTRAST_POLICY_VERSION =
  PHASE6_CONTRAST_MAPPING_POLICY_VERSION;

export function assertPhase6IsoDateTime(
  value: string | undefined,
  label: string,
): void {
  if (
    !value ||
    !ISO_DATE_TIME_PATTERN.test(value) ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new Error(`${label} must be a valid ISO date-time.`);
  }
}

function assertSchedulerState(state: SchedulerState, label: string): void {
  if (state.schemaVersion !== SCHEDULER_STATE_SCHEMA_VERSION) {
    throw new Error(`${label} uses an unsupported scheduler-state schema.`);
  }
  assertPhase6IsoDateTime(state.dueAt, `${label}.dueAt`);
  if (state.lastReviewAt !== undefined) {
    assertPhase6IsoDateTime(state.lastReviewAt, `${label}.lastReviewAt`);
  }
  for (const [field, value] of [
    ['stability', state.stability],
    ['difficulty', state.difficulty],
    ['elapsedDays', state.elapsedDays],
    ['scheduledDays', state.scheduledDays],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label}.${field} must be a finite non-negative number.`);
    }
  }
  for (const [field, value] of [
    ['learningSteps', state.learningSteps],
    ['reps', state.reps],
    ['lapses', state.lapses],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${label}.${field} must be a non-negative integer.`);
    }
  }
  if (!SCHEDULER_STAGES.has(state.stage)) {
    throw new Error(`${label}.stage is unsupported.`);
  }
}

export function assertIndependentSchedulerStateRecord(
  record: IndependentSchedulerStateRecord,
  expectedPolicy: string,
  label = `Independent scheduler state ${record.id}`,
): void {
  if (record.id !== record.itemId) {
    throw new Error(`${label} has a mismatched item identity.`);
  }
  if (record.adapterVersion !== TS_FSRS_ADAPTER_VERSION) {
    throw new Error(`${label} requires unsupported scheduler adapter.`);
  }
  if (record.parametersVersion !== TS_FSRS_PARAMETERS_VERSION) {
    throw new Error(`${label} requires unsupported scheduler parameter profile.`);
  }
  if (record.mappingPolicyVersion !== expectedPolicy) {
    throw new Error(`${label} requires unsupported mapping policy.`);
  }
  assertPhase6IsoDateTime(record.createdAt, `${label}.createdAt`);
  assertPhase6IsoDateTime(record.updatedAt, `${label}.updatedAt`);
  assertSchedulerState(record.state, `${label}.state`);
}

export function assertIndependentSchedulerDecisionRecord(
  record: IndependentSchedulerDecisionRecord,
  expectedPolicy: string,
  label = `Independent scheduler decision ${record.id}`,
): void {
  if (record.id !== record.observationId) {
    throw new Error(`${label} has a mismatched observation identity.`);
  }
  if (record.policyVersion !== expectedPolicy) {
    throw new Error(`${label} requires unsupported mapping policy.`);
  }
  if (record.adapterVersion !== TS_FSRS_ADAPTER_VERSION) {
    throw new Error(`${label} requires unsupported scheduler adapter.`);
  }
  if (record.parametersVersion !== TS_FSRS_PARAMETERS_VERSION) {
    throw new Error(`${label} requires unsupported scheduler parameter profile.`);
  }
  if (!['Again', 'Good'].includes(record.grade)) {
    throw new Error(`${label} uses a grade outside its conservative PHASE-6 policy.`);
  }
  assertPhase6IsoDateTime(record.decidedAt, `${label}.decidedAt`);
  assertPhase6IsoDateTime(record.previousDueAt, `${label}.previousDueAt`);
  assertPhase6IsoDateTime(record.resultingDueAt, `${label}.resultingDueAt`);
  assertSchedulerState(record.resultingState, `${label}.resultingState`);
  if (record.resultingState.dueAt !== record.resultingDueAt) {
    throw new Error(`${label} has inconsistent resulting due state.`);
  }
}

export function assertNameReviewLogRecord(record: NameReviewLogRecord): void {
  assertPhase6IsoDateTime(record.observedAt, `Name review ${record.id}.observedAt`);
  if (!Number.isInteger(record.itemIndex) || record.itemIndex < 0) {
    throw new Error(`Name review ${record.id}.itemIndex is invalid.`);
  }
  if (!Number.isFinite(record.responseTimeMs) || record.responseTimeMs < 0) {
    throw new Error(`Name review ${record.id}.responseTimeMs is invalid.`);
  }
  if (!['accepted', 'incorrect', 'revealed'].includes(record.outcome)) {
    throw new Error(`Name review ${record.id}.outcome is invalid.`);
  }
  if (!record.expectedAnswerSetKey) {
    throw new Error(
      `Name review ${record.id} is missing its expected answer-set key.`,
    );
  }
}

export function assertContrastReviewLogRecord(
  record: ContrastReviewLogRecord,
): void {
  assertPhase6IsoDateTime(
    record.observedAt,
    `Contrast review ${record.id}.observedAt`,
  );
  if (!Number.isInteger(record.itemIndex) || record.itemIndex < 0) {
    throw new Error(`Contrast review ${record.id}.itemIndex is invalid.`);
  }
  if (!Number.isFinite(record.responseTimeMs) || record.responseTimeMs < 0) {
    throw new Error(`Contrast review ${record.id}.responseTimeMs is invalid.`);
  }
  if (!['correct', 'incorrect', 'revealed'].includes(record.outcome)) {
    throw new Error(`Contrast review ${record.id}.outcome is invalid.`);
  }
}

function assertTrainingScope(
  scope: NameSessionRecord['scope'] | ContrastSessionRecord['scope'],
  label: string,
): void {
  if (!scope.id || !['repertoire', 'playlist'].includes(scope.kind)) {
    throw new Error(`${label} has an invalid training scope.`);
  }
}

function assertSessionCore(
  session: NameSessionRecord | ContrastSessionRecord,
  label: string,
): void {
  assertTrainingScope(session.scope, label);
  if (!Array.isArray(session.itemIds) || session.itemIds.some((id) => !id)) {
    throw new Error(`${label}.itemIds is invalid.`);
  }
  if (
    !Number.isInteger(session.currentIndex) ||
    session.currentIndex < 0 ||
    session.currentIndex > session.itemIds.length
  ) {
    throw new Error(`${label}.currentIndex is invalid.`);
  }
  if (!['active', 'complete', 'abandoned'].includes(session.status)) {
    throw new Error(`${label}.status is invalid.`);
  }
  if (!Array.isArray(session.committedObservationIds)) {
    throw new Error(`${label}.committedObservationIds is invalid.`);
  }
  assertPhase6IsoDateTime(session.createdAt, `${label}.createdAt`);
  assertPhase6IsoDateTime(session.updatedAt, `${label}.updatedAt`);
  if (session.completedAt !== undefined) {
    assertPhase6IsoDateTime(session.completedAt, `${label}.completedAt`);
  }
  if (session.status === 'active' && session.currentIndex >= session.itemIds.length) {
    throw new Error(`${label} is active without a current item.`);
  }
}

export function assertNameSessionRecord(session: NameSessionRecord): void {
  assertSessionCore(session, `Name session ${session.id}`);
}

export function assertContrastSessionRecord(
  session: ContrastSessionRecord,
): void {
  assertSessionCore(session, `Contrast session ${session.id}`);
}

export function assertManagedOpeningNameRecord(
  record: ManagedOpeningNameRecord,
): void {
  const validated = validateOpeningNameLabels(
    record.primaryLabel,
    record.aliases,
  );
  if (validated.answerSetKey !== record.answerSetKey) {
    throw new Error(`Opening name ${record.id} has an inconsistent answer-set key.`);
  }
  assertPhase6IsoDateTime(record.createdAt, `Opening name ${record.id}.createdAt`);
  assertPhase6IsoDateTime(record.updatedAt, `Opening name ${record.id}.updatedAt`);
  if (record.archivedAt !== undefined) {
    assertPhase6IsoDateTime(
      record.archivedAt,
      `Opening name ${record.id}.archivedAt`,
    );
  }
}

export function assertNameTrainingItemRecord(
  record: NameTrainingItemRecord,
): void {
  const validated = validateOpeningNameLabels(
    record.primaryLabel,
    record.aliases,
  );
  if (validated.answerSetKey !== record.answerSetKey) {
    throw new Error(
      `Name training item ${record.id} has an inconsistent answer-set snapshot.`,
    );
  }
  if (!['active', 'superseded'].includes(record.status)) {
    throw new Error(`Name training item ${record.id} has invalid status.`);
  }
  assertPhase6IsoDateTime(record.createdAt, `Name item ${record.id}.createdAt`);
  assertPhase6IsoDateTime(record.updatedAt, `Name item ${record.id}.updatedAt`);
}

export function assertContrastItemRecord(record: ContrastItemRecord): void {
  if (
    !record.id ||
    !record.pairId ||
    !record.repertoireId ||
    !record.expectedContextId ||
    !record.confusedContextId ||
    !record.sourceTrainingItemId
  ) {
    throw new Error('Contrast item identity is incomplete.');
  }
  if (!['active', 'superseded'].includes(record.status)) {
    throw new Error(`Contrast item ${record.id} has invalid status.`);
  }
  assertPhase6IsoDateTime(record.createdAt, `Contrast item ${record.id}.createdAt`);
  assertPhase6IsoDateTime(record.updatedAt, `Contrast item ${record.id}.updatedAt`);
}

export function assertLifecycleRecord(
  record: RepertoireLifecycleRecord | PlaylistLifecycleRecord,
  label: string,
): void {
  if (!record.id) throw new Error(`${label}.id is required.`);
  assertPhase6IsoDateTime(record.updatedAt, `${label}.updatedAt`);
  if (record.archivedAt !== undefined) {
    assertPhase6IsoDateTime(record.archivedAt, `${label}.archivedAt`);
  }
}
