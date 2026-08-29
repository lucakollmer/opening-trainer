import { createGraphExercisePlan } from '../../domain/repertoire/exercisePlan';
import { createAdaptiveTrainingSession } from '../../domain/scheduling/adaptiveSession';
import { contextPly } from '../../domain/repertoire/graph';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from '../../domain/repertoire/trainingIntegration';
import type { Playlist, RepertoireGraph } from '../../domain/repertoire/types';
import { phase3DemoPgn } from '../../fixtures/phase3Demo';
import {
  commitBackupRestore,
  exportCompleteBackup,
  previewBackupJson,
} from '../import-export/backup';
import { OpeningTrainerDatabase } from './openingTrainerDatabase';
import { OpeningTrainerRepository } from './openingTrainerRepository';

function candidate(id: string) {
  const result = previewPgnImport(phase3DemoPgn, {
    repertoireId: id,
    repertoireName: id,
    userColour: 'white',
    sourceLabel: 'PHASE-5 scheduling simulation',
  });
  expect(result.errors).toHaveLength(0);
  return result;
}

async function repository(prefix = 'phase5') {
  const result = new OpeningTrainerRepository(
    new OpeningTrainerDatabase(`${prefix}-${crypto.randomUUID()}`),
  );
  await result.initialize('2026-08-28T10:00:00.000Z');
  return result;
}

function deepestUserTarget(graph: RepertoireGraph) {
  const repertoire = graph.repertoires[0]!;
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const userIds = new Set(
    graph.moves
      .filter((move) => move.actor === 'user' && move.included)
      .map((move) => move.contextId),
  );
  const target = graph.contexts
    .filter((context) => userIds.has(context.id))
    .sort(
      (a, b) =>
        contextPly(b, contexts) - contextPly(a, contexts) || a.id.localeCompare(b.id),
    )[0]!;
  return {
    rootContextId: repertoire.rootContextIds[0]!,
    targetContextId: target.id,
  };
}

function rootTargetPlan(graph: RepertoireGraph) {
  const repertoire = graph.repertoires[0]!;
  const root = repertoire.rootContextIds[0]!;
  return createGraphExercisePlan(graph, {
    repertoireId: repertoire.id,
    rootContextId: root,
    targetContextId: root,
  });
}

function outgoingSans(graph: RepertoireGraph, contextId: string): string[] {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  return graph.moves
    .filter((move) => move.contextId === contextId && move.included)
    .map((move) => edges.get(move.edgeId)?.san ?? '')
    .sort();
}

function contextByOutgoing(graph: RepertoireGraph, sans: readonly string[]) {
  const expected = [...sans].sort().join('|');
  const context = graph.contexts.find(
    (candidateContext) =>
      outgoingSans(graph, candidateContext.id).join('|') === expected,
  );
  if (!context) throw new Error(`Missing context with outgoing ${expected}`);
  return context;
}

