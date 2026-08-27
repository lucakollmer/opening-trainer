import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: ({
    options,
  }: {
    options: {
      position?: string;
      boardOrientation?: string;
      allowDragging?: boolean;
    };
  }) => (
    <div
      data-testid="chessboard-adapter"
      data-position={options.position}
      data-orientation={options.boardOrientation}
      data-dragging={String(options.allowDragging)}
    >
      Chessboard
    </div>
  ),
}));

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('PHASE-3 application hardening', () => {
  it('invalidates an active Train run before Browse can disclose answers', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getAllByText('0 observations').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    expect(screen.getByRole('heading', { name: 'Session abandoned' })).toBeVisible();
    expect(screen.getAllByText('0 observations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1. e4').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Train' }));
    expect(screen.getByRole('heading', { name: 'Session abandoned' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restart session' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Restart session' }));
    expect(screen.getByRole('heading', { name: 'Find the repertoire move' })).toBeVisible();
    expect(screen.getAllByText('0 observations').length).toBeGreaterThan(0);
  });

  it('creates a trainable plan for each root of a valid multi-game PGN', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Import PGN repertoire' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Repertoire name' }), {
      target: { value: 'Imported multi' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'PGN text' }), {
      target: {
        value:
          '[Event "standard"]\n\n1. e4 e5 2. Nf3 *\n\n[Event "custom"]\n[SetUp "1"]\n[FEN "7k/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText(/Preview valid: 2 game/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create repertoire' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Import PGN repertoire' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Training fixture')).toHaveTextContent(
      'Imported multi · Game 1',
    );

    await user.click(screen.getByLabelText('Training fixture'));
    expect(
      screen.getByRole('option', { name: 'Imported multi · Game 1' }),
    ).toBeVisible();
    expect(
      screen.getByRole('option', { name: 'Imported multi · Game 2' }),
    ).toBeVisible();
  });
});
