import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { previewPgnImport } from '../domain/repertoire/pgnImport';
import { OpeningTrainerDatabase } from '../infrastructure/db/openingTrainerDatabase';
import { OpeningTrainerRepository } from '../infrastructure/db/openingTrainerRepository';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { position?: string } }) => (
    <div data-testid="chessboard-adapter" data-position={options.position}>
      Chessboard
    </div>
  ),
}));

async function repository() {
  const result = new OpeningTrainerRepository(
    new OpeningTrainerDatabase(`opening-trainer-app-phase4-${crypto.randomUUID()}`),
  );
  await result.initialize('2026-08-28T09:00:00.000Z');
  return result;
}

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

  it('keeps a saved repertoire visible even when it has no trainable user decision', async () => {
    const result = await repository();
    const candidate = previewPgnImport('[Event "Untrainable"]\n\n1. e4 *', {
      repertoireId: 'saved-untrainable',
      repertoireName: 'Saved untrainable repertoire',
      userColour: 'black',
      sourceLabel: 'PHASE-4 untrainable regression',
    });
    expect(candidate.errors).toHaveLength(0);
    await result.createRepertoire(candidate, '2026-08-28T09:01:00.000Z');

    const rendered = render(
      <AppProviders>
        <App initialDemoFixtures={false} repository={result} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Saved repertoire has no trainable lines',
      }),
    ).toBeVisible();
    expect(screen.getByText(/Saved untrainable repertoire/u)).toBeVisible();
    expect(screen.queryByLabelText('Training fixture')).not.toBeInTheDocument();

    rendered.unmount();
    await result.deleteDatabase();
  });
});
