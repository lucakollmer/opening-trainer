import { Alert, Button, Card, CardActions, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { TaskFixtureState } from '../../fixtures/foundationFixture';

interface TaskPreviewCardProps {
  state: TaskFixtureState;
  onHint: () => void;
  onContinue: () => void;
}

const stateContent: Record<
  TaskFixtureState,
  { tone: 'info' | 'success' | 'warning'; title: string; instruction: string }
> = {
  'awaiting-user-move': {
    tone: 'info',
    title: 'Find the repertoire move',
    instruction: 'Use the board or the accessible move entry. No review evidence is stored.',
  },
  'correct-feedback': {
    tone: 'success',
    title: 'Fixture command received',
    instruction: 'The shell accepted a typed command. Real grading begins in PHASE-2.',
  },
  'hint-offered': {
    tone: 'warning',
    title: 'Synthetic hint',
    instruction: 'Consider developing a kingside piece. The answer remains concealed.',
  },
  'line-complete': {
    tone: 'success',
    title: 'Fixture line complete',
    instruction: 'This state demonstrates the line-summary surface only.',
  },
};

export function TaskPreviewCard({ state, onHint, onContinue }: TaskPreviewCardProps) {
  const content = stateContent[state];

  return (
    <Card component="section" aria-labelledby="task-heading" variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip size="small" label="Synthetic fixture" />
            <Typography variant="caption" color="text.secondary">
              {state}
            </Typography>
          </Stack>
          <Typography id="task-heading" component="h2" variant="h6">
            {content.title}
          </Typography>
          <Alert severity={content.tone} aria-live={content.tone === 'success' ? 'polite' : 'off'}>
            {content.instruction}
          </Alert>
        </Stack>
      </CardContent>
      <CardActions>
        <Button onClick={onHint} disabled={state === 'hint-offered'}>
          Hint
        </Button>
        <Button onClick={onContinue}>Next fixture state</Button>
      </CardActions>
    </Card>
  );
}
