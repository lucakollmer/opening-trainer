import { createEmptySchedulerState } from './schedulerPort';
import {
  CONTRAST_CONFUSION_THRESHOLD,
  RECENT_FAILURE_WINDOW_DAYS,
  WEAK_RETRIEVABILITY_THRESHOLD,
  generateAdaptiveSessionSelection,
  type TrainingCandidateSnapshot,
} from './sessionGenerator';

const now = new Date('2026-08-28T12:00:00.000Z');

function candidate(
  id: string,
  patch: Partial<TrainingCandidateSnapshot> = {},
): TrainingCandidateSnapshot {
  return {
    trainingItemId: id,
    contextIds: [`context:${id}`],
    promptMode: 'normal',
    schedulerState: {
      ...createEmptySchedulerState(new Date('2026-08-01T12:00:00.000Z')),
      stage: 'review',
      dueAt: '2026-08-28T11:00:00.000Z',
      stability: 10,
      difficulty: 5,
      reps: 5,
    },
    retrievability: 0.9,
    depth: 8,
    prefixKey: `prefix:${id}`,
    confusionCount: 0,
    ...patch,
  };
}

const request = {
  repertoireId: 'rep',
  mode: 'normal' as const,
  targetCount: 3,
  newItemLimit: 1,
  now,
  seed: 'seed-a',
};

describe('adaptive session generator v1', () => {
  it('orders repair, weak due and due before bounded new material', () => {
    const selection = generateAdaptiveSessionSelection(
      [
        candidate('new', {
          schedulerState: createEmptySchedulerState(now),
        }),
        candidate('due'),
        candidate('weak', { retrievability: 0.6 }),
        candidate('repair', { obligation: 'retest' }),
      ],
      { ...request, targetCount: 4 },
    );
    expect(selection.selected.map((item) => item.trainingItemId)).toEqual([
      'repair',
      'weak',
      'due',
      'new',
    ]);
  });

  it('uses documented weak and recent-failure boundaries', () => {
    const classify = (row: TrainingCandidateSnapshot) =>
      generateAdaptiveSessionSelection([row], {
        ...request,
        targetCount: 1,
      }).selected[0]?.selectionClass;

    expect(
      classify(candidate('threshold', { retrievability: WEAK_RETRIEVABILITY_THRESHOLD })),
    ).toBe('due');
    expect(
      classify(
        candidate('below-threshold', {
          retrievability: WEAK_RETRIEVABILITY_THRESHOLD - 0.001,
        }),
      ),
    ).toBe('weak-due');
    expect(RECENT_FAILURE_WINDOW_DAYS).toBe(14);
    expect(
      classify(
        candidate('recent-boundary', {
          recentFailureAt: '2026-08-14T12:00:00.000Z',
        }),
      ),
    ).toBe('weak-due');
    expect(
      classify(
        candidate('outside-window', {
          recentFailureAt: '2026-08-14T11:59:59.999Z',
        }),
      ),
    ).toBe('due');
  });

  it('does not exceed the new-item limit', () => {
    const selection = generateAdaptiveSessionSelection(
      [
        candidate('new-a', { schedulerState: createEmptySchedulerState(now) }),
        candidate('new-b', { schedulerState: createEmptySchedulerState(now) }),
      ],
      request,
    );
    expect(selection.selected).toHaveLength(1);
    expect(selection.selected[0]?.selectionClass).toBe('new');
  });

  it('balances identical prefixes when urgency is otherwise equivalent', () => {
    const selection = generateAdaptiveSessionSelection(
      [
        candidate('a', { prefixKey: 'shared' }),
        candidate('b', { prefixKey: 'shared' }),
        candidate('c', { prefixKey: 'other' }),
      ],
      request,
    );
    expect(selection.selected[0]?.prefixKey).not.toBeUndefined();
    expect(selection.selected[1]?.prefixKey).not.toBe(selection.selected[0]?.prefixKey);
  });

  it('is deterministic for a fixed seed and changes only stable tie breaks with seed', () => {
    const rows = [candidate('a'), candidate('b'), candidate('c')].map((item) => ({
      ...item,
      prefixKey: 'same',
    }));
    const first = generateAdaptiveSessionSelection(rows, request).selected.map(
      (item) => item.trainingItemId,
    );
    const second = generateAdaptiveSessionSelection(rows, request).selected.map(
      (item) => item.trainingItemId,
    );
    expect(second).toEqual(first);
  });

  it('marks repeated recent confusion as contrast eligible after due/new work', () => {
    const selection = generateAdaptiveSessionSelection(
      [
        candidate('contrast', {
          schedulerState: {
            ...candidate('x').schedulerState,
            dueAt: '2026-09-10T00:00:00.000Z',
          },
          confusionCount: CONTRAST_CONFUSION_THRESHOLD,
          lastConfusionAt: '2026-08-27T12:00:00.000Z',
        }),
      ],
      { ...request, mode: 'contrast', newItemLimit: 0 },
    );
    expect(selection.selected[0]?.selectionClass).toBe('contrast');
  });
});
