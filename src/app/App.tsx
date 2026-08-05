import { AppBar, Box, Container, Stack, Toolbar, Typography } from '@mui/material';
import { ChessboardPreview } from '../features/board/ChessboardPreview';
import { RepertoireTreePreview } from '../features/repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../features/task/TaskPreviewCard';

export function App() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
            Opening Trainer
          </Typography>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ py: 3 }}>
        <Typography variant="overline" color="text.secondary">
          PHASE-0 integration shell — not the final training interface
        </Typography>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ mt: 1, alignItems: { xs: 'stretch', md: 'flex-start' } }}
        >
          <Box sx={{ flex: '1 1 520px', minWidth: 0 }}>
            <ChessboardPreview />
          </Box>
          <Stack spacing={2} sx={{ flex: '1 1 320px', minWidth: 0 }}>
            <RepertoireTreePreview />
            <TaskPreviewCard />
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
