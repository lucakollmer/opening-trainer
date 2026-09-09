import { describe, expect, it } from 'vitest';
import {
  SCHEDULER_MAPPING_POLICY_VERSION,
  RESPONSE_TIME_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import {
  DATABASE_META_ID,
  OpeningTrainerDatabase,
  createDatabaseMeta,
  type SchedulerDecisionRecord,
  type SchedulerStateRecord,
  type TrainingItemRecord,
} from './openingTrainerDatabase';
import {
  PHASE6_DATABASE_SCHEMA_VERSION,
  PHASE6_PORTABLE_SCHEMA_VERSION,
  Phase6OpeningTrainerDatabase,
} from './phase6Database';
import {
  TS_FSRS_ADAPTER_VERSION,
  TS_FSRS_PARAMETERS_VERSION,
  TsFsrsSchedulerAdapter,
} from '../scheduling/tsFsrsAdapter';

describe('PHASE-6 database migration', () => {
  it('moves schema v2 to v3 without changing PHASE-5 move evidence or scheduling', async () => {
    const name = `phase6-migration-${crypto.randomUUID()}`;
    const legacy = new OpeningTrainerDatabase(name);
    const scheduler = new TsFsrsSchedulerAdapter();
    const createdAt = '2026-09-03T09:00:00.000Z';
    const observedAt = '2026-09-03T09:05:00.000Z';
    await legacy.open();
    await legacy.meta.put(createDatabaseMeta(createdAt));
    const item: TrainingItemRecord = {
      id: 'phase5-item',
      repertoireId: 'rep',
      contextScopeKey: 'scope',
      positionKey: 'position',
      acceptedMoveSetKey: 'e2e4',
      promptMode: 'normal',
      contextIds: ['context'],
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    };
    const initial = scheduler.createNew(new Date(createdAt));
    const reviewed = scheduler.review(initial, 'Good', new Date(observedAt));
    const state: SchedulerStateRecord = {
      id: item.id,
      trainingItemId: item.id,
      state: reviewed.state,
      adapterVersion: TS_FSRS_ADAPTER_VERSION,
      parametersVersion: TS_FSRS_PARAMETERS_VERSION,
      mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
      createdAt,
      updatedAt: observedAt,
    };
    const review = {
      id: 'phase5-review',
      trainingItemId: item.id,
      sessionId: 'phase5-session',
      observedAt,
      evidenceRole: 'targeted' as const,
      outcome: 'correct' as const,
      responseTimeMs: 2_500,
      hintLevel: 0 as const,
      illegalAttemptCount: 0,
      expectedMoveSetKey: 'e2e4',
    };
    const decision: SchedulerDecisionRecord = {
      id: review.id,
      observationId: review.id,
      trainingItemId: item.id,
      action: 'review',
      grade: 'Good',
      responseBand: 'ordinary',
      policyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
      responsePolicyVersion: RESPONSE_TIME_POLICY_VERSION,
      adapterVersion: TS_FSRS_ADAPTER_VERSION,
      parametersVersion: TS_FSRS_PARAMETERS_VERSION,
      reason: 'PHASE-5 migration preservation fixture',
      decidedAt: observedAt,
      previousDueAt: initial.dueAt,
      resultingDueAt: reviewed.state.dueAt,
      resultingState: reviewed.state,
      resultingRetrievability: reviewed.retrievability,
    };
    await legacy.trainingItems.put(item);
    await legacy.reviewLogs.put(review);
    await legacy.schedulerStates.put(state);
    await legacy.schedulerDecisions.put(decision);
    legacy.close();

    const current = new Phase6OpeningTrainerDatabase(name);
    try {
      await current.open();
      expect(await current.trainingItems.get(item.id)).toEqual(item);
      expect(await current.reviewLogs.get(review.id)).toEqual(review);
      expect(await current.schedulerStates.get(item.id)).toEqual(state);
      expect(await current.schedulerDecisions.get(decision.id)).toEqual(decision);
      expect(await current.nameReviewLogs.count()).toBe(0);
      expect(await current.contrastReviewLogs.count()).toBe(0);
      const meta = await current.meta.get(DATABASE_META_ID);
      expect(meta?.databaseSchemaVersion).toBe(PHASE6_DATABASE_SCHEMA_VERSION);
      expect(meta?.portableSchemaVersion).toBe(PHASE6_PORTABLE_SCHEMA_VERSION);
      expect(meta?.schedulerCutoverAt).toBe(createdAt);
    } finally {
      current.close();
      await current.delete();
    }
  });
});
