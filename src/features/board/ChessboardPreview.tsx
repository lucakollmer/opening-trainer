import { Paper, Stack, Typography } from '@mui/material';
import { Chessboard } from 'react-chessboard';

export function ChessboardPreview() {
  return (
    <Paper component="section" aria-labelledby="board-heading" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <div>
          <Typography id="board-heading" component="h2" variant="h6">
            Board adapter
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Package rendering only; move handling begins in a later phase.
          </Typography>
        </div>
        <div className="foundation-board-frame">
          <Chessboard options={{}} />
        </div>
      </Stack>
    </Paper>
  );
}
