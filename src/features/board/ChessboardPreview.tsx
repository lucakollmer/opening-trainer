import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type ChangeEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Chessboard } from 'react-chessboard';
import type { PromotionPiece } from '../../domain/chess/chessAdapter';

export interface BoardMoveCommand {
  type: 'board.move-requested';
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

interface ChessboardPreviewProps {
  position: string;
  orientation: 'white' | 'black';
  userTurn: boolean;
  disabled?: boolean;
  lastMove?: readonly [string, string];
  hintSquares?: readonly string[];
  reducedMotion?: boolean;
  onMove: (command: BoardMoveCommand) => boolean;
}

export function ChessboardPreview({
  position,
  orientation,
  userTurn,
  disabled = false,
  lastMove,
  hintSquares = [],
  reducedMotion = false,
  onMove,
}: ChessboardPreviewProps) {
  const interactionDisabled = disabled || !userTurn;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [promotion, setPromotion] = useState<PromotionPiece | ''>('');

  const submitAccessibleMove = () => {
    if (!from || !to || interactionDisabled) return;
    const accepted = onMove({
      type: 'board.move-requested',
      from: from.trim().toLowerCase(),
      to: to.trim().toLowerCase(),
      ...(promotion ? { promotion } : {}),
    });
    if (accepted) {
      setFrom('');
      setTo('');
      setPromotion('');
    }
  };

  const hintSquareStyles = Object.fromEntries(
    hintSquares.map((square) => [
      square,
      { boxShadow: 'inset 0 0 0 4px currentColor' },
    ]),
  );

  return (
    <Paper
      component="section"
      aria-labelledby="board-heading"
      sx={{ p: { xs: 1, sm: 2 } }}
    >
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          <Typography
            id="board-heading"
            component="h2"
            variant="h6"
            sx={{ flexGrow: 1 }}
          >
            Training board
          </Typography>
          <Chip size="small" label={userTurn ? 'Your move' : 'Waiting'} />
          <Chip size="small" variant="outlined" label={`${orientation} orientation`} />
        </Stack>

        <div className="training-board-frame" aria-label="Chessboard position">
          <Chessboard
            options={{
              position,
              boardOrientation: orientation,
              allowDragging: !interactionDisabled,
              animationDurationInMs: reducedMotion ? 0 : 180,
              squareStyles: hintSquareStyles,
              onPieceDrop: ({ sourceSquare, targetSquare }) => {
                if (interactionDisabled || !targetSquare) return false;
                return onMove({
                  type: 'board.move-requested',
                  from: sourceSquare,
                  to: targetSquare,
                });
              },
            }}
          />
        </div>

        <Stack component="fieldset" spacing={1} sx={{ border: 0, p: 0, m: 0 }}>
          <Typography component="legend" variant="subtitle2">
            Accessible move entry
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
            <TextField
              size="small"
              label="From square"
              value={from}
              disabled={interactionDisabled}
              slotProps={{ htmlInput: { maxLength: 2, inputMode: 'text' } }}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setFrom(event.target.value)
              }
            />
            <TextField
              size="small"
              label="To square"
              value={to}
              disabled={interactionDisabled}
              slotProps={{ htmlInput: { maxLength: 2, inputMode: 'text' } }}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setTo(event.target.value)
              }
            />
            <FormControl
              size="small"
              sx={{ minWidth: 130 }}
              disabled={interactionDisabled}
            >
              <InputLabel id="promotion-label">Promotion</InputLabel>
              <Select
                labelId="promotion-label"
                label="Promotion"
                value={promotion}
                onChange={(event: SelectChangeEvent) =>
                  setPromotion(event.target.value as PromotionPiece | '')
                }
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="q">Queen</MenuItem>
                <MenuItem value="r">Rook</MenuItem>
                <MenuItem value="b">Bishop</MenuItem>
                <MenuItem value="n">Knight</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              disabled={
                interactionDisabled ||
                from.trim().length !== 2 ||
                to.trim().length !== 2
              }
              onClick={submitAccessibleMove}
            >
              Submit move
            </Button>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {lastMove
            ? `Last move: ${lastMove[0]}–${lastMove[1]}. `
            : 'No move submitted. '}
          {hintSquares.length > 0
            ? `Hint destinations highlighted: ${hintSquares.join(', ')}.`
            : 'No hint overlay active.'}
        </Typography>
      </Stack>
    </Paper>
  );
}
