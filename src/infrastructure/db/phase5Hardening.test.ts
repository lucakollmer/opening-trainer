import { fix01White } from '../../fixtures/trainingFixtures';
import { compileTrainingFixture } from '../../domain/training/exercisePlan';
import {
  createTrainingSession,
  currentFixtureStep,
  reduceTrainingSession,
} from '../../domain/training/session';
import { createEmptySchedulerState } from '../../domain/scheduling/schedulerPort';
import {
  SCHEDULER_MAPPING_POLICY_VERSION,
  RESPONSE_TIME_POLICY_VERSION,
} from '../../domain/scheduling/observationPolicy';
import {
  TS_FSRS_ADAPTER_VERSION,
  TS_FSRS_PARAMETERS_VERSION,
} from '../scheduling/tsFsrsAdapter';
import {
  OpeningTrainerDatabase,
  createDatabaseMeta,
  type SchedulerDecisionRecord,
  type SchedulerStateRecord,
} from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';

const now = '2026-09-02T12:00:00.000Z';

function schedulerRecord(
  patch: Partial<SchedulerStateRecord> = {},
): SchedulerStateRecord {
  return {
    id: 'item-1',
    trainingItemId: 'item-1',
    state: createEmptySchedulerState(new Date(now)),
    adapterVersion: TS_FSRS_ADAPTER_VERSION,
    parametersVersion: TS_FSRS_PARAMETERS_VERSION,
    mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

async function database(prefix: string) {
  const result = new OpeningTrainerDatabase(`${prefix}-${crypto.randomUUID()}`);
  await result.open();
  await result.meta.put(createDatabaseMeta(now));
  return result;
}

describe('PHASE-5 scheduler persistence hardening', () => {
  it('rejects an unsupported scheduler projection inside the write transaction', async () => {
    const db = await database('phase5-compatibility');
    try {
      await db.settings.put({ id: 'sentinel', value: 'preserve', updatedAt: now });
      await expect(
        db.transaction('rw', db.tables, async () => {
          await db.settings.clear();
          await db.schedulerStates.add(
            schedulerRecord({ parametersVersion: 'future-profile-v2' }),
          );
        }),
      ).rejects.toThrow(/unsupported parameter profile/iu);
      expect((await db.settings.get('sentinel'))?.value).toBe('preserve');
      expect(await db.schedulerStates.count()).toBe(0);
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('rejects malformed scheduling timestamps before persistence', async () => {
    const db = await database('phase5-dates');
    try {
      await expect(
        db.schedulerStates.add(
          schedulerRecord({
            state: {
              ...createEmptySchedulerState(new Date(now)),
              dueAt: 'not-a-date',
            },
          }),
        ),
      ).rejects.toThrow(/valid ISO date-time/u);

      await expect(
        db.reviewLogs.add({
          id: 'obs-invalid-date',
          trainingItemId: 'item-1',
          sessionId: 'session-1',
          observedAt: 'tomorrow-ish',
          evidenceRole: 'targeted',
          outcome: 'correct',
          responseTimeMs: 1000,
          hintLevel: 0,
          illegalAttemptCount: 0,
          expectedMoveSetKey: 'e2e4',
        }),
      ).rejects.toThrow(/valid ISO date-time/u);
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('preserves older scheduler-decision metadata as historical audit evidence', async () => {
    const db = await database('phase5-history');
    try {
      const state = createEmptySchedulerState(new Date(now));
      const decision: SchedulerDecisionRecord = {
        id: 'obs-history',
        observationId: 'obs-history',
        trainingItemId: 'item-history',
        action: 'none',
        responseBand: 'ordinary',
        policyVersion: 'chess-fsrs-v0',
        responsePolicyVersion: RESPONSE_TIME_POLICY_VERSION,
        adapterVersion: 'ts-fsrs@older',
        parametersVersion: 'legacy-profile',
        reason: 'Historical decision retained for audit.',
        decidedAt: now,
        previousDueAt: now,
        resultingDueAt: now,
        resultingState: state,
        resultingRetrievability: 1,
      };
      await expect(db.schedulerDecisions.add(decision)).resolves.toBeDefined();
      expect((await db.schedulerDecisions.get('obs-history'))?.adapterVersion).toBe(
        'ts-fsrs@older',
      );
    } finally {
      db.close();
      await db.delete();
    }
  });

  it('persists a first-decision illegal attempt across reload and keeps its grade cap', async () => {
    const db = await database('phase5-illegal-recovery');
    const repository = new OpeningTrainerRepository(db);
    try {
      const compiled = compileTrainingFixture(fix01White);
      const plan = {
        ...compiled,
        targetStepId: compiled.startStepId,
        targetStepIds: [compiled.startStepId],
      };
      let state = createTrainingSession(plan, 1000, {
        sessionId: 'illegal-recovery-session',
      });
      const step = currentFixtureStep(state, plan)!;
      await db.trainingItems.add({
        id: step.trainingItemId,
        repertoireId: 'fixture-repertoire',
        contextScopeKey: 'fixture-context',
        positionKey: step.positionKey,
        acceptedMoveSetKey: step.acceptedMoveSetKey,
        promptMode: 'normal',
        contextIds: ['fixture-context'],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await db.schedulerStates.add({
        id: step.trainingItemId,
        trainingItemId: step.trainingItemId,
        state: {
          ...createEmptySchedulerState(new Date(now)),
          dueAt: '2026-09-02T11:00:00.000Z',
          stage: 'review',
          stability: 14,
          difficulty: 4,
          reps: 8,
          lastReviewAt: '2026-08-20T12:00:00.000Z',
        },
        adapterVersion: TS_FSRS_ADAPTER_VERSION,
        parametersVersion: TS_FSRS_PARAMETERS_VERSION,
        mappingPolicyVersion: SCHEDULER_MAPPING_POLICY_VERSION,
        createdAt: now,
        updatedAt: now,
      });

      state = reduceTrainingSession(state, plan, {
        type: 'user-move',
        move: { from: 'e2', to: 'e5' },
        nowMs: 1100,
        observedAt: '2026-09-02T12:00:00.100Z',
      });
      expect(state.evidence.at(-1)?.outcome).toBe('illegal-attempt');
      await repository.saveSession(state, '2026-09-02T12:00:00.110Z');
      expect((await db.schedulerDecisions.get(state.evidence[0]!.id))?.action).toBe(
        'none',
      );

      const recovered = await repository.latestInterruptedSession();
      expect(recovered?.state.illegalAttemptCount).toBe(1);
      expect(recovered?.state.evidence).toHaveLength(1);

      state = reduceTrainingSession(recovered!.state, plan, {
        type: 'user-move',
        move: { from: 'e2', to: 'e4' },
        nowMs: 1200,
        observedAt: '2026-09-02T12:00:00.200Z',
      });
      await repository.saveSession(state, '2026-09-02T12:00:00.210Z');
      const terminalObservation = state.evidence.at(-1)!;
      expect(terminalObservation.illegalAttemptCount).toBe(1);
      expect((await db.schedulerDecisions.get(terminalObservation.id))?.grade).toBe(
        'Good',
      );
    } finally {
      repository.close();
      await db.delete();
    }
  });
});
