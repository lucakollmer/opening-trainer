import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { compileTrainingFixture } from '../../domain/training/exercisePlan';
import { createTrainingSession } from '../../domain/training/session';
import { fix01White } from '../../fixtures/trainingFixtures';
import { TaskPreviewCard } from './TaskPreviewCard';

afterEach(() => {
  vi.useRealTimers();
});

it('suggests help after hesitation without consuming a hint', () => {
  vi.useFakeTimers();
  const plan = compileTrainingFixture(fix01White);
  const session = createTrainingSession(plan, 0, { sessionId: 'hint-nudge' });
  const onHint = vi.fn();

  render(
    <TaskPreviewCard
      session={session}
      plan={plan}
      onHint={onHint}
      onReveal={vi.fn()}
      onContinue={vi.fn()}
      onRetest={vi.fn()}
      onCompleteSession={vi.fn()}
      onRestart={vi.fn()}
      onAbandon={vi.fn()}
    />,
  );

  expect(screen.getByRole('button', { name: 'Hint 1' })).toBeVisible();
  act(() => vi.advanceTimersByTime(9_999));
  expect(screen.getByRole('button', { name: 'Hint 1' })).toBeVisible();
  expect(onHint).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('button', { name: 'Need a hint?' })).toBeVisible();
  expect(onHint).not.toHaveBeenCalled();
});
