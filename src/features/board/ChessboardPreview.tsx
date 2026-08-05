import { Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { Chessboard } from 'react-chessboard';

export interface BoardMoveCommand {
  type: 'board.move-requested';
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

interface ChessboardPreviewProps {
  position: string;
  orientation: 'white' | 'black';
  userTurn: boolean;
  disabled?: boolean;
  lastMove?: readonly [string, string];
  hintSquares?: readonly string[];
  onMove: (command: BoardMoveCommand) => void;
}

export function ChessboardPreview({
  position,
  orientation,
  userTurn,
  disabled = false,
  lastMove,
  hintSquares = [],
  onMove,
}: ChessboardPreviewProps) {
  const interactionDisabled = disabled || !userTurn;

  return (
    <Paper component="section" aria-labelledby="board-heading" sx={{ p: { xs: 1, sm: 2 } }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography id="board-heading" component="h2" variant="h6" sx={{ flexGrow: 1 }}>
            Training board
          </Typography>
          <Chip size="small" label={userTurn ? 'Your move' : 'Waiting'} />
          <Chip size="small" variant="outlined" label={`${orientation} orientation`} />
        </Stack>

        <div className="training-board-frame" aria-label="Chessboard position">
          <Chessboard options={{ position, boardOrientation: orientation }} />
        </div>

        <Stack
          component="fieldset"
          spacing={1}
          sx={{ border: 0, p: 0, m: 0 }}
          aria-label="Accessible move entry"
        >
          <Typography component="legend" variant="subtitle2">
            Accessible move entry
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              disabled={interactionDisabled}
              onClick={() => onMove({ type: 'board.move-requested', from: 'g1', to: 'f3' })}
            >
              Move knight g1 to f3
            </Button>
            <Button
              variant="outlined"
              disabled={interactionDisabled}
              onClick={() =>
                onMove({
                  type: 'board.move-requested',
                  from: 'a7',
                  to: 'a8',
                  promotion: 'q',
                })
              }
            >
              Promotion boundary
            </Button>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {lastMove ? `Last move: ${lastMove[0]}–${lastMove[1]}. ` : 'No move submitted. '}
          {hintSquares.length > 0
            ? `Hint squares: ${hintSquares.join(', ')}.`
            : 'No hint overlay active.'}
        </Typography>
      </Stack>
    </Paper>
  );
}