describe('PHASE-5 scheduler persistence and simulations', () => {
  it('creates scheduler state for every active canonical training item', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('phase5-states'));
      const active = await result.database.trainingItems
        .where('status')
        .equals('active')
        .count();
      expect(active).toBeGreaterThan(0);
      expect(await result.database.schedulerStates.count()).toBe(active);
      expect(await result.database.schedulerDecisions.count()).toBe(0);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('commits a targeted scheduler review exactly once across reload-style duplicate saves', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('phase5-idempotent'));
      const plan = rootTargetPlan(graph);
      const state = reduceGraphTrainingSession(
        createGraphTrainingSession(plan, 1_000, {
          sessionId: 'phase5-idempotent-session',
        }),
        plan,
        {
          type: 'user-move',
          move: { from: 'e2', to: 'e4' },
          nowMs: 6_000,
          observedAt: '2026-08-28T10:05:00.000Z',
        },
      );
      const itemId = state.evidence[0]!.trainingItemId;
      await result.saveSession(state, '2026-08-28T10:05:01.000Z');
      const afterFirst = await result.database.schedulerStates.get(itemId);
      await result.saveSession(state, '2026-08-28T10:05:02.000Z');
      const afterSecond = await result.database.schedulerStates.get(itemId);

      expect(await result.database.reviewLogs.count()).toBe(1);
      expect(await result.database.schedulerDecisions.count()).toBe(1);
      expect(afterFirst?.state.reps).toBe(1);
      expect(afterSecond?.state).toEqual(afterFirst?.state);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('records twenty incidental positive prefix traversals without FSRS interval inflation', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(
        candidate('phase5-incidental-positive'),
      );
      const repertoire = graph.repertoires[0]!;
      const plan = createGraphExercisePlan(graph, {
        repertoireId: repertoire.id,
        ...deepestUserTarget(graph),
      });
      const firstItem = plan.steps[0]!.trainingItemId;
      const initialPrefix = await result.database.schedulerStates.get(firstItem);
      expect(initialPrefix).toBeDefined();
      await result.database.schedulerStates.put({
        ...initialPrefix!,
        state: {
          ...initialPrefix!.state,
          stage: 'review',
          stability: 21,
          difficulty: 4,
          elapsedDays: 14,
          scheduledDays: 21,
          reps: 9,
          lapses: 0,
          lastReviewAt: '2026-08-20T10:00:00.000Z',
          dueAt: '2026-09-18T10:00:00.000Z',
        },
        updatedAt: '2026-08-28T10:00:00.000Z',
      });
      const before = await result.database.schedulerStates.get(firstItem);
      for (let index = 0; index < 20; index += 1) {
        const state = reduceGraphTrainingSession(
          createGraphTrainingSession(plan, 1_000, {
            sessionId: `incidental-${index}`,
          }),
          plan,
          {
            type: 'user-move',
            move: { from: 'e2', to: 'e4' },
            nowMs: 2_000,
            observedAt: `2026-08-28T10:${String(index).padStart(2, '0')}:00.000Z`,
          },
        );
        expect(state.evidence[0]?.evidenceRole).toBe('incidental');
        await result.saveSession(state);
      }
      const after = await result.database.schedulerStates.get(firstItem);
      const decisions = await result.database.schedulerDecisions
        .where('trainingItemId')
        .equals(firstItem)
        .toArray();
      expect(decisions).toHaveLength(20);
      expect(decisions.every((decision) => decision.action === 'none')).toBe(true);
      expect(after?.state).toEqual(before?.state);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('promotes an incidental failure to targeted work without applying a scheduler review', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(
        candidate('phase5-incidental-negative'),
      );
      const repertoire = graph.repertoires[0]!;
      const plan = createGraphExercisePlan(graph, {
        repertoireId: repertoire.id,
        ...deepestUserTarget(graph),
      });
      const state = reduceGraphTrainingSession(
        createGraphTrainingSession(plan, 1_000, {
          sessionId: 'incidental-negative',
        }),
        plan,
        {
          type: 'user-move',
          move: { from: 'd2', to: 'd4' },
          nowMs: 2_000,
          observedAt: '2026-08-28T10:20:00.000Z',
        },
      );
      expect(state.evidence[0]?.evidenceRole).toBe('incidental');
      await result.saveSession(state);
      const decision = await result.database.schedulerDecisions.get(
        state.evidence[0]!.id,
      );
      const scheduler = await result.database.schedulerStates.get(
        state.evidence[0]!.trainingItemId,
      );
      expect(decision?.action).toBe('promote-target');
      expect(scheduler?.state.reps).toBe(0);
      expect(state.retestQueue).toHaveLength(1);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('keeps reveal failure and repair evidence separate in scheduler decisions', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('phase5-repair'));
      const plan = rootTargetPlan(graph);
      let state = createGraphTrainingSession(plan, 1_000, {
        sessionId: 'phase5-repair-session',
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'reveal',
        nowMs: 2_000,
        observedAt: '2026-08-28T10:30:00.000Z',
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'continue',
        nowMs: 2_100,
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'user-move',
        move: { from: 'e2', to: 'e4' },
        nowMs: 2_200,
        observedAt: '2026-08-28T10:30:01.000Z',
      });
      await result.saveSession(state);
      const decisions = await result.database.schedulerDecisions
        .where('trainingItemId')
        .equals(state.evidence[0]!.trainingItemId)
        .sortBy('decidedAt');
      expect(decisions.map((decision) => [decision.action, decision.grade])).toEqual([
        ['review', 'Again'],
        ['none', undefined],
      ]);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('does not requeue an already-answered batched ancestor when an accepted branch displaces only the deeper target', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(
        candidate('phase5-batched-alternative'),
      );
      const repertoire = graph.repertoires[0]!;
      const branch = contextByOutgoing(graph, ['Nc3', 'Nf3']);
      const deeperTarget = contextByOutgoing(graph, ['Nc3']);
      const plan = createGraphExercisePlan(graph, {
        repertoireId: repertoire.id,
        rootContextId: repertoire.rootContextIds[0]!,
        targetContextId: deeperTarget.id,
        targetContextIds: [branch.id, deeperTarget.id],
      });
      expect(plan.targetStepIds).toEqual(
        expect.arrayContaining([branch.id, deeperTarget.id]),
      );

      let state = createGraphTrainingSession(plan, 1_000, {
        sessionId: 'phase5-batched-alternative-session',
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'user-move',
        move: { from: 'e2', to: 'e4' },
        nowMs: 1_100,
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'continue',
        nowMs: 1_101,
      });
      state = reduceGraphTrainingSession(state, plan, {
        type: 'opponent-tick',
        nowMs: 1_102,
      });
      expect(state.currentStepId).toBe(branch.id);
      state = reduceGraphTrainingSession(state, plan, {
        type: 'user-move',
        move: { from: 'b1', to: 'c3' },
        nowMs: 1_200,
      });

      expect(state.evidence.at(-1)?.evidenceRole).toBe('targeted');
      expect(state.retestQueue.map((ticket) => ticket.targetStepId)).toContain(
        deeperTarget.id,
      );
      expect(state.retestQueue.map((ticket) => ticket.targetStepId)).not.toContain(
        branch.id,
      );
    } finally {
      await result.deleteDatabase();
    }
  });

  it('generates the same adaptive exercise queue for a fixed seed and batches route targets', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('phase5-generator'));
      const schedulerRows = await result.database.schedulerStates.toArray();
      await result.database.schedulerStates.bulkPut(
        schedulerRows.map((row) => ({
          ...row,
          state: {
            ...row.state,
            stage: 'review' as const,
            stability: 10,
            difficulty: 5,
            elapsedDays: 10,
            scheduledDays: 10,
            reps: 5,
            dueAt: '2026-08-28T10:00:00.000Z',
            lastReviewAt: '2026-08-18T10:00:00.000Z',
          },
          updatedAt: '2026-08-28T10:00:00.000Z',
        })),
      );
      const options = {
        targetCount: 100,
        newItemLimit: 0,
        now: new Date('2026-08-28T11:00:00.000Z'),
        seed: 'deterministic-seed',
      };
      const first = await result.createAdaptiveSessionPlan('phase5-generator', options);
      const second = await result.createAdaptiveSessionPlan(
        'phase5-generator',
        options,
      );
      expect(first.exercises.map((exercise) => exercise.plan.id)).toEqual(
        second.exercises.map((exercise) => exercise.plan.id),
      );
      expect(first.exercises.length).toBeGreaterThan(0);
      expect(
        first.exercises.some((exercise) => exercise.plan.targetStepIds.length > 1),
      ).toBe(true);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('creates strict-mode scheduler items on demand without mixing them into normal recall', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('phase5-strict'));
      const strict = await result.createAdaptiveSessionPlan('phase5-strict', {
        targetCount: 100,
        newItemLimit: 100,
        mode: 'strict',
        now: new Date('2026-08-28T11:30:00.000Z'),
        seed: 'strict-seed',
      });
      expect(strict.exercises.length).toBeGreaterThan(0);
      expect(
        (await result.database.trainingItems.toArray()).some(
          (item) => item.promptMode === 'strict' && item.status === 'active',
        ),
      ).toBe(true);
      expect(
        strict.exercises.every((exercise) =>
          exercise.plan.targetStepIds.every((stepId) =>
            exercise.plan.steps
              .find((step) => step.id === stepId)
              ?.trainingItemId.includes('::strict::'),
          ),
        ),
      ).toBe(true);

      const normal = await result.createAdaptiveSessionPlan('phase5-strict', {
        targetCount: 100,
        newItemLimit: 100,
        mode: 'normal',
        now: new Date('2026-08-28T11:30:00.000Z'),
        seed: 'normal-seed',
      });
      expect(
        normal.exercises.flatMap((exercise) => exercise.targetTrainingItemIds),
      ).not.toContainEqual(expect.stringContaining('::strict::'));
    } finally {
      await result.deleteDatabase();
    }
  });

  it('persists wrong-sibling confusion against a real repertoire context and keeps backup valid', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('phase5-real-confusion'));
      const branch = contextByOutgoing(graph, ['Nc3', 'Nf3']);
      const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
      const siblingMove = graph.moves.find(
        (move) =>
          move.contextId === branch.id &&
          move.actor === 'user' &&
          edges.get(move.edgeId)?.san === 'Nc3',
      );
      expect(siblingMove).toBeDefined();
      const playlist: Playlist = {
        id: 'phase5-main-only-confusion',
        name: 'Main only',
        repertoireIds: ['phase5-real-confusion'],
        includedContextIds: [],
        excludedContextIds: [siblingMove!.destinationContextId],
        tags: [],
        weighting: { kind: 'due-first' },
        createdAt: '2026-08-28T11:31:00.000Z',
        updatedAt: '2026-08-28T11:31:00.000Z',
      };
      await result.savePlaylist(playlist, '2026-08-28T11:31:00.000Z');
      const scheduled = await result.createAdaptiveSessionPlan(
        'phase5-real-confusion',
        {
          playlistId: playlist.id,
          targetCount: 100,
          newItemLimit: 100,
          mode: 'normal',
          now: new Date('2026-08-28T11:32:00.000Z'),
          seed: 'real-confusion-seed',
        },
      );
      const exercise = scheduled.exercises.find((candidateExercise) =>
        candidateExercise.plan.steps.some((step) => step.id === branch.id),
      );
      expect(exercise).toBeDefined();
      let state = createGraphTrainingSession(exercise!.plan, 1_000, {
        sessionId: 'phase5-real-confusion-session',
      });
      let nowMs = 1_100;
      while (state.currentStepId !== branch.id) {
        const step = exercise!.plan.steps.find(
          (candidateStep) => candidateStep.id === state.currentStepId,
        );
        expect(step).toBeDefined();
        if (state.status === 'awaiting-user-move') {
          state = reduceGraphTrainingSession(state, exercise!.plan, {
            type: 'user-move',
            move: { from: step!.from, to: step!.to },
            nowMs,
            observedAt: new Date(1_000_000 + nowMs).toISOString(),
          });
        } else if (state.status === 'correct-feedback') {
          state = reduceGraphTrainingSession(state, exercise!.plan, {
            type: 'continue',
            nowMs,
          });
        } else if (state.status === 'opponent-moving') {
          state = reduceGraphTrainingSession(state, exercise!.plan, {
            type: 'opponent-tick',
            nowMs,
          });
        } else {
          throw new Error(`Unexpected status before confusion: ${state.status}`);
        }
        nowMs += 100;
      }
      state = reduceGraphTrainingSession(state, exercise!.plan, {
        type: 'user-move',
        move: { from: 'b1', to: 'c3' },
        nowMs,
        observedAt: '2026-08-28T11:33:00.000Z',
      });
      const confusion = state.evidence.at(-1);
      expect(confusion?.outcome).toBe('wrong-variation');
      expect(confusion?.confusionContextId).toBe(siblingMove!.destinationContextId);
      await result.saveSession(state, '2026-08-28T11:33:01.000Z');
      await expect(
        result.exportCompleteBackup('2026-08-28T11:33:02.000Z'),
      ).resolves.toBeDefined();
      expect(
        (await result.database.confusionRelations.toArray()).some(
          (relation) =>
            relation.confusionContextId === siblingMove!.destinationContextId,
        ),
      ).toBe(true);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('creates a separate contrast queue only after the confusion threshold is met', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('phase5-contrast'));
      const normalItem = (
        await result.database.trainingItems
          .where('repertoireId')
          .equals('phase5-contrast')
          .toArray()
      ).find((item) => item.promptMode === 'normal')!;
      const confusionContextId =
        graph.contexts.find((context) => !normalItem.contextIds.includes(context.id))
          ?.id ?? graph.contexts[0]!.id;
      await result.database.confusionRelations.put({
        id: `${normalItem.id}::${confusionContextId}`,
        expectedTrainingItemId: normalItem.id,
        confusionContextId,
        count: 2,
        lastObservedAt: '2026-08-28T11:35:00.000Z',
      });
      await expect(
        result.exportCompleteBackup('2026-08-28T11:35:30.000Z'),
      ).resolves.toBeDefined();
      const summary = await result.getTrainingQueueSummary(
        'phase5-contrast',
        new Date('2026-08-28T11:36:00.000Z'),
      );
      expect(summary.contrast).toBeGreaterThan(0);

      const contrast = await result.createAdaptiveSessionPlan('phase5-contrast', {
        targetCount: 10,
        newItemLimit: 0,
        mode: 'contrast',
        now: new Date('2026-08-28T11:36:00.000Z'),
        seed: 'contrast-seed',
      });
      expect(contrast.exercises.length).toBeGreaterThan(0);
      expect(
        contrast.exercises.every((exercise) =>
          exercise.targetTrainingItemIds.every((trainingItemId) =>
            trainingItemId.includes('::contrast::'),
          ),
        ),
      ).toBe(true);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('keeps playlist-narrowed answer sets scoped out of ordinary all-repertoire sessions', async () => {
    const result = await repository();
    try {
      const graph = await result.createRepertoire(candidate('phase5-playlist'));
      const branch = graph.contexts.find(
        (context) =>
          graph.moves.filter(
            (move) =>
              move.contextId === context.id && move.actor === 'user' && move.included,
          ).length > 1,
      );
      expect(branch).toBeDefined();
      const excludedMove = graph.moves.find(
        (move) =>
          move.contextId === branch!.id && move.actor === 'user' && move.included,
      )!;
      const playlist: Playlist = {
        id: 'phase5-narrow-playlist',
        name: 'Narrow branch',
        repertoireIds: ['phase5-playlist'],
        includedContextIds: [],
        excludedContextIds: [excludedMove.destinationContextId],
        tags: [],
        weighting: { kind: 'due-first' },
        createdAt: '2026-08-28T11:40:00.000Z',
        updatedAt: '2026-08-28T11:40:00.000Z',
      };
      const unscopedBefore = new Map(
        (await result.database.trainingItems.toArray())
          .filter((item) => !item.playlistIds || item.playlistIds.length === 0)
          .map((item) => [item.id, [...item.contextIds]]),
      );
      await result.savePlaylist(playlist, '2026-08-28T11:40:00.000Z');
      const scopedPlan = await result.createAdaptiveSessionPlan('phase5-playlist', {
        playlistId: playlist.id,
        targetCount: 100,
        newItemLimit: 100,
        mode: 'normal',
        now: new Date('2026-08-28T11:41:00.000Z'),
        seed: 'playlist-seed',
      });
      expect(scopedPlan.exercises.length).toBeGreaterThan(0);
      const scopedItems = (await result.database.trainingItems.toArray()).filter(
        (item) => item.playlistIds?.includes(playlist.id),
      );
      expect(scopedItems.length).toBeGreaterThan(0);
      for (const item of (await result.database.trainingItems.toArray()).filter(
        (candidateItem) =>
          !candidateItem.playlistIds || candidateItem.playlistIds.length === 0,
      )) {
        const beforeContexts = unscopedBefore.get(item.id);
        if (beforeContexts) expect(item.contextIds).toEqual(beforeContexts);
      }

      const allPlan = await result.createAdaptiveSessionPlan('phase5-playlist', {
        targetCount: 100,
        newItemLimit: 100,
        mode: 'normal',
        now: new Date('2026-08-28T11:41:00.000Z'),
        seed: 'all-seed',
      });
      const allTargets = new Set(
        allPlan.exercises.flatMap((exercise) => exercise.targetTrainingItemIds),
      );
      expect(scopedItems.every((item) => !allTargets.has(item.id))).toBe(true);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('rebuilds an interrupted adaptive exercise from persisted descriptors without duplicating scheduler commits', async () => {
    const result = await repository();
    try {
      await result.createRepertoire(candidate('phase5-recovery'));
      const scheduled = await result.createAdaptiveSessionPlan('phase5-recovery', {
        targetCount: 4,
        newItemLimit: 4,
        mode: 'normal',
        now: new Date('2026-08-28T11:50:00.000Z'),
        seed: 'phase5-recovery-seed',
      });
      expect(scheduled.exercises.length).toBeGreaterThan(0);
      const started = createAdaptiveTrainingSession(
        scheduled,
        1_000,
        'phase5-recovery-session',
      );
      const firstStep = started.plan.steps.find(
        (step) => step.id === started.state.currentStepId,
      );
      expect(firstStep?.actor).toBe('user');
      const progressed = reduceGraphTrainingSession(started.state, started.plan, {
        type: 'user-move',
        move: { from: firstStep!.from, to: firstStep!.to },
        nowMs: 2_000,
        observedAt: '2026-08-28T11:50:01.000Z',
      });
      await result.saveSession(progressed, '2026-08-28T11:50:02.000Z');

      const interrupted = await result.latestInterruptedSession();
      expect(interrupted?.id).toBe('phase5-recovery-session');
      expect(interrupted?.state.adaptive?.seed).toBe('phase5-recovery-seed');
      const descriptor =
        interrupted!.state.adaptive!.exercises[
          interrupted!.state.adaptive!.exerciseIndex
        ]!;
      const rebuilt = await result.rebuildAdaptiveExercise(descriptor);
      expect(rebuilt.plan.id).toBe(started.plan.id);
      expect(rebuilt.descriptor).toEqual(descriptor);
      expect(rebuilt.targetTrainingItemIds).toEqual(
        scheduled.exercises[0]!.targetTrainingItemIds,
      );

      const reviewCount = await result.database.reviewLogs.count();
      const decisionCount = await result.database.schedulerDecisions.count();
      await result.saveSession(interrupted!.state, '2026-08-28T11:50:03.000Z');
      expect(await result.database.reviewLogs.count()).toBe(reviewCount);
      expect(await result.database.schedulerDecisions.count()).toBe(decisionCount);
    } finally {
      await result.deleteDatabase();
    }
  });

  it('round-trips scheduler state and decisions in portable backup v2', async () => {
    const source = await repository('phase5-backup-source');
    const target = await repository('phase5-backup-target');
    try {
      const graph = await source.createRepertoire(candidate('phase5-backup'));
      const plan = rootTargetPlan(graph);
      const state = reduceGraphTrainingSession(
        createGraphTrainingSession(plan, 1_000, { sessionId: 'phase5-backup-session' }),
        plan,
        {
          type: 'user-move',
          move: { from: 'e2', to: 'e4' },
          nowMs: 6_000,
          observedAt: '2026-08-28T11:10:00.000Z',
        },
      );
      await source.saveSession(state);
      const exported = await exportCompleteBackup(
        source.database,
        '2026-08-28T11:11:00.000Z',
      );
      expect(exported.backup.version).toBe(2);
      const preview = previewBackupJson(exported.json);
      await commitBackupRestore(target.database, preview, {
        restoredAt: '2026-08-28T11:12:00.000Z',
      });
      expect(await target.database.schedulerStates.toArray()).toEqual(
        await source.database.schedulerStates.toArray(),
      );
      expect(await target.database.schedulerDecisions.toArray()).toEqual(
        await source.database.schedulerDecisions.toArray(),
      );
      expect(await target.database.reviewLogs.toArray()).toEqual(
        await source.database.reviewLogs.toArray(),
      );
    } finally {
      await source.deleteDatabase();
      await target.deleteDatabase();
    }
  });

  it('migrates a PHASE-4-style v1 backup without retroactively grading old observations', async () => {
    const source = await repository('phase5-v1-source');
    const target = await repository('phase5-v1-target');
    try {
      const graph = await source.createRepertoire(candidate('phase5-v1'));
      const plan = rootTargetPlan(graph);
      const state = reduceGraphTrainingSession(
        createGraphTrainingSession(plan, 1_000, { sessionId: 'legacy-session' }),
        plan,
        {
          type: 'user-move',
          move: { from: 'e2', to: 'e4' },
          nowMs: 6_000,
          observedAt: '2026-08-28T11:20:00.000Z',
        },
      );
      await source.saveSession(state);
      const current = JSON.parse(
        (await source.exportCompleteBackup('2026-08-28T11:21:00.000Z')).json,
      ) as {
        version: number;
        databaseMeta: Record<string, unknown>;
        integrity?: unknown;
        data: {
          schedulerStates?: unknown;
          schedulerDecisions?: unknown;
          sessions: Array<{
            targetIdentityKind?: string;
            state: Record<string, unknown>;
          }>;
        };
      };
      current.version = 1;
      current.databaseMeta.databaseSchemaVersion = 1;
      current.databaseMeta.portableSchemaVersion = 1;
      delete current.databaseMeta.schedulerCutoverAt;
      delete current.integrity;
      delete current.data.schedulerStates;
      delete current.data.schedulerDecisions;
      for (const session of current.data.sessions) {
        delete session.targetIdentityKind;
        delete session.state.targetStepIds;
        delete session.state.targetTrainingItemIds;
        delete session.state.adaptive;
      }
      const preview = previewBackupJson(JSON.stringify(current));
      expect(preview.warnings.join(' ')).toMatch(/not retroactively graded/u);
      expect(preview.backup.data.reviewLogs).toHaveLength(1);
      expect(preview.backup.data.schedulerDecisions).toHaveLength(0);
      await target.restoreCompleteBackup(preview, '2026-08-28T11:22:00.000Z');
      expect(await target.database.reviewLogs.count()).toBe(1);
      expect(await target.database.schedulerDecisions.count()).toBe(0);
      expect(await target.database.schedulerStates.count()).toBeGreaterThan(0);
      expect(
        (await target.database.schedulerStates.toArray()).every(
          (scheduler) => scheduler.state.reps === 0,
        ),
      ).toBe(true);
    } finally {
      await source.deleteDatabase();
      await target.deleteDatabase();
    }
  });
});
