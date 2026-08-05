import { Card, CardContent, Chip, Stack, Typography } from '@mui/material';

export function TaskPreviewCard() {
  return (
    <Card component="section" aria-labelledby="task-heading" variant="outlined">
      <CardContent>
        <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Chip size="small" label="Foundation fixture" />
          <Typography id="task-heading" component="h2" variant="h6">
            Current task adapter
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Task prompts, feedback and scheduling evidence are deliberately not
            implemented in PHASE-0.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
