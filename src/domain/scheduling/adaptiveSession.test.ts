import { compileTrainingFixture } from '../training/exercisePlan';
import { reduceTrainingSession } from '../training/session';
import { fix01White } from '../../fixtures/trainingFixtures';
import {
  advanceAdaptiveTrainingSession,
  createAdaptiveTrainingSession,
  deferAdaptiveRetests,
  hasNextAdaptiveExercise,
  adaptiveSessionSummary,
} from './adaptiveSession';

it('persists deterministic adaptive exercise metadata and carries evidence forward', () => {
  const plan = compileTrainingFixture(fix01White);
  const descriptor = {
    repertoireId: 'rep',
    rootContextId: 'root',
    targetContextId: 'target',
    targetContextIds: ['target'],
    promptMode: 'normal' as const,
  };
  const created = createAdaptiveTrainingSession(
    {
      generatorVersion: 'adaptive-generator-v1',
      seed: 'seed',
      requestedTargetCount: 2,
      newItemLimit: 1,
      exercises: [
        { descriptor, plan, targetTrainingItemIds: ['item-a'] },
        { descriptor: { ...descriptor, targetContextId: 'target-2' }, plan, targetTrainingItemIds: ['item-b'] },
      ],
    },
    1_000,
    'adaptive-session',
  );
  expect(created.state.adaptive?.exercises).toHaveLength(2);
  expect(created.state.adaptive?.targetTrainingItemIds).toEqual(['item-a', 'item-b']);
  expect(hasNextAdaptiveExercise(created.state)).toBe(true);

  let completed = created.state;
  while (completed.status !== 'line-complete') {
    if (completed.status === 'awaiting-user-move') {
      const step = plan.steps.find((item) => item.id === completed.currentStepId)!;
      completed = reduceTrainingSession(completed, plan, {
        type: 'user-move',
        move: { from: step.from, to: step.to },
        nowMs: 2_000 + completed.plyIndex,
      });
    } else if (completed.status === 'correct-feedback') {
      completed = reduceTrainingSession(completed, plan, {
        type: 'continue',
        nowMs: 3_000 + completed.plyIndex,
      });
    } else if (completed.status === 'opponent-moving') {
      completed = reduceTrainingSession(completed, plan, {
        type: 'opponent-tick',
        nowMs: 4_000 + completed.plyIndex,
      });
    } else {
      throw new Error(`Unexpected status ${completed.status}`);
    }
  }
  const advanced = advanceAdaptiveTrainingSession(completed, plan, 10_000);
  expect(advanced.adaptive?.exerciseIndex).toBe(1);
  expect(advanced.evidence.length).toBe(completed.evidence.length);
  expect(advanced.sessionId).toBe('adaptive-session');
});


it('defers an unready end-of-route retest behind another adaptive exercise', () => {
  const plan = compileTrainingFixture(fix01White);
  const descriptor = {
    repertoireId: 'rep',
    rootContextId: 'root',
    targetContextId: plan.targetStepId,
    targetContextIds: [plan.targetStepId],
    promptMode: 'normal' as const,
  };
  const created = createAdaptiveTrainingSession(
    {
      generatorVersion: 'adaptive-generator-v1',
      seed: 'seed',
      requestedTargetCount: 2,
      newItemLimit: 1,
      exercises: [
        { descriptor, plan, targetTrainingItemIds: ['item-a'] },
        {
          descriptor: { ...descriptor, targetContextId: 'later-target' },
          plan,
          targetTrainingItemIds: ['item-b'],
        },
      ],
    },
    1_000,
    'deferred-retest',
  );
  const failedAtEnd = {
    ...created.state,
    status: 'line-complete' as const,
    retestQueue: [
      {
        id: 'retest-1',
        targetStepId: plan.targetStepId,
        separationRemaining: 1,
        sourceObservationId: 'obs-1',
        attempt: 1,
      },
    ],
  };
  const deferred = deferAdaptiveRetests(failedAtEnd, plan);
  expect(deferred.state.retestQueue).toHaveLength(0);
  expect(deferred.descriptors).toHaveLength(1);
  expect(deferred.descriptors[0]).toMatchObject({
    kind: 'retest',
    targetContextId: plan.targetStepId,
  });
  expect(deferred.state.adaptive?.exercises).toHaveLength(3);
  expect(adaptiveSessionSummary(deferred.state).unresolved).toBe(1);

  const advanced = advanceAdaptiveTrainingSession(deferred.state, plan, 2_000);
  expect(advanced.adaptive?.exerciseIndex).toBe(1);
  expect(advanced.runKind).toBe('primary');
});

it('marks a deferred adaptive retest route as a retest run when it becomes current', () => {
  const plan = compileTrainingFixture(fix01White);
  const descriptor = {
    repertoireId: 'rep',
    rootContextId: 'root',
    targetContextId: plan.targetStepId,
    targetContextIds: [plan.targetStepId],
    promptMode: 'normal' as const,
  };
  const created = createAdaptiveTrainingSession(
    {
      generatorVersion: 'adaptive-generator-v1',
      seed: 'seed',
      requestedTargetCount: 1,
      newItemLimit: 1,
      exercises: [
        { descriptor, plan, targetTrainingItemIds: ['item-a'] },
        {
          descriptor: { ...descriptor, kind: 'retest' as const },
          plan,
          targetTrainingItemIds: ['item-a'],
        },
      ],
    },
    1_000,
    'adaptive-retest-kind',
  );
  const completed = { ...created.state, status: 'line-complete' as const };
  const advanced = advanceAdaptiveTrainingSession(completed, plan, 2_000);
  expect(advanced.runKind).toBe('retest');
});
