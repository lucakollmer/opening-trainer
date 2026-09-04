import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

export interface Phase6RecoveryDescriptor {
  kind: 'move' | 'name' | 'contrast';
  id: string;
  updatedAt: string;
}

interface Phase6RecoveryDialogProps {
  recovery: Phase6RecoveryDescriptor | null;
  onResume: () => Promise<void>;
  onAbandon: () => Promise<void>;
}

export function Phase6RecoveryDialog({
  recovery,
  onResume,
  onAbandon,
}: Phase6RecoveryDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Session recovery failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(recovery)} maxWidth="xs" fullWidth>
      <DialogTitle>Resume interrupted recall?</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            An unfinished {recovery?.kind ?? 'training'} session is stored locally.
            Resume it before Browse reveals repertoire answers, or end it and keep all
            observations already committed.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => void run(onAbandon)}>
          End session
        </Button>
        <Button variant="contained" disabled={busy} onClick={() => void run(onResume)}>
          Resume
        </Button>
      </DialogActions>
    </Dialog>
  );
}
