import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { SessionRecord } from '../../infrastructure/db/openingTrainerDatabase';

interface SessionRecoveryDialogProps {
  session: SessionRecord | null;
  onResume: () => Promise<void> | void;
  onAbandon: () => Promise<void> | void;
}

export function SessionRecoveryDialog({
  session,
  onResume,
  onAbandon,
}: SessionRecoveryDialogProps) {
  const [busyAction, setBusyAction] = useState<'resume' | 'abandon' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    action: 'resume' | 'abandon',
    callback: () => Promise<void> | void,
  ) => {
    if (busyAction) return;
    setBusyAction(action);
    setError(null);
    try {
      await callback();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Session recovery action failed.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Dialog open={Boolean(session)} maxWidth="xs" fullWidth>
      <DialogTitle>Resume interrupted session?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Opening Trainer found an unfinished local training session. Resuming restores
          its exact position, target, hints, repair queue and already committed review
          evidence without committing those observations again.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          disabled={Boolean(busyAction)}
          onClick={() => void run('abandon', onAbandon)}
        >
          {busyAction === 'abandon' ? 'Ending…' : 'End session'}
        </Button>
        <Button
          variant="contained"
          disabled={Boolean(busyAction)}
          onClick={() => void run('resume', onResume)}
        >
          {busyAction === 'resume' ? 'Resuming…' : 'Resume session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
