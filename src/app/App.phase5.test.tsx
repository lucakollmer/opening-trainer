import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { previewPgnImport } from '../domain/repertoire/pgnImport';
import { phase3DemoPgn } from '../fixtures/phase3Demo';
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

it('starts saved repertoires through bounded scheduled-session controls', async () => {
  const repository = new OpeningTrainerRepository(
    new OpeningTrainerDatabase(`opening-trainer-app-phase5-${crypto.randomUUID()}`),
  );
  await repository.initialize('2026-08-28T12:00:00.000Z');
  const candidate = previewPgnImport(phase3DemoPgn, {
    repertoireId: 'phase5-ui',
    repertoireName: 'Phase 5 UI',
    userColour: 'white',
    sourceLabel: 'PHASE-5 UI test',
  });
  await repository.createRepertoire(candidate, '2026-08-28T12:01:00.000Z');

  const rendered = render(
    <AppProviders>
      <App initialDemoFixtures={false} repository={repository} />
    </AppProviders>,
  );

  expect(await screen.findByText('Scheduled locally')).toBeVisible();
  expect(screen.getByRole('button', { name: 'New scheduled session' })).toBeVisible();
  expect(screen.getByLabelText('Session mode')).toBeVisible();
  expect(screen.getByLabelText('Targets')).toBeVisible();
  expect(screen.getByLabelText('New limit')).toBeVisible();
  expect(screen.getByLabelText('Opponent delay')).toBeVisible();
  expect(screen.getByText(/due · .* new/u)).toBeVisible();
  expect(
    screen.queryByText(/stability|difficulty|retrievability/iu),
  ).not.toBeInTheDocument();

  rendered.unmount();
  await repository.deleteDatabase();
});
