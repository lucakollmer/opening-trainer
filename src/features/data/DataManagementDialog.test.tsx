import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from '../../app/App';
import { AppProviders } from '../../app/AppProviders';
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import { phase3DemoPgn } from '../../fixtures/phase3Demo';
import { exportCompleteBackup, previewBackupJson } from '../../infrastructure/import-export/backup';
import { OpeningTrainerDatabase } from '../../infrastructure/db/openingTrainerDatabase';
import { OpeningTrainerRepository } from '../../infrastructure/db/openingTrainerRepository';
import { DataManagementDialog } from './DataManagementDialog';

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { position?: string } }) => (
    <div data-testid="chessboard-adapter" data-position={options.position}>
      Chessboard
    </div>
  ),
}));

async function repository(name = `opening-trainer-restore-ui-${crypto.randomUUID()}`) {
  const database = new OpeningTrainerDatabase(name);
  const result = new OpeningTrainerRepository(database);
  await result.initialize('2026-08-28T08:00:00.000Z');
  return result;
}

describe('PHASE-4 backup restore UI', () => {
  it('reconstructs the restored repertoire and boots it after the required restart', async () => {
    const source = await repository();
    const targetName = `opening-trainer-restore-restart-${crypto.randomUUID()}`;
    const target = await repository(targetName);
    const user = userEvent.setup();
    const reloadAfterRestore = vi.fn();
    const onClose = vi.fn();
    const onDataChanged = vi.fn(async () => {
      const graphs = await target.listRepertoireGraphs();
      expect(graphs).toHaveLength(1);
      expect(graphs[0]?.repertoires[0]?.name).toBe('Restored repertoire');
    });

    let restarted: OpeningTrainerRepository | undefined;
    try {
      const candidate = previewPgnImport(phase3DemoPgn, {
        repertoireId: 'restore-ui-repertoire',
        repertoireName: 'Restored repertoire',
        userColour: 'white',
        sourceLabel: 'PHASE-4 restore UI regression',
      });
      expect(candidate.errors).toHaveLength(0);
      await source.createRepertoire(candidate, '2026-08-28T08:01:00.000Z');
      await source.putSetting(
        'active-plan-id',
        'restored-active-plan',
        '2026-08-28T08:02:00.000Z',
      );
      const { json } = await exportCompleteBackup(
        source.database,
        '2026-08-28T08:03:00.000Z',
      );
      expect(previewBackupJson(json).summary.repertoires).toBe(1);

      const dialog = render(
        <DataManagementDialog
          open
          onClose={onClose}
          repository={target}
          onDataChanged={onDataChanged}
          reloadAfterRestore={reloadAfterRestore}
        />,
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
      await user.upload(
        input as HTMLInputElement,
        new File([json], 'opening-trainer-backup.json', {
          type: 'application/json',
        }),
      );

      expect(await screen.findByText(/1 repertoire\(s\)/u)).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Replace local data' }));

      await waitFor(() => expect(reloadAfterRestore).toHaveBeenCalledTimes(1));
      expect(onDataChanged).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect((await target.listRepertoireGraphs())[0]?.repertoires[0]?.name).toBe(
        'Restored repertoire',
      );
      expect(await target.getSetting('active-plan-id')).toBe('restored-active-plan');

      dialog.unmount();
      target.close();
      restarted = await repository(targetName);
      render(
        <AppProviders>
          <App initialDemoFixtures={false} repository={restarted} />
        </AppProviders>,
      );

      expect(await screen.findByLabelText('Training fixture')).toBeVisible();
      expect(await screen.findByText('Restored repertoire')).toBeVisible();
      expect(screen.getByTestId('chessboard-adapter')).toBeVisible();
    } finally {
      await source.deleteDatabase();
      if (restarted) {
        await restarted.deleteDatabase();
      } else {
        await target.deleteDatabase();
      }
    }
  });
});
