import {
  Alert,
  Button,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { Phase6OpeningTrainerRepository } from '../../infrastructure/db/phase6Repository';

export type ContextEditorSnapshot = Awaited<
  ReturnType<Phase6OpeningTrainerRepository['getContextEditorSnapshot']>
>;

interface BrowseInspectorProps {
  snapshot: ContextEditorSnapshot;
  busy?: boolean;
  playlistFilter?: 'include' | 'exclude' | 'none';
  onToggleInclusion: (included: boolean) => Promise<void>;
  onSaveContext: (note: string, tags: readonly string[]) => Promise<void>;
  onSaveOpeningName: (
    primaryLabel: string,
    aliases: readonly string[],
  ) => Promise<void>;
  onArchiveOpeningName: () => Promise<void>;
  onSaveMove: (
    moveId: string,
    note: string,
    purpose: string,
  ) => Promise<void>;
  onSetPlaylistFilter?: (
    filter: 'include' | 'exclude' | 'none',
  ) => Promise<void>;
}

export function BrowseInspector({
  snapshot,
  busy = false,
  playlistFilter,
  onToggleInclusion,
  onSaveContext,
  onSaveOpeningName,
  onArchiveOpeningName,
  onSaveMove,
  onSetPlaylistFilter,
}: BrowseInspectorProps) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState('');
  const [primaryLabel, setPrimaryLabel] = useState('');
  const [aliases, setAliases] = useState('');
  const [moveDrafts, setMoveDrafts] = useState<
    Record<string, { note: string; purpose: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote(snapshot.context.note ?? '');
    setTags(snapshot.context.tags.join(', '));
    setPrimaryLabel(snapshot.openingName?.primaryLabel ?? '');
    setAliases(snapshot.openingName?.aliases.join('\n') ?? '');
    setMoveDrafts(
      Object.fromEntries(
        snapshot.moves.map((move) => [
          move.id,
          { note: move.note ?? '', purpose: move.purpose ?? '' },
        ]),
      ),
    );
    setError(null);
  }, [snapshot]);

  const parsedTags = useMemo(
    () => tags.split(',').map((value) => value.trim()).filter(Boolean),
    [tags],
  );
  const parsedAliases = useMemo(
    () => aliases.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean),
    [aliases],
  );

  const run = async (operation: () => Promise<void>) => {
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Management action failed.');
    }
  };

  return (
    <Stack component="aside" spacing={2} aria-label="Selected branch inspector">
      <Stack spacing={0.5}>
        <Typography variant="overline">Selected branch</Typography>
        <Typography variant="h6">{snapshot.breadcrumb}</Typography>
        <FormControlLabel
          control={
            <Switch
              checked={snapshot.context.included}
              disabled={busy}
              onChange={(_: ChangeEvent<HTMLInputElement>, checked: boolean) =>
                void run(() => onToggleInclusion(checked))
              }
            />
          }
          label={snapshot.context.included ? 'Included in training' : 'Excluded from training'}
        />
      </Stack>

      {onSetPlaylistFilter ? (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant={playlistFilter === 'include' ? 'contained' : 'outlined'}
            disabled={busy}
            onClick={() => void run(() => onSetPlaylistFilter('include'))}
          >
            Include subtree
          </Button>
          <Button
            size="small"
            variant={playlistFilter === 'exclude' ? 'contained' : 'outlined'}
            disabled={busy}
            onClick={() => void run(() => onSetPlaylistFilter('exclude'))}
          >
            Exclude subtree
          </Button>
          <Button
            size="small"
            disabled={busy || playlistFilter === 'none'}
            onClick={() => void run(() => onSetPlaylistFilter('none'))}
          >
            Clear playlist filter
          </Button>
        </Stack>
      ) : null}

      <Divider />
      <Typography variant="subtitle2">Context note and tags</Typography>
      <TextField
        label="Context note"
        multiline
        minRows={3}
        value={note}
        disabled={busy}
        onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setNote(event.target.value)
        }
      />
      <TextField
        label="Tags (comma separated)"
        value={tags}
        disabled={busy}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setTags(event.target.value)}
      />
      <Button
        variant="outlined"
        disabled={busy}
        onClick={() => void run(() => onSaveContext(note, parsedTags))}
      >
        Save context metadata
      </Button>

      <Divider />
      <Typography variant="subtitle2">Opening-name recall</Typography>
      <TextField
        label="Primary opening name"
        value={primaryLabel}
        disabled={busy}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          setPrimaryLabel(event.target.value)
        }
      />
      <TextField
        label="Accepted aliases (one per line)"
        multiline
        minRows={2}
        value={aliases}
        disabled={busy}
        onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setAliases(event.target.value)
        }
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          disabled={busy || !primaryLabel.trim()}
          onClick={() =>
            void run(() => onSaveOpeningName(primaryLabel, parsedAliases))
          }
        >
          Save opening name
        </Button>
        {snapshot.openingName ? (
          <Button
            disabled={busy}
            onClick={() => void run(onArchiveOpeningName)}
          >
            Remove name
          </Button>
        ) : null}
      </Stack>

      {snapshot.moves.length > 0 ? (
        <>
          <Divider />
          <Typography variant="subtitle2">Move notes and purposes</Typography>
          {snapshot.moves.map((move) => {
            const draft = moveDrafts[move.id] ?? { note: '', purpose: '' };
            return (
              <Stack key={move.id} spacing={1} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {move.san}
                </Typography>
                <TextField
                  size="small"
                  label="Move note"
                  value={draft.note}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setMoveDrafts((current) => ({
                      ...current,
                      [move.id]: { ...draft, note: event.target.value },
                    }))
                  }
                />
                <TextField
                  size="small"
                  label="Purpose / idea"
                  value={draft.purpose}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setMoveDrafts((current) => ({
                      ...current,
                      [move.id]: { ...draft, purpose: event.target.value },
                    }))
                  }
                />
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void run(() => onSaveMove(move.id, draft.note, draft.purpose))
                  }
                >
                  Save {move.san} annotation
                </Button>
              </Stack>
            );
          })}
        </>
      ) : null}

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
