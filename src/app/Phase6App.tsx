import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import type {
  BrowseWorkspaceSnapshot,
  ManagedPlaylistSummary,
  ManagedRepertoireSummary,
  NamePrompt,
  ContrastPrompt,
  TrainingScope,
} from '../domain/phase6/types';
import type { ImportCandidate } from '../domain/repertoire/types';
import type { SessionRecord } from '../infrastructure/db/openingTrainerDatabase';
import { OPENING_TRAINER_DATABASE_NAME } from '../infrastructure/db/openingTrainerDatabase';
import { Phase6OpeningTrainerDatabase } from '../infrastructure/db/phase6Database';
import {
  Phase6OpeningTrainerRepository,
  type MoveSessionOptions,
} from '../infrastructure/db/phase6Repository';
import { ChessboardPreview } from '../features/board/ChessboardPreview';
import { PgnImportDialog } from '../features/import/PgnImportDialog';
import { BrowseTree } from '../features/phase6/BrowseTree';
import {
  BrowseInspector,
  type ContextEditorSnapshot,
} from '../features/phase6/BrowseInspector';
import { ContrastRecallPanel } from '../features/phase6/ContrastRecallPanel';
import { MoveWorkspace } from '../features/phase6/MoveWorkspace';
import { NameRecallPanel } from '../features/phase6/NameRecallPanel';
import { Phase6DataDialog } from '../features/phase6/Phase6DataDialog';
import { Phase6ManageDialog } from '../features/phase6/Phase6ManageDialog';
import {
  Phase6RecoveryDialog,
  type Phase6RecoveryDescriptor,
} from '../features/phase6/Phase6RecoveryDialog';

const ACTIVE_SCOPE_SETTING = 'phase6.active-scope';
const DEFAULT_TARGET_COUNT = 8;
const DEFAULT_NEW_LIMIT = 3;

type WorkspaceMode = 'browse' | 'move' | 'name' | 'contrast';

export interface Phase6AppProps {
  repository?: Phase6OpeningTrainerRepository;
}

