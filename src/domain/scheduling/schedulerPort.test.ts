import { createEmptySchedulerState } from './schedulerPort';

it('creates a portable scheduler-neutral new state', () => {
  const state = createEmptySchedulerState(new Date('2026-08-28T10:00:00.000Z'));
  expect(state).toMatchObject({
    dueAt: '2026-08-28T10:00:00.000Z',
    stage: 'new',
    reps: 0,
    lapses: 0,
  });
});
