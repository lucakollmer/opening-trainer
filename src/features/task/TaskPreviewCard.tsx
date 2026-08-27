import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  canSubmitUserMove,
  currentFixtureStep,
  hintDisclosure,
  readyRetestCount,
  type TrainingSessionState,
} from '../../domain/training/session';
import type { TrainingExercisePlan } from '../../domain/training/exercisePlan';

interface TaskPreviewCardProps {
  session: TrainingSessionState;
  plan: TrainingExercisePlan;
  onHint: () => void;
  onReveal: () => void;
  onContinue: () => void;
  onRetest: () => void;
  onCompleteSession: () => void;
  onRestart: () => void;
  onAbandon: () => void;
}

function defaultContent(session: TrainingSessionState) {
  switch (session.status) {
    case 'awaiting-user-move':
      return {
        severity: 'info' as const,
        title: 'Find the repertoire move',
        message: 'Play a legal move from the board or accessible move entry.',
      };
    case 'opponent-moving':
      return {
        severity: 'info' as const,
        title: 'Opponent reply',
        message: 'The deterministic repertoire opponent is following the selected route.',
      };
    case 'hint-offered':
      return {
        severity: 'warning' as const,
        title: 'Hint requested',
        message: 'Use the disclosed clue and make the move when ready.',
      };
    case 'repair-replay':
      return {
        severity: 'warning' as const,
        title: session.feedback?.title ?? 'Repair this decision',
        message:
          session.feedback?.message ??
          'Replay the accepted move now. The original failure remains recorded.',
      };
    case 'line-complete':
      return {
        severity: 'success' as const,
        title: 'Line complete',
        message: 'The selected repertoire route has been replayed from the initial position.',
      };
    case 'session-complete':
      return {
        severity: 'success' as const,
        title: 'Session complete',
        message: 'This run kept observations in memory only; no scheduler state was updated.',
      };
    case 'abandoned':
      return {
        severity: 'warning' as const,
        title: 'Session abandoned',
        message: 'The in-memory run ended without committing persistent review state.',
      };
    case 'error':
      return {
        severity: 'error' as const,
        title: 'Training data error',
        message:
          session.feedback?.message ??
          'The exercise could not continue from the current position.',
      };
    default:
      return {
        severity:
          session.feedback?.kind === 'correct' || session.feedback?.kind === 'repair'
            ? ('success' as const)
            : session.feedback?.kind === 'illegal' ||
                session.feedback?.kind === 'outside'
              ? ('error' as const)
              : ('warning' as const),
        title: session.feedback?.title ?? 'Training feedback',
        message: session.feedback?.message ?? 'Review the feedback before continuing.',
      };
  }
}

export function TaskPreviewCard({
  session,
  plan,
  onHint,
  onReveal,
  onContinue,
  onRetest,
  onCompleteSession,
  onRestart,
  onAbandon,
}: TaskPreviewCardProps) {
  const content = defaultContent(session);
  const hint = hintDisclosure(session, plan);
  const step = currentFixtureStep(session, plan);
  const hintAllowed =
    canSubmitUserMove(session) &&
    session.status !== 'repair-replay' &&
    step?.actor === 'user' &&
    Boolean(step.hint);
  const readyRetests = readyRetestCount(session);
  const totalPlies = Math.max(1, ...plan.steps.map((item) => item.ply + 1));

  return (
    <Card component="section" aria-labelledby="task-heading" variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Chip
              size="small"
              label={session.runKind === 'retest' ? 'Retest run' : 'Primary run'}
            />
            <Chip size="small" variant="outlined" label={`${session.evidence.length} observations`} />
            {session.retestQueue.length > 0 ? (
              <Chip size="small" variant="outlined" label={`${session.retestQueue.length} retest queued`} />
            ) : null}
            <Typography variant="caption" color="text.secondary">
              {session.status}
            </Typography>
          </Stack>

          <Typography id="task-heading" component="h2" variant="h6">
            {content.title}
          </Typography>
          <Alert severity={content.severity} aria-live="polite">
            {content.message}
          </Alert>
          {hint ? <Alert severity={session.hintLevel === 4 ? 'warning' : 'info'}>{hint}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            Move {Math.min(session.plyIndex + 1, totalPlies)} of {totalPlies}. Review observations
            and retest tickets remain in-memory until the persistence phase.
          </Typography>
        </Stack>
      </CardContent>

      <CardActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {hintAllowed && session.hintLevel < 3 ? (
          <Button onClick={onHint}>Hint {session.hintLevel + 1}</Button>
        ) : null}
        {hintAllowed && session.hintLevel < 4 ? <Button onClick={onReveal}>Reveal move</Button> : null}
        {session.status === 'correct-feedback' ? <Button onClick={onContinue}>Continue line</Button> : null}
        {session.status === 'wrong-variation-feedback' ||
        session.status === 'outside-repertoire-feedback' ||
        session.status === 'answer-revealed' ? (
          <Button onClick={onContinue}>Repair move</Button>
        ) : null}
        {session.status === 'line-complete' && readyRetests > 0 ? (
          <Button onClick={onRetest}>Run queued retest</Button>
        ) : null}
        {session.status === 'line-complete' ? <Button onClick={onCompleteSession}>Complete session</Button> : null}
        {session.status === 'session-complete' || session.status === 'abandoned' ? (
          <Button onClick={onRestart}>Restart session</Button>
        ) : null}
        {!['session-complete', 'abandoned', 'line-complete'].includes(session.status) ? (
          <Button onClick={onAbandon}>End session</Button>
        ) : null}
      </CardActions>
    </Card>
  );
}