function applicationDatabaseName(): string {
  return import.meta.env.MODE === 'test'
    ? `${OPENING_TRAINER_DATABASE_NAME}-phase6-test-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
    : OPENING_TRAINER_DATABASE_NAME;
}

function scopeValue(scope: TrainingScope): string {
  return `${scope.kind}:${scope.id}`;
}

function parseScope(value: string): TrainingScope | null {
  if (value.startsWith('repertoire:')) {
    return { kind: 'repertoire', id: value.slice('repertoire:'.length) };
  }
  if (value.startsWith('playlist:')) {
    return { kind: 'playlist', id: value.slice('playlist:'.length) };
  }
  return null;
}

function scopeExists(
  scope: TrainingScope | undefined,
  repertoires: readonly ManagedRepertoireSummary[],
  playlists: readonly ManagedPlaylistSummary[],
): scope is TrainingScope {
  if (!scope) return false;
  return scope.kind === 'repertoire'
    ? repertoires.some((row) => row.id === scope.id)
    : playlists.some((row) => row.id === scope.id);
}


function findNode(
  nodes: BrowseWorkspaceSnapshot['tree'],
  contextId: string,
): BrowseWorkspaceSnapshot['tree'][number] | undefined {
  for (const node of nodes) {
    if (node.contextId === contextId) return node;
    const child = findNode(node.children, contextId);
    if (child) return child;
  }
  return undefined;
}

export function Phase6App({ repository: suppliedRepository }: Phase6AppProps = {}) {
  const ownsRepository = suppliedRepository === undefined;
  const [repository] = useState(
    () =>
      suppliedRepository ??
      new Phase6OpeningTrainerRepository(
        new Phase6OpeningTrainerDatabase(applicationDatabaseName()),
      ),
  );
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState<WorkspaceMode>('browse');
  const [repertoires, setRepertoires] = useState<readonly ManagedRepertoireSummary[]>([]);
  const [playlists, setPlaylists] = useState<readonly ManagedPlaylistSummary[]>([]);
  const [scope, setScope] = useState<TrainingScope | null>(null);
  const [browse, setBrowse] = useState<BrowseWorkspaceSnapshot | null>(null);
  const [editor, setEditor] = useState<ContextEditorSnapshot | null>(null);
  const [playlistFilter, setPlaylistFilter] = useState<'include' | 'exclude' | 'none'>('none');
  const [namePrompt, setNamePrompt] = useState<NamePrompt | null>(null);
  const [contrastPrompt, setContrastPrompt] = useState<ContrastPrompt | null>(null);
  const [moveRecovery, setMoveRecovery] = useState<SessionRecord | undefined>(undefined);
  const [recovery, setRecovery] = useState<Phase6RecoveryDescriptor | null>(null);
  const [recoveryMoveRecord, setRecoveryMoveRecord] = useState<SessionRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moveOptions = useMemo<MoveSessionOptions>(
    () => ({
      targetCount: DEFAULT_TARGET_COUNT,
      newItemLimit: DEFAULT_NEW_LIMIT,
      mode: 'normal',
    }),
    [],
  );

  const refreshManaged = async () => {
    const [nextRepertoires, nextPlaylists] = await Promise.all([
      repository.listManagedRepertoires(),
      repository.listManagedPlaylists(),
    ]);
    setRepertoires(nextRepertoires);
    setPlaylists(nextPlaylists);
    return { repertoires: nextRepertoires, playlists: nextPlaylists };
  };

  const refreshEditor = async (
    contextId: string,
    editorScope: TrainingScope | null = scope,
  ) => {
    const next = await repository.getContextEditorSnapshot(contextId);
    setEditor(next);
    if (editorScope?.kind === 'playlist') {
      const playlist = await repository.getPlaylist(editorScope.id);
      setPlaylistFilter(
        playlist.includedContextIds.includes(contextId)
          ? 'include'
          : playlist.excludedContextIds.includes(contextId)
            ? 'exclude'
            : 'none',
      );
    } else {
      setPlaylistFilter('none');
    }
  };

  const refreshBrowse = async (
    nextScope: TrainingScope,
    repertoireId?: string,
    contextId?: string,
  ) => {
    const next = await repository.browseWorkspace(nextScope, {
      ...(repertoireId ? { repertoireId } : {}),
      ...(contextId ? { contextId } : {}),
    });
    setBrowse(next);
    await refreshEditor(next.selectedContextId, nextScope);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      setBooting(true);
      setError(null);
      try {
        await repository.initialize();
        const managed = await refreshManaged();
        if (!active) return;
        const saved = await repository.getSetting<TrainingScope>(ACTIVE_SCOPE_SETTING);
        const initialScope = scopeExists(saved, managed.repertoires, managed.playlists)
          ? saved
          : managed.repertoires[0]
            ? { kind: 'repertoire' as const, id: managed.repertoires[0].id }
            : null;
        if (initialScope) setScope(initialScope);

        const [move, aux] = await Promise.all([
          repository.latestInterruptedMoveSession(),
          repository.latestInterruptedAuxSession(),
        ]);
        if (!active) return;
        const candidates: Array<{
          descriptor: Phase6RecoveryDescriptor;
          move?: SessionRecord;
        }> = [
          ...(move
            ? [
                {
                  descriptor: {
                    kind: 'move' as const,
                    id: move.id,
                    updatedAt: move.updatedAt,
                  },
                  move,
                },
              ]
            : []),
          ...(aux ? [{ descriptor: aux }] : []),
        ].sort((a, b) => b.descriptor.updatedAt.localeCompare(a.descriptor.updatedAt));
        if (candidates[0]) {
          setRecovery(candidates[0].descriptor);
          setRecoveryMoveRecord(candidates[0].move ?? null);
        } else if (initialScope) {
          await refreshBrowse(initialScope);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Opening Trainer initialization failed.');
        }
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
      if (import.meta.env.MODE === 'test' && ownsRepository) {
        void repository.deleteDatabase();
      } else if (ownsRepository) {
        repository.close();
      }
    };
  }, [ownsRepository, repository]);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Opening Trainer action failed.');
    } finally {
      setBusy(false);
    }
  };

  const chooseScope = async (nextScope: TrainingScope) => {
    setScope(nextScope);
    await repository.putSetting(ACTIVE_SCOPE_SETTING, nextScope);
    await refreshBrowse(nextScope);
  };

  const selectBrowseContext = async (contextId: string) => {
    if (!scope || !browse) return;
    await run(async () => {
      await refreshBrowse(scope, browse.repertoireId, contextId);
    });
  };

  const refreshAfterManagement = async () => {
    const managed = await refreshManaged();
    if (!scope) return;
    if (!scopeExists(scope, managed.repertoires, managed.playlists)) {
      const fallback = managed.repertoires[0];
      if (fallback) {
        const nextScope: TrainingScope = { kind: 'repertoire', id: fallback.id };
        setScope(nextScope);
        await refreshBrowse(nextScope);
      } else {
        setBrowse(null);
        setEditor(null);
      }
      return;
    }
    await refreshBrowse(scope, browse?.repertoireId, browse?.selectedContextId);
  };

  const handleImportedCandidate = async (candidate: ImportCandidate) => {
    const graph = await repository.createRepertoire(candidate);
    const repertoire = graph.repertoires[0];
    if (!repertoire) throw new Error('Imported repertoire is missing after commit.');
    await refreshManaged();
    const nextScope: TrainingScope = { kind: 'repertoire', id: repertoire.id };
    setScope(nextScope);
    await repository.putSetting(ACTIVE_SCOPE_SETTING, nextScope);
    await refreshBrowse(nextScope);
  };

  const startName = async () => {
    if (!scope) return;
    await run(async () => {
      const prompt = await repository.startNameSession(scope);
      setNamePrompt(prompt);
      setMode('name');
    });
  };

  const startContrast = async () => {
    if (!scope) return;
    await run(async () => {
      const prompt = await repository.startContrastSession(scope);
      setContrastPrompt(prompt);
      setMode('contrast');
    });
  };

  const exitName = async () => {
    if (namePrompt) await repository.abandonNameSession(namePrompt.sessionId);
    setNamePrompt(null);
    setMode('browse');
    if (scope) await refreshBrowse(scope, browse?.repertoireId, browse?.selectedContextId);
  };

  const exitContrast = async () => {
    if (contrastPrompt) {
      await repository.abandonContrastSession(contrastPrompt.sessionId);
    }
    setContrastPrompt(null);
    setMode('browse');
    if (scope) await refreshBrowse(scope, browse?.repertoireId, browse?.selectedContextId);
  };

  const resumeRecovery = async () => {
    if (!recovery) return;
    if (recovery.kind === 'move') {
      if (!recoveryMoveRecord) throw new Error('Interrupted move session is missing.');
      const recoveredScope = await repository.getMoveSessionScope(recoveryMoveRecord);
      setScope(recoveredScope);
      await repository.putSetting(ACTIVE_SCOPE_SETTING, recoveredScope);
      setMoveRecovery(recoveryMoveRecord);
      setRecovery(null);
      setRecoveryMoveRecord(null);
      setMode('move');
      return;
    }
    const recoveredScope = await repository.getAuxSessionScope(recovery.kind, recovery.id);
    setScope(recoveredScope);
    await repository.putSetting(ACTIVE_SCOPE_SETTING, recoveredScope);
    if (recovery.kind === 'name') {
      setNamePrompt(await repository.resumeNameSession(recovery.id));
      setMode('name');
    } else {
      setContrastPrompt(await repository.resumeContrastSession(recovery.id));
      setMode('contrast');
    }
    setRecovery(null);
  };

  const abandonRecovery = async () => {
    if (!recovery) return;
    if (recovery.kind === 'move') {
      await repository.abandonMoveSession(recovery.id);
    } else if (recovery.kind === 'name') {
      await repository.abandonNameSession(recovery.id);
    } else {
      await repository.abandonContrastSession(recovery.id);
    }
    setRecovery(null);
    setRecoveryMoveRecord(null);
    if (scope) await refreshBrowse(scope);
  };

  const updatePlaylistFilter = async (
    filter: 'include' | 'exclude' | 'none',
  ) => {
    if (!scope || scope.kind !== 'playlist' || !browse) return;
    const playlist = await repository.getPlaylist(scope.id);
    const contextId = browse.selectedContextId;
    const included = playlist.includedContextIds.filter((id) => id !== contextId);
    const excluded = playlist.excludedContextIds.filter((id) => id !== contextId);
    if (filter === 'include') included.push(contextId);
    if (filter === 'exclude') excluded.push(contextId);
    await repository.savePlaylist({
      ...playlist,
      includedContextIds: included,
      excludedContextIds: excluded,
      updatedAt: new Date().toISOString(),
    });
    await refreshBrowse(scope, browse.repertoireId, contextId);
  };

  if (booting) {
    return (
      <Stack alignItems="center" spacing={2} sx={{ py: 10 }}>
        <CircularProgress />
        <Typography>Opening local training workspace...</Typography>
      </Stack>
    );
  }

  if (recovery) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <Typography component="h1" variant="h6">Opening Trainer</Typography>
          </Toolbar>
        </AppBar>
        <Container sx={{ py: 4 }}>
          <Alert severity="info">
            Browse is withheld until the interrupted recall session is resumed or ended.
          </Alert>
          {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
        </Container>
        <Phase6RecoveryDialog
          recovery={recovery}
          onResume={resumeRecovery}
          onAbandon={abandonRecovery}
        />
      </Box>
    );
  }

  if (mode === 'move' && scope) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <Typography component="h1" variant="h6">Opening Trainer</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <MoveWorkspace
            repository={repository}
            scope={scope}
            options={moveOptions}
            recovery={moveRecovery}
            onExit={async () => {
              setMoveRecovery(undefined);
              setMode('browse');
              await refreshBrowse(scope, browse?.repertoireId, browse?.selectedContextId);
            }}
          />
        </Container>
      </Box>
    );
  }

  if (mode === 'name' && namePrompt) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <NameRecallPanel
          prompt={namePrompt}
          busy={busy}
          onReview={(answer, responseTimeMs, reveal) =>
            repository.reviewName(
              namePrompt.sessionId,
              namePrompt.itemIndex,
              answer,
              responseTimeMs,
              { reveal },
            )
          }
          onNext={async () => {
            const next = await repository.nextNamePrompt(namePrompt.sessionId);
            if (!next) await exitName();
            else setNamePrompt(next);
          }}
          onEnd={exitName}
        />
      </Container>
    );
  }

  if (mode === 'contrast' && contrastPrompt) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <ContrastRecallPanel
          prompt={contrastPrompt}
          busy={busy}
          onReview={(playedUci, responseTimeMs, reveal) =>
            repository.reviewContrast(
              contrastPrompt.sessionId,
              contrastPrompt.itemIndex,
              playedUci,
              responseTimeMs,
              { reveal },
            )
          }
          onNext={async () => {
            const next = await repository.nextContrastPrompt(contrastPrompt.sessionId);
            if (!next) await exitContrast();
            else setContrastPrompt(next);
          }}
          onEnd={exitContrast}
        />
      </Container>
    );
  }

  const selectedRepertoire = browse
    ? repertoires.find((row) => row.id === browse.repertoireId)
    : undefined;
  const selectedNode = browse
    ? findNode(browse.tree, browse.selectedContextId)
    : undefined;
  const scopePlaylist = scope?.kind === 'playlist'
    ? playlists.find((row) => row.id === scope.id)
    : undefined;
  const playlistBrowseRepertoires = scopePlaylist
    ? [
        ...scopePlaylist.availableRepertoireIds,
        ...scopePlaylist.unavailableRepertoireIds,
      ]
    : [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 1 }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>
            Opening Trainer
          </Typography>
          {scope ? (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="phase6-scope-label">Training scope</InputLabel>
              <Select
                labelId="phase6-scope-label"
                label="Training scope"
                value={scopeValue(scope)}
                disabled={busy}
                onChange={(event: SelectChangeEvent<string>) => {
                  const next = parseScope(String(event.target.value));
                  if (next) void run(() => chooseScope(next));
                }}
              >
                {repertoires.map((repertoire) => (
                  <MenuItem key={`repertoire:${repertoire.id}`} value={`repertoire:${repertoire.id}`}>
                    {repertoire.name}{repertoire.archived ? ' (archived)' : ''}
                  </MenuItem>
                ))}
                {playlists.map((playlist) => (
                  <MenuItem key={`playlist:${playlist.id}`} value={`playlist:${playlist.id}`}>
                    Playlist: {playlist.name} ({playlist.availability})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          {browse ? (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Chip size="small" label={`${browse.queue.due} due`} />
              <Chip size="small" label={`${browse.queue.new} new`} />
              <Chip size="small" label={`${browse.queue.contrast} contrast`} />
              <Chip
                size="small"
                label={`${browse.queue.namesDue + browse.queue.namesNew} names`}
              />
            </Stack>
          ) : null}
          <Button
            color="inherit"
            disabled={busy || !scope || !browse || browse.queue.due + browse.queue.new === 0}
            onClick={() => {
              setMoveRecovery(undefined);
              setMode('move');
            }}
          >
            Move recall
          </Button>
          <Button
            color="inherit"
            disabled={busy || !scope || !browse || browse.queue.namesDue + browse.queue.namesNew === 0}
            onClick={() => void startName()}
          >
            Name recall
          </Button>
          <Button
            color="inherit"
            disabled={busy || !scope || !browse || browse.queue.contrast === 0}
            onClick={() => void startContrast()}
          >
            Contrast
          </Button>
          <Button color="inherit" disabled={busy} onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button color="inherit" disabled={busy} onClick={() => setManageOpen(true)}>
            Manage
          </Button>
          <Button color="inherit" disabled={busy} onClick={() => setDataOpen(true)}>
            Data
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {!scope || repertoires.length === 0 ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
            <Typography variant="h5">No repertoire is stored locally.</Typography>
            <Button variant="contained" onClick={() => setImportOpen(true)}>
              Import PGN repertoire
            </Button>
          </Stack>
        ) : browse && editor ? (
          <Stack spacing={2}>
            {scope.kind === 'playlist' && playlistBrowseRepertoires.length > 1 ? (
              <FormControl size="small" sx={{ maxWidth: 360 }}>
                <InputLabel id="browse-repertoire-label">Browse repertoire</InputLabel>
                <Select
                  labelId="browse-repertoire-label"
                  label="Browse repertoire"
                  value={browse.repertoireId}
                  disabled={busy}
                  onChange={(event: SelectChangeEvent<string>) =>
                    void run(() => refreshBrowse(scope, String(event.target.value)))
                  }
                >
                  {playlistBrowseRepertoires.map((id) => {
                    const repertoire = repertoires.find((row) => row.id === id);
                    return (
                      <MenuItem key={id} value={id}>
                        {repertoire?.name ?? id}{repertoire?.archived ? ' (archived)' : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            ) : null}

            {selectedRepertoire?.archived ? (
              <Alert severity="info">
                This repertoire is archived. Browse and history remain available, but it
                is excluded from recall queues until restored.
              </Alert>
            ) : null}
            {scopePlaylist?.availability === 'partially-unavailable' ? (
              <Alert severity="warning">
                This playlist has archived or missing members. Available repertoires can
                still train; membership is retained for later restoration.
              </Alert>
            ) : null}

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(260px, 0.8fr) minmax(360px, 1.25fr) minmax(300px, 0.9fr)',
                },
                alignItems: 'start',
              }}
            >
              <Paper variant="outlined" sx={{ p: 1, maxHeight: { lg: '78vh' }, overflow: 'auto' }}>
                <BrowseTree
                  nodes={browse.tree}
                  selectedContextId={browse.selectedContextId}
                  onSelect={(contextId) => void selectBrowseContext(contextId)}
                />
              </Paper>
              <Stack spacing={1.5}>
                <ChessboardPreview
                  position={browse.selectedFen}
                  orientation={browse.selectedOrientation}
                  userTurn={false}
                  disabled
                  onMove={() => false}
                />
                {selectedNode ? (
                  <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`${selectedNode.progress.due} due below`} size="small" />
                    <Chip label={`${selectedNode.progress.weak} weak below`} size="small" />
                    <Chip label={`${selectedNode.progress.neverTrained} never trained`} size="small" />
                    <Chip label={`${selectedNode.progress.mature} mature`} size="small" />
                  </Stack>
                ) : null}
              </Stack>
              <BrowseInspector
                snapshot={editor}
                busy={busy}
                playlistFilter={playlistFilter}
                onToggleInclusion={async (included) => {
                  const impact = await repository.previewBranchInclusion(
                    editor.context.id,
                    included,
                  );
                  if (impact.blockedReason) throw new Error(impact.blockedReason);
                  const approved = globalThis.confirm(
                    `${impact.title}\n\n${impact.details.join('\n')}`,
                  );
                  if (!approved) return;
                  await repository.updateBranchInclusion(editor.context.id, included);
                  await refreshBrowse(scope, browse.repertoireId, editor.context.id);
                }}
                onSaveContext={async (note, tags) => {
                  await repository.updateContextMetadata(editor.context.id, { note, tags });
                  await refreshBrowse(scope, browse.repertoireId, editor.context.id);
                }}
                onSaveOpeningName={async (primaryLabel, aliases) => {
                  const impact = await repository.previewOpeningNameChange(
                    editor.context.id,
                    primaryLabel,
                    aliases,
                  );
                  if (impact.blockedReason) throw new Error(impact.blockedReason);
                  const approved = globalThis.confirm(
                    `${impact.title}\n\n${impact.details.join('\n')}`,
                  );
                  if (!approved) return;
                  await repository.saveOpeningName(
                    editor.context.id,
                    primaryLabel,
                    aliases,
                  );
                  await refreshBrowse(scope, browse.repertoireId, editor.context.id);
                }}
                onArchiveOpeningName={async () => {
                  await repository.archiveOpeningName(editor.context.id);
                  await refreshBrowse(scope, browse.repertoireId, editor.context.id);
                }}
                onSaveMove={async (moveId, note, purpose) => {
                  await repository.updateMoveMetadata(moveId, { note, purpose });
                  await refreshEditor(editor.context.id);
                }}
                {...(scope.kind === 'playlist'
                  ? { onSetPlaylistFilter: updatePlaylistFilter }
                  : {})}
              />
            </Box>

            <Stack spacing={1} component="section" aria-labelledby="confusions-heading">
              <Typography id="confusions-heading" variant="h6">
                Recent confusions
              </Typography>
              {browse.confusions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No recent sibling confusions are recorded in this scope.
                </Typography>
              ) : (
                browse.confusions.map((confusion) => (
                  <Paper key={confusion.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="body2">
                      {confusion.legacyAmbiguous
                        ? 'Legacy expected context is ambiguous'
                        : confusion.expectedLabel}{' '}
                      - confused with {confusion.confusedLabel ?? confusion.confusedContextId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {confusion.countInWindow} in the last 30 days - last{' '}
                      {new Date(confusion.lastObservedAt).toLocaleString()}
                      {confusion.contrastDue ? ' - contrast due' : ''}
                    </Typography>
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        ) : (
          <CircularProgress />
        )}
      </Container>

      <PgnImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCommit={handleImportedCandidate}
      />
      <Phase6ManageDialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        repository={repository}
        repertoires={repertoires}
        playlists={playlists}
        onChanged={refreshAfterManagement}
        onImport={() => {
          setManageOpen(false);
          setImportOpen(true);
        }}
      />
      <Phase6DataDialog
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        repository={repository}
        repertoires={repertoires}
        onRestored={async () => {
          setDataOpen(false);
          const managed = await refreshManaged();
          const nextScope = managed.repertoires[0]
            ? { kind: 'repertoire' as const, id: managed.repertoires[0].id }
            : null;
          setScope(nextScope);
          if (nextScope) await refreshBrowse(nextScope);
          else {
            setBrowse(null);
            setEditor(null);
          }
        }}
      />
    </Box>
  );
}
