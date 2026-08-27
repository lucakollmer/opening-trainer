import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { SessionRecord } from '../../infrastructure/db/openingTrainerDatabase';

interface SessionRecoveryDialogProps {
  session: SessionRecord | null;
  onResume: () => void;
  onAbandon: () => void;
}

export function SessionRecoveryDialog({
  session,
  onResume,
  onAbandon,
}: SessionRecoveryDialogProps) {
  return (
    <Dialog open={Boolean(session)} maxWidth="xs" fullWidth>
      <DialogTitle>Resume interrupted session?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Opening Trainer found an unfinished local training session. Resuming restores
          its exact position, target, hints, repair queue and already committed review
          evidence without committing those observations again.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onAbandon}>End session</Button>
        <Button variant="contained" onClick={onResume}>
          Resume session
        </Button>
      </DialogActions>
    </Dialog>
  );
}
