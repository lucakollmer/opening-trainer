import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NameRecallPanel } from './NameRecallPanel';

const prompt = {
  sessionId: 'name-session',
  itemIndex: 0,
  itemId: 'name-item',
  repertoireId: 'rep',
  contextId: 'context',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  breadcrumb: 'Main line / position 1',
  orientation: 'white' as const,
};

describe('PHASE-6 name recall disclosure', () => {
  it('does not mount accepted labels before an answer or explicit reveal', async () => {
    const user = userEvent.setup();
    const onReview = vi.fn().mockResolvedValue({
      accepted: false,
      outcome: 'revealed',
      expectedPrimaryLabel: 'Sicilian Defence',
      expectedAliases: ['Sicilian Defense'],
      complete: true,
    });
    render(
      <NameRecallPanel
        prompt={prompt}
        onReview={onReview}
        onNext={async () => undefined}
        onEnd={async () => undefined}
      />,
    );

    expect(screen.queryByText(/Sicilian Defence/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sicilian Defense/u)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Sicilian Defence');

    await user.click(screen.getByRole('button', { name: /reveal name/iu }));
    expect(await screen.findByText(/Sicilian Defence/u)).toBeInTheDocument();
    expect(onReview).toHaveBeenCalledWith('', expect.any(Number), true);
  });
});
