import {
  Alert,
  Button,
  Chip,
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
import { useEffect, useState, type ChangeEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { Playlist } from '../../domain/repertoire/types';
import type {
  ManagedPlaylistSummary,
  ManagedRepertoireSummary,
} from '../../domain/phase6/types';
import type { Phase6OpeningTrainerRepository } from '../../infrastructure/db/phase6Repository';

interface Phase6ManageDialogProps {
  open: boolean;
  onClose: () => void;
  repository: Phase6OpeningTrainerRepository;
  repertoires: readonly ManagedRepertoireSummary[];
  playlists: readonly ManagedPlaylistSummary[];
  onChanged: () => Promise<void>;
  onImport: () => void;
}

function newPlaylist(): Playlist {
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `playlist-${Date.now()}`,
    name: 'New playlist',
    repertoireIds: [],
    includedContextIds: [],
    excludedContextIds: [],
    tags: [],
    weighting: { kind: 'due-first' },
    createdAt: now,
    updatedAt: now,
  };
}

export function Phase6ManageDialog({
  open,
  onClose,
  repository,
  repertoires,
  playlists,
  onChanged,
  onImport,
}: Phase6ManageDialogProps) {
  const [selectedRepertoireId, setSelectedRepertoireId] = useState('');
  const [repertoireName, setRepertoireName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [playlistDraft, setPlaylistDraft] = useState<Playlist | null>(null);
  const [importHistory, setImportHistory] = useState<
    Awaited<ReturnType<Phase6OpeningTrainerRepository['listImportHistory']>>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void repository
      .listImportHistory()
      .then(setImportHistory)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load import history.'),
      );
  }, [open, repository]);

  useEffect(() => {
    const repertoire = repertoires.find((row) => row.id === selectedRepertoireId);
    setRepertoireName(repertoire?.name ?? '');
  }, [repertoires, selectedRepertoireId]);

  useEffect(() => {
    if (!selectedPlaylistId) {
      setPlaylistDraft(null);
      return;
    }
    void repository
      .getPlaylist(selectedPlaylistId)
      .then(setPlaylistDraft)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load playlist.'),
      );
  }, [repository, selectedPlaylistId]);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
      await onChanged();
      setImportHistory(await repository.listImportHistory());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Management action failed.');
    } finally {
      setBusy(false);
    }
  };

  const selectedRepertoire = repertoires.find(
    (row) => row.id === selectedRepertoireId,
  );
  const selectedPlaylist = playlists.find((row) => row.id === selectedPlaylistId);

  const savePlaylist = async () => {
    if (!playlistDraft) return;
    await run(() => repository.savePlaylist(playlistDraft));
  };

  const archiveSelectedRepertoire = async () => {
    if (!selectedRepertoire) return;
    if (selectedRepertoire.archived) {
      await run(() => repository.archiveRepertoire(selectedRepertoire.id, false));
      return;
    }
    const impact = await repository.previewRepertoireArchive(selectedRepertoire.id);
    if (impact.blockedReason) throw new Error(impact.blockedReason);
    const accepted = globalThis.confirm(
      `${impact.title}\n\n${impact.details.join('\n')}`,
    );
    if (!accepted) return;
    await run(() => repository.archiveRepertoire(selectedRepertoire.id, true));
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Manage repertoires and playlists</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Stack spacing={1.5}>
            <Typography variant="h6">Repertoires</Typography>
            <FormControl size="small">
              <InputLabel id="manage-repertoire-label">Repertoire</InputLabel>
              <Select
                labelId="manage-repertoire-label"
                label="Repertoire"
                value={selectedRepertoireId}
                onChange={(event: SelectChangeEvent<string>) =>
                  setSelectedRepertoireId(String(event.target.value))
                }
              >
                {repertoires.map((repertoire) => (
                  <MenuItem key={repertoire.id} value={repertoire.id}>
                    {repertoire.name}{repertoire.archived ? ' (archived)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedRepertoire ? (
              <>
                <TextField
                  label="Repertoire name"
                  value={repertoireName}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setRepertoireName(event.target.value)
                  }
                />
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    disabled={busy || !repertoireName.trim()}
                    onClick={() =>
                      void run(() =>
                        repository.renameRepertoire(
                          selectedRepertoire.id,
                          repertoireName,
                        ),
                      )
                    }
                  >
                    Rename
                  </Button>
                  <Button
                    color={selectedRepertoire.archived ? 'primary' : 'warning'}
                    disabled={busy}
                    onClick={() => {
                      void archiveSelectedRepertoire().catch((cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : 'Could not change repertoire archive state.',
                        ),
                      );
                    }}
                  >
                    {selectedRepertoire.archived ? 'Restore repertoire' : 'Archive repertoire'}
                  </Button>
                </Stack>
              </>
            ) : null}
            <Button variant="contained" disabled={busy} onClick={onImport}>
              Import new repertoire
            </Button>
          </Stack>

          <Stack spacing={1.5}>
            <Typography variant="h6">Playlists</Typography>
            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel id="manage-playlist-label">Playlist</InputLabel>
                <Select
                  labelId="manage-playlist-label"
                  label="Playlist"
                  value={selectedPlaylistId}
                  onChange={(event: SelectChangeEvent<string>) =>
                    setSelectedPlaylistId(String(event.target.value))
                  }
                >
                  {playlists.map((playlist) => (
                    <MenuItem key={playlist.id} value={playlist.id}>
                      {playlist.name} ({playlist.availability})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                disabled={busy}
                onClick={() => {
                  const draft = newPlaylist();
                  setSelectedPlaylistId('');
                  setPlaylistDraft(draft);
                }}
              >
                New
              </Button>
            </Stack>
            {playlistDraft ? (
              <>
                <TextField
                  label="Playlist name"
                  value={playlistDraft.name}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setPlaylistDraft({ ...playlistDraft, name: event.target.value })
                  }
                />
                <FormControl size="small">
                  <InputLabel id="playlist-repertoires-label">Repertoires</InputLabel>
                  <Select
                    labelId="playlist-repertoires-label"
                    multiple
                    label="Repertoires"
                    value={[...playlistDraft.repertoireIds]}
                    disabled={busy}
                    onChange={(event: SelectChangeEvent<string[]>) => {
                      const value = event.target.value as string | string[];
                      setPlaylistDraft({
                        ...playlistDraft,
                        repertoireIds:
                          typeof value === 'string' ? value.split(',') : value,
                      });
                    }}
                    renderValue={(selected: string[]) => (
                      <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {selected.map((id: string) => (
                          <Chip
                            size="small"
                            key={id}
                            label={repertoires.find((row) => row.id === id)?.name ?? id}
                          />
                        ))}
                      </Stack>
                    )}
                  >
                    {repertoires.map((repertoire) => (
                      <MenuItem key={repertoire.id} value={repertoire.id}>
                        {repertoire.name}{repertoire.archived ? ' (archived)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <InputLabel id="playlist-colour-label">Colour filter</InputLabel>
                  <Select
                    labelId="playlist-colour-label"
                    label="Colour filter"
                    value={playlistDraft.colour ?? ''}
                    disabled={busy}
                    onChange={(event: SelectChangeEvent<string>) => {
                      const value = String(event.target.value);
                      setPlaylistDraft({
                        ...playlistDraft,
                        ...(value === 'white' || value === 'black'
                          ? { colour: value }
                          : { colour: undefined }),
                      });
                    }}
                  >
                    <MenuItem value="">Any colour</MenuItem>
                    <MenuItem value="white">White</MenuItem>
                    <MenuItem value="black">Black</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Maximum ply (blank for none)"
                  type="number"
                  value={playlistDraft.maxPly ?? ''}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    setPlaylistDraft({
                      ...playlistDraft,
                      ...(value === ''
                        ? { maxPly: undefined }
                        : { maxPly: Number(value) }),
                    });
                  }}
                />
                <TextField
                  label="Required tags (comma separated)"
                  value={playlistDraft.tags.join(', ')}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setPlaylistDraft({
                      ...playlistDraft,
                      tags: event.target.value
                        .split(',')
                        .map((value: string) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <FormControl size="small">
                  <InputLabel id="playlist-weighting-label">Weighting</InputLabel>
                  <Select
                    labelId="playlist-weighting-label"
                    label="Weighting"
                    value={playlistDraft.weighting.kind}
                    disabled={busy}
                    onChange={(event: SelectChangeEvent<string>) =>
                      setPlaylistDraft({
                        ...playlistDraft,
                        weighting: {
                          kind:
                            event.target.value === 'balanced'
                              ? 'balanced'
                              : 'due-first',
                        },
                      })
                    }
                  >
                    <MenuItem value="due-first">Due first</MenuItem>
                    <MenuItem value="balanced">Balanced within scheduler class</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  Branch include/exclude filters are edited directly from the Browse
                  inspector so the affected position is visible on the board.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    disabled={busy || playlistDraft.repertoireIds.length === 0}
                    onClick={() => void savePlaylist()}
                  >
                    Save playlist
                  </Button>
                  {selectedPlaylist ? (
                    <Button
                      color={selectedPlaylist.archived ? 'primary' : 'warning'}
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          repository.archivePlaylist(
                            selectedPlaylist.id,
                            !selectedPlaylist.archived,
                          ),
                        )
                      }
                    >
                      {selectedPlaylist.archived ? 'Restore playlist' : 'Archive playlist'}
                    </Button>
                  ) : null}
                </Stack>
              </>
            ) : null}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="h6">Import history</Typography>
            {importHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No imports have been recorded yet.
              </Typography>
            ) : (
              importHistory.slice(0, 20).map((entry) => (
                <Stack key={entry.id} spacing={0.25} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="body2">
                    {entry.source.label} - {new Date(entry.importedAt).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry.summary.games} games, {entry.summary.moves} moves,{' '}
                    {entry.warnings.length} warnings
                  </Typography>
                  {entry.warnings.map((warning, index) => (
                    <Typography key={`${warning.code}-${index}`} variant="caption" color="warning.main">
                      {warning.message}
                    </Typography>
                  ))}
                </Stack>
              ))
            )}
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
