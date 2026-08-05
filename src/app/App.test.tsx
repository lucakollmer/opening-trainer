import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: () => <div data-testid="chessboard-adapter">Chessboard</div>,
}));

function renderApp() {
  return render(
    <AppProviders>
      <App />
    </AppProviders>,
  );
}

describe('PHASE-1 responsive shell', () => {
  it('renders the toolbar, board, task panel, and desktop tree composition', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Opening Trainer' })).toBeVisible();
    expect(screen.getByLabelText('Repertoire')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Training mode' })).toBeVisible();
    expect(screen.getByTestId('chessboard-adapter')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Repertoire tree' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Find the repertoire move' })).toBeVisible();
  });

  it('does not expose future answer labels in Train mode and reveals them in Browse mode', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();
    expect(screen.queryByText('2... Nc6')).not.toBeInTheDocument();
    expect(screen.getAllByText('Hidden continuation')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Browse' }));

    expect(screen.getAllByText('2. Nf3')).toHaveLength(2);
    expect(screen.getAllByText('2... Nc6')).toHaveLength(2);
  });

  it('emits a typed board command and exposes the promotion boundary', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Move knight g1 to f3' }));

    expect(screen.getByRole('heading', { name: 'Fixture command received' })).toBeVisible();
    expect(screen.getByText(/Last move: g1–f3/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Promotion boundary' })).toBeEnabled();
  });

  it('opens the compact tree drawer and restores focus when it closes', async () => {
    const user = userEvent.setup();
    renderApp();

    const openButton = screen.getByRole('button', { name: 'Open repertoire tree' });
    await user.click(openButton);

    const presentation = screen.getByRole('presentation');
    expect(within(presentation).getByRole('heading', { name: 'Repertoire tree' })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(openButton).toHaveFocus();
  });

  it('moves through explicit task fixture states without persisting review evidence', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByRole('heading', { name: 'Synthetic hint' })).toBeVisible();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();
  });
});
