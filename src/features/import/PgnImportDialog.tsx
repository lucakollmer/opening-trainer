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
import { previewPgnImport } from '../../domain/repertoire/pgnImport';
import type { Colour, ImportCandidate } from '../../domain/repertoire/types';

interface PgnImportDialogProps {
  open: boolean;
  onClose: () => void;
  onCommit: (candidate: ImportCandidate) => void;
}

export function PgnImportDialog({
  open,
  onClose,
  onCommit,
}: PgnImportDialogProps) {
  const [pgn, setPgn] = useState('');
  const [name, setName] = useState('Imported repertoire');
  const [colour, setColour] = useState<Colour>('white');
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

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
    if (!file) return;
    setPgn(await file.text());
    setCandidate(null);
    setCommitError(null);
    event.target.value = '';
  };

  const commit = () => {
    if (!candidate || candidate.errors.length > 0) return;
    try {
      onCommit(candidate);
      setCandidate(null);
      setCommitError(null);
      onClose();
    } catch (error) {
      setCommitError(
        error instanceof Error ? error.message : 'Import commit failed.',
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Import PGN repertoire</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Preview is isolated and does not mutate repertoire state. Recursive variations,
            comments and NAGs are preserved before an explicit create-repertoire commit.
          </Typography>
          <TextField
            label="Repertoire name"
            value={name}
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
              onChange={(event: SelectChangeEvent<Colour>) => {
                setColour(event.target.value);
                setCandidate(null);
              }}
            >
              <MenuItem value="white">White</MenuItem>
              <MenuItem value="black">Black</MenuItem>
            </Select>
          </FormControl>
          <Button component="label" variant="outlined">
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
                  {candidate.summary.comments} comment(s) and {candidate.summary.nags} NAG(s).
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
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={preview} disabled={!pgn.trim()}>
          Preview
        </Button>
        <Button
          variant="contained"
          onClick={commit}
          disabled={!candidate || candidate.errors.length > 0}
        >
          Create repertoire
        </Button>
      </DialogActions>
    </Dialog>
  );
}
