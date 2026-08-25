import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: ({
    options,
  }: {
    options: { position?: string; boardOrientation?: string; allowDragging?: boolean };
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

async function submitAccessibleMove(
  user: ReturnType<typeof userEvent.setup>,
  from: string,
  to: string,
) {
  const fromInput = screen.getByRole('textbox', { name: 'From square' });
  const toInput = screen.getByRole('textbox', { name: 'To square' });
  await user.clear(fromInput);
  await user.type(fromInput, from);
  await user.clear(toInput);
  await user.type(toInput, to);
  await user.click(screen.getByRole('button', { name: 'Submit move' }));
}

describe('PHASE-2 deterministic training vertical slice', () => {
  it('renders the responsive shell with the real in-memory training fixture', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'Opening Trainer' })).toBeVisible();
    expect(screen.getByLabelText('Training fixture')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Training mode' })).toBeVisible();
    expect(screen.getByTestId('chessboard-adapter')).toHaveAttribute(
      'data-orientation',
      'white',
    );
    expect(screen.getByRole('heading', { name: 'Repertoire tree' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Find the repertoire move' }),
    ).toBeVisible();
  });

  it('withholds all future answer labels in Train mode and reveals them in Browse mode', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.queryByText('1. e4')).not.toBeInTheDocument();
    expect(screen.queryByText('1... e5')).not.toBeInTheDocument();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('fix01-node');

    await user.click(screen.getByRole('button', { name: 'Browse' }));

    expect(screen.getAllByText('1. e4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1... e5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2. Nf3').length).toBeGreaterThan(0);
  });

  it('rejects an illegal move without advancing the board or emitting a full review observation', async () => {
    const user = userEvent.setup();
    renderApp();
    const initialPosition = screen
      .getByTestId('chessboard-adapter')
      .getAttribute('data-position');

    await submitAccessibleMove(user, 'e2', 'e5');

    expect(screen.getByRole('heading', { name: 'Illegal move' })).toBeVisible();
    expect(screen.getByTestId('chessboard-adapter')).toHaveAttribute(
      'data-position',
      initialPosition,
    );
    expect(screen.getAllByText('0 observations').length).toBeGreaterThan(0);
  });

  it('reveals only the responded route item after a correct move, not an unrelated sibling reply', async () => {
    const user = userEvent.setup();
    renderApp();

    await submitAccessibleMove(user, 'e2', 'e4');

    expect(screen.getAllByText('1. e4').length).toBeGreaterThan(0);
    expect(screen.queryByText('1... c5')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Correct repertoire move' }),
    ).toBeVisible();
  });

  it('classifies a known sibling move separately and offers an explicit repair', async () => {
    const user = userEvent.setup();
    renderApp();

    await submitAccessibleMove(user, 'e2', 'e4');
    await user.click(screen.getByRole('button', { name: 'Continue line' }));
    await screen.findByRole(
      'heading',
      { name: 'Find the repertoire move' },
      { timeout: 1500 },
    );

    await submitAccessibleMove(user, 'b1', 'c3');

    expect(
      screen.getByRole('heading', { name: 'Known sibling variation' }),
    ).toBeVisible();
    expect(screen.getByText(/This prompt expects Nf3/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Repair move' })).toBeVisible();
  });

  it('progresses through hints without rendering the full move before reveal', async () => {
    const user = userEvent.setup();
    renderApp();

    await submitAccessibleMove(user, 'e2', 'e4');
    await user.click(screen.getByRole('button', { name: 'Continue line' }));
    await screen.findByRole(
      'heading',
      { name: 'Find the repertoire move' },
      { timeout: 1500 },
    );

    await user.click(screen.getByRole('button', { name: 'Hint 1' }));
    expect(screen.getByText(/Piece: kingside knight/)).toBeVisible();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hint 2' }));
    expect(screen.getByText(/Candidate destinations: f3, h3/)).toBeVisible();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hint 3' }));
    expect(screen.getByText(/pressure on the e5 pawn/)).toBeVisible();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal move' }));
    expect(screen.getByText('Move: Nf3.')).toBeVisible();
    expect(screen.getAllByText('2. Nf3').length).toBeGreaterThan(0);
  });

  it('opens the compact tree drawer and restores focus when it closes', async () => {
    const user = userEvent.setup();
    renderApp();

    const openButton = screen.getByRole('button', { name: 'Open repertoire tree' });
    await user.click(openButton);

    const presentation = screen.getByRole('presentation');
    expect(
      within(presentation).getByRole('heading', { name: 'Repertoire tree' }),
    ).toBeVisible();

    await user.keyboard('{Escape}');
    expect(openButton).toHaveFocus();
  });
});
