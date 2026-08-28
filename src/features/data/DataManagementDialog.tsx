import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState, type ChangeEvent } from 'react';
import type { OpeningTrainerRepository } from '../../infrastructure/db/openingTrainerRepository';
import {
  MAX_BACKUP_BYTES,
  previewBackupJson,
  verifyBackupIntegrity,
  type BackupPreview,
} from '../../infrastructure/import-export/backup';
import { exportRepertoirePgn } from '../../infrastructure/import-export/pgnExport';

interface DataManagementDialogProps {
  open: boolean;
  onClose: () => void;
  repository: OpeningTrainerRepository;
  selectedRepertoireId?: string;
  onDataChanged: () => Promise<void> | void;
  reloadAfterRestore?: () => void;
}

function downloadText(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeFileStem(value: string): string {
  const stem = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return stem || 'repertoire';
}

export function DataManagementDialog({
  open,
  onClose,
  repository,
  selectedRepertoireId,
  onDataChanged,
  reloadAfterRestore = () => window.location.reload(),
}: DataManagementDialogProps) {
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedRepertoireCount, setSavedRepertoireCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSavedRepertoireCount(null);
    void repository
      .countSavedRepertoires()
      .then((count) => {
        if (active) setSavedRepertoireCount(count);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Could not inspect local data.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [open, repository]);

  const exportBackup = async () => {
    setBusy(true);
    setError(null);
    try {
      const { backup, json } = await repository.exportCompleteBackup();
      downloadText(
        `opening-trainer-backup-${backup.exportedAt.slice(0, 10)}.json`,
        json,
        'application/json',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backup export failed.');
    } finally {
      setBusy(false);
    }
  };

  const chooseRestore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    setRestorePreview(null);
    if (file.size > MAX_BACKUP_BYTES) {
      setError(`Backup exceeds ${MAX_BACKUP_BYTES} bytes.`);
      return;
    }
    try {
      const preview = previewBackupJson(await file.text());
      await verifyBackupIntegrity(preview);
      setRestorePreview(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backup preview failed.');
    }
  };

  const restore = async () => {
    if (!restorePreview) return;
    setBusy(true);
    setError(null);
    try {
      const expectedRepertoireCount = restorePreview.summary.repertoires;
      await repository.restoreCompleteBackup(restorePreview);
      const restoredGraph = await repository.loadCompleteGraph();
      if (restoredGraph.repertoires.length !== expectedRepertoireCount) {
        throw new Error(
          `Backup restore readback expected ${expectedRepertoireCount} repertoire(s) but reconstructed ${restoredGraph.repertoires.length}.`,
        );
      }
      setRestorePreview(null);
      await onDataChanged();
      onClose();
      reloadAfterRestore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backup restore failed.');
    } finally {
      setBusy(false);
    }
  };

  const exportPgn = async () => {
    if (!selectedRepertoireId) return;
    setBusy(true);
    setError(null);
    try {
      await repository.awaitPendingOperations();
      const graph = await repository.loadRepertoireGraph(selectedRepertoireId);
      const repertoire = graph.repertoires[0]!;
      downloadText(
        `${safeFileStem(repertoire.name)}.pgn`,
        exportRepertoirePgn(graph, repertoire.id),
        'application/x-chess-pgn',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PGN export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Local data and recovery</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Complete backup</Typography>
            <Typography variant="body2" color="text.secondary">
              Export a versioned JSON backup of repertoires, playlists, training
              identities, raw review evidence, sessions and settings. Pending local
              writes are completed before the backup snapshot is taken.
            </Typography>
            {savedRepertoireCount === 0 ? (
              <Alert severity="info">
                There are 0 saved repertoires. Bundled demo fixtures are intentionally
                in-memory only and are not included in complete backups. Import a PGN
                before testing backup and restore.
              </Alert>
            ) : savedRepertoireCount !== null ? (
              <Typography variant="caption" color="text.secondary">
                {savedRepertoireCount} saved repertoire(s) will be included. New backups
                include an embedded SHA-256 integrity check.
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Inspecting saved local data…
              </Typography>
            )}
            <Button
              variant="outlined"
              startIcon={<DownloadOutlinedIcon />}
              onClick={() => void exportBackup()}
              disabled={busy || savedRepertoireCount === null || savedRepertoireCount === 0}
            >
              Export complete JSON
            </Button>
            <Typography variant="caption" color="text.secondary">
              Portable backup limit: {MAX_BACKUP_BYTES.toLocaleString()} bytes. Export is
              refused if the generated file would exceed the same limit used by restore.
            </Typography>
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle1">Restore complete backup</Typography>
            <Typography variant="body2" color="text.secondary">
              The file is size-checked, schema-validated and SHA-256 verified when the
              digest is present. Existing local data is not changed until you explicitly
              confirm replacement.
            </Typography>
            <Button component="label" variant="outlined" disabled={busy}>
              Choose JSON backup
              <input
                hidden
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  void chooseRestore(event);
                }}
              />
            </Button>
            {restorePreview ? (
              <Alert severity="warning" icon={<RestoreOutlinedIcon />}>
                Backup v{restorePreview.backup.version} from{' '}
                {restorePreview.backup.exportedAt}: {restorePreview.summary.repertoires}{' '}
                repertoire(s), {restorePreview.summary.playlists} playlist(s),{' '}
                {restorePreview.summary.reviewLogs} review observation(s) and{' '}
                {restorePreview.summary.sessions} session(s). Confirming below replaces
                the current Opening Trainer local data atomically.
              </Alert>
            ) : null}
            {restorePreview?.warnings.map((warning) => (
              <Alert severity="info" key={warning}>
                {warning}
              </Alert>
            ))}
            {restorePreview ? (
              <Button
                color="error"
                variant="contained"
                onClick={() => void restore()}
                disabled={busy}
              >
                Replace local data
              </Button>
            ) : null}
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="subtitle1">Repertoire PGN</Typography>
            <Typography variant="body2" color="text.secondary">
              PGN export contains repertoire moves, variations and representable
              annotations only. It is not a complete backup and does not contain review
              history, sessions or settings.
            </Typography>
            <Button
              variant="outlined"
              onClick={() => void exportPgn()}
              disabled={busy || !selectedRepertoireId}
            >
              Export selected repertoire PGN
            </Button>
            {!selectedRepertoireId ? (
              <Typography variant="caption" color="text.secondary">
                Select or import a saved repertoire before exporting PGN.
              </Typography>
            ) : null}
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
