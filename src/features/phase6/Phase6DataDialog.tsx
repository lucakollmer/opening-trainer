import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type ChangeEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { ManagedRepertoireSummary } from '../../domain/phase6/types';
import type { Phase6BackupPreview } from '../../infrastructure/import-export/phase6Backup';
import type { Phase6OpeningTrainerRepository } from '../../infrastructure/db/phase6Repository';

interface Phase6DataDialogProps {
  open: boolean;
  onClose: () => void;
  repository: Phase6OpeningTrainerRepository;
  repertoires: readonly ManagedRepertoireSummary[];
  onRestored: () => Promise<void>;
}

function downloadText(filename: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function Phase6DataDialog({
  open,
  onClose,
  repository,
  repertoires,
  onRestored,
}: Phase6DataDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Phase6BackupPreview | null>(null);
  const [selectedRepertoireId, setSelectedRepertoireId] = useState('');
  const [resetText, setResetText] = useState('');

  const exportBackup = async () => {
    setBusy(true);
    setError(null);
    try {
      const { json } = await repository.exportCompleteBackup();
      downloadText(
        `opening-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`,
        json,
        'application/json',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backup export failed.');
    } finally {
      setBusy(false);
    }
  };

  const loadBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    try {
      setPreview(repository.previewBackupJson(await file.text()));
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Backup preview failed.');
    }
  };

  const restore = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await repository.restoreCompleteBackup(preview);
      setPreview(null);
      await onRestored();
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
      const result = await repository.exportRepertoirePgn(selectedRepertoireId);
      downloadText('opening-trainer-repertoire.pgn', result.pgn, 'application/x-chess-pgn');
      if (result.warnings.length > 0) setError(result.warnings.join(' '));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PGN export failed.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setError(null);
    try {
      await repository.clearUserData(resetText);
      setResetText('');
      await onRestored();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Local reset failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Data, import history and portability</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Complete JSON backup is the lossless PHASE-6 format. It includes archive
            state, move evidence, name evidence, contrast evidence and every scheduler
            projection. PGN remains a repertoire interchange format rather than a full
            training backup.
          </Typography>
          <Button variant="outlined" disabled={busy} onClick={() => void exportBackup()}>
            Export complete JSON backup
          </Button>
          <Button component="label" variant="outlined" disabled={busy}>
            Choose backup to restore
            <input hidden type="file" accept=".json,application/json" onChange={(event: ChangeEvent<HTMLInputElement>) => void loadBackup(event)} />
          </Button>
          {preview ? (
            <Alert severity="warning">
              Restore is atomic and replaces all local Opening Trainer data.{' '}
              {preview.warnings.join(' ')}
            </Alert>
          ) : null}
          {preview ? (
            <Button variant="contained" disabled={busy} onClick={() => void restore()}>
              Restore validated backup
            </Button>
          ) : null}

          <FormControl size="small" fullWidth>
            <InputLabel id="phase6-pgn-repertoire-label">Repertoire for PGN export</InputLabel>
            <Select
              labelId="phase6-pgn-repertoire-label"
              label="Repertoire for PGN export"
              value={selectedRepertoireId}
              onChange={(event: SelectChangeEvent<string>) =>
                setSelectedRepertoireId(String(event.target.value))
              }
            >
              <MenuItem value="">Select repertoire</MenuItem>
              {repertoires.map((repertoire) => (
                <MenuItem key={repertoire.id} value={repertoire.id}>
                  {repertoire.name}{repertoire.archived ? ' (archived)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button disabled={busy || !selectedRepertoireId} onClick={() => void exportPgn()}>
            Export PGN
          </Button>

          <TextField
            label="Type RESET LOCAL DATA to clear this browser"
            value={resetText}
            disabled={busy}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setResetText(event.target.value)}
          />
          <Button
            color="error"
            disabled={busy || resetText !== 'RESET LOCAL DATA'}
            onClick={() => void reset()}
          >
            Reset local data
          </Button>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
