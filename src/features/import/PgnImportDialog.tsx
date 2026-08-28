import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type ChangeEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  MAX_PGN_BYTES,
  MAX_PGN_GAMES,
  MAX_PGN_MOVES,
  MAX_PGN_VARIATION_DEPTH,
  previewPgnImport,
} from '../../domain/repertoire/pgnImport';
import type { Colour, ImportCandidate } from '../../domain/repertoire/types';

interface PgnImportDialogProps {
  open: boolean;
  onClose: () => void;
  onCommit: (candidate: ImportCandidate) => Promise<void> | void;
}

export function PgnImportDialog({ open, onClose, onCommit }: PgnImportDialogProps) {
  const [pgn, setPgn] = useState('');
  const [name, setName] = useState('Imported repertoire');
  const [colour, setColour] = useState<Colour>('white');
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const preview = () => {
    setCommitError(null);
    const repertoireId =
      globalThis.crypto?.randomUUID?.() ?? `import-${Date.now().toString(36)}`;
    setCandidate(
      previewPgnImport(pgn, {
        repertoireId,
        repertoireName: name.trim() || 'Imported repertoire',
        userColour: colour,
        sourceLabel: 'Local PGN import',
      }),
    );
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCandidate(null);
    setCommitError(null);
    if (file.size > MAX_PGN_BYTES) {
      setPgn('');
      setCommitError(`PGN exceeds the ${MAX_PGN_BYTES.toLocaleString()}-byte limit.`);
      return;
    }
    try {
      setPgn(await file.text());
    } catch (error) {
      setCommitError(
        error instanceof Error ? error.message : 'Could not read PGN file.',
      );
    }
  };

  const commit = async () => {
    if (!candidate || candidate.errors.length > 0 || committing) return;
    setCommitting(true);
    try {
      await onCommit(candidate);
      setCandidate(null);
      setCommitError(null);
      onClose();
    } catch (error) {
      setCommitError(error instanceof Error ? error.message : 'Import commit failed.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={committing ? undefined : onClose}
      fullWidth
      maxWidth="md"
    >
      <DialogTitle>Import PGN repertoire</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Preview is isolated and does not mutate repertoire state. Recursive
            variations, comments and NAGs are preserved before an explicit
            create-repertoire commit.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Import limits: {MAX_PGN_BYTES.toLocaleString()} bytes,{' '}
            {MAX_PGN_GAMES.toLocaleString()} games, {MAX_PGN_MOVES.toLocaleString()}{' '}
            move tokens and {MAX_PGN_VARIATION_DEPTH} nested variation levels.
          </Typography>
          <TextField
            label="Repertoire name"
            value={name}
            disabled={committing}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setName(event.target.value);
              setCandidate(null);
            }}
          />
          <FormControl size="small">
            <InputLabel id="import-colour-label">Your colour</InputLabel>
            <Select
              labelId="import-colour-label"
              label="Your colour"
              value={colour}
              disabled={committing}
              onChange={(event: SelectChangeEvent<Colour>) => {
                setColour(event.target.value);
                setCandidate(null);
              }}
            >
              <MenuItem value="white">White</MenuItem>
              <MenuItem value="black">Black</MenuItem>
            </Select>
          </FormControl>
          <Button component="label" variant="outlined" disabled={committing}>
            Choose local PGN file
            <input
              hidden
              type="file"
              accept=".pgn,text/plain"
              onChange={(event) => {
                void loadFile(event);
              }}
            />
          </Button>
          <TextField
            label="PGN text"
            multiline
            minRows={10}
            value={pgn}
            disabled={committing}
            onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              setPgn(event.target.value);
              setCandidate(null);
              setCommitError(null);
            }}
            slotProps={{ htmlInput: { spellCheck: false } }}
          />
          {candidate ? (
            candidate.errors.length > 0 ? (
              <Stack spacing={1}>
                {candidate.errors.map((error, index) => (
                  <Alert severity="error" key={`${error.code}-${index}`}>
                    {error.message}
                    {error.sourceLocator
                      ? ` (game ${error.sourceLocator.game}, line ${error.sourceLocator.line}, column ${error.sourceLocator.column})`
                      : ''}
                  </Alert>
                ))}
              </Stack>
            ) : (
              <Stack spacing={1}>
                <Alert severity="success">
                  Preview valid: {candidate.summary.games} game(s),{' '}
                  {candidate.summary.positions} canonical positions,{' '}
                  {candidate.summary.moves} contextual moves,{' '}
                  {candidate.summary.variations} recursive variation(s),{' '}
                  {candidate.summary.comments} comment(s) and {candidate.summary.nags}{' '}
                  NAG(s).
                </Alert>
                {candidate.warnings.map((warning, index) => (
                  <Alert severity="warning" key={`${warning.code}-${index}`}>
                    {warning.message}
                  </Alert>
                ))}
              </Stack>
            )
          ) : null}
          {commitError ? <Alert severity="error">{commitError}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={committing}>
          Cancel
        </Button>
        <Button onClick={preview} disabled={!pgn.trim() || committing}>
          Preview
        </Button>
        <Button
          variant="contained"
          onClick={() => void commit()}
          disabled={!candidate || candidate.errors.length > 0 || committing}
        >
          {committing ? 'Saving…' : 'Create repertoire'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
