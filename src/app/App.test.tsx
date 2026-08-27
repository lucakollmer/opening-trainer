import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

async function selectPhase3Demo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('Training fixture'));
  await user.click(
    screen.getByRole('option', {
      name: 'PHASE-3 · Graph alternatives and transposition',
    }),
  );
}

describe('training shell with PHASE-3 graph integration', () => {
  it('renders the responsive shell with the accepted PHASE-2 fixture by default', () => {
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

  it('rejects an illegal move without advancing or creating a terminal review observation', async () => {
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

  it('reveals only the responded route item after a correct move', async () => {
    const user = userEvent.setup();
    renderApp();
    await submitAccessibleMove(user, 'e2', 'e4');
    expect(screen.getAllByText('1. e4').length).toBeGreaterThan(0);
    expect(screen.queryByText('1... c5')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Correct repertoire move' }),
    ).toBeVisible();
  });

  it('classifies a known sibling separately and offers repair on the legacy fixture', async () => {
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
    expect(screen.getByText(/This prompt expects Nf3/u)).toBeVisible();
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
    expect(screen.getByText(/Piece: kingside knight/u)).toBeVisible();
    expect(screen.queryByText('2. Nf3')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hint 2' }));
    expect(screen.getByText(/Candidate destinations: f3, h3/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Hint 3' }));
    expect(screen.getByText(/pressure on the e5 pawn/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reveal move' }));
    expect(screen.getByText('Move: Nf3.')).toBeVisible();
    expect(screen.getAllByText('2. Nf3').length).toBeGreaterThan(0);
  });

  it('keeps PHASE-3 graph answers out of the Train-mode DOM before response', async () => {
    const user = userEvent.setup();
    renderApp();
    await selectPhase3Demo(user);
    expect(screen.queryByText('Nf3')).not.toBeInTheDocument();
    expect(screen.queryByText('Nc3')).not.toBeInTheDocument();
    expect(screen.queryByText('Bb5')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    expect(screen.getAllByText('Nf3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nc3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bb5').length).toBeGreaterThan(0);
  });

  it('accepts the PHASE-3 alternate graph move and reports replacement target work', async () => {
    const user = userEvent.setup();
    renderApp();
    await selectPhase3Demo(user);
    await submitAccessibleMove(user, 'e2', 'e4');
    await screen.findByRole('heading', { name: 'Correct repertoire move' });
    await screen.findByRole(
      'heading',
      { name: 'Find the repertoire move' },
      { timeout: 2000 },
    );
    await submitAccessibleMove(user, 'b1', 'c3');
    expect(
      screen.getByRole('heading', { name: 'Correct repertoire move' }),
    ).toBeVisible();
    expect(
      screen.getByText(/replacement target work has been queued/u),
    ).toBeVisible();
  });

  it('edits playlist inclusion in memory and stops accepting the excluded branch', async () => {
    const user = userEvent.setup();
    renderApp();
    await selectPhase3Demo(user);
    const inclusion = screen.getByRole('switch', {
      name: 'Include alternative branch',
    });
    expect(inclusion).toBeChecked();
    await user.click(inclusion);
    expect(inclusion).not.toBeChecked();

    await submitAccessibleMove(user, 'e2', 'e4');
    await screen.findByRole(
      'heading',
      { name: 'Find the repertoire move' },
      { timeout: 2000 },
    );
    await submitAccessibleMove(user, 'b1', 'c3');
    expect(
      screen.getByRole('heading', { name: 'Known sibling variation' }),
    ).toBeVisible();
    expect(screen.getByText(/This prompt expects Nf3/u)).toBeVisible();
  });

  it('previews recursive PGN locally and cancel leaves the active fixture unchanged', async () => {
    const user = userEvent.setup();
    renderApp();
    const before = screen.getByLabelText('Training fixture').textContent;
    await user.click(screen.getByRole('button', { name: 'Import PGN repertoire' }));
    expect(
      screen.getByRole('dialog', { name: 'Import PGN repertoire' }),
    ).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'PGN text' }), {
      target: {
        value:
          '[Event "recursive"]\n\n1. e4 e5 2. Nf3 (2. Nc3 Nc6 3. Nf3 $1) Nc6 3. Nc3 {transpose} Nf6 *',
      },
    });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText(/Preview valid: 1 game/u)).toBeVisible();
    expect(screen.getByText(/1 recursive variation/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Import PGN repertoire' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Training fixture').textContent).toBe(before);
  });

  it('commits a validated PGN candidate once and activates its in-memory repertoire', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: 'Import PGN repertoire' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Repertoire name' }), {
      target: { value: 'Imported Queen Pawn' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'PGN text' }), {
      target: { value: '[Event "import"]\n\n1. d4 d5 2. c4 *' },
    });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByText(/Preview valid: 1 game/u)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create repertoire' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Import PGN repertoire' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Training fixture')).toHaveTextContent(
      'Imported Queen Pawn',
    );
    await user.click(screen.getByRole('button', { name: 'Browse' }));
    expect(screen.getAllByText('d4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('d5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('c4').length).toBeGreaterThan(0);
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
