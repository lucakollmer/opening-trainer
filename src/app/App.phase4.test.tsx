import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { position?: string } }) => (
    <div data-testid="chessboard-adapter" data-position={options.position}>
      Chessboard
    </div>
  ),
}));

describe('PHASE-4 clean first run', () => {
  it('shows an empty workspace and loads bundled demo content only after explicit action', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <App initialDemoFixtures={false} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', { name: 'No repertoire yet' }),
    ).toBeVisible();
    expect(screen.queryByLabelText('Training fixture')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import PGN' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Load demo repertoire' }));

    expect(screen.getByLabelText('Training fixture')).toBeVisible();
    expect(screen.getByText('Demo fixture')).toBeVisible();
    expect(screen.getByTestId('chessboard-adapter')).toBeVisible();
  });
});
