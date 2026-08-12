import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  AppBar,
  Box,
  Chip,
  Container,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../features/board/ChessboardPreview';
import { RepertoireTreePreview } from '../features/repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../features/task/TaskPreviewCard';
import {
  canSubmitUserMove,
  createTrainingSession,
  currentFixtureStep,
  reduceTrainingSession,
} from '../domain/training/session';
import {
  fix01White,
  phase2TrainingFixtures,
  type TrainingFixture,
  type TrainingMode,
} from '../fixtures/trainingFixtures';

function nowMs() {
  return Date.now();
}

export function App() {
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [fixtureId, setFixtureId] = useState<string>(fix01White.id);
  const [session, setSession] = useState(() =>
    createTrainingSession(fix01White, nowMs()),
  );
  const treeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const fixture: TrainingFixture =
    phase2TrainingFixtures.find((candidate) => candidate.id === fixtureId) ??
    fix01White;
  const currentStep = currentFixtureStep(session, fixture);

  useEffect(() => {
    if (mode !== 'train') return undefined;

    if (session.status === 'opponent-moving') {
      const timer = window.setTimeout(
        () =>
          setSession((current) =>
            reduceTrainingSession(current, fixture, {
              type: 'opponent-tick',
              nowMs: nowMs(),
            }),
          ),
        reducedMotion ? 0 : 260,
      );
      return () => window.clearTimeout(timer);
    }

    if (session.status === 'correct-feedback') {
      const timer = window.setTimeout(
        () =>
          setSession((current) =>
            reduceTrainingSession(current, fixture, {
              type: 'continue',
              nowMs: nowMs(),
            }),
          ),
        420,
      );
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [fixture, mode, reducedMotion, session.status]);

  const handleFixtureChange = (nextFixtureId: string) => {
    const nextFixture = phase2TrainingFixtures.find(
      (candidate) => candidate.id === nextFixtureId,
    );
    if (!nextFixture) return;

    setFixtureId(nextFixture.id);
    setSession(createTrainingSession(nextFixture, nowMs()));
  };

  const handleMove = (command: BoardMoveCommand): boolean => {
    if (mode !== 'train') return false;

    const next = reduceTrainingSession(session, fixture, {
      type: 'user-move',
      move: {
        from: command.from,
        to: command.to,
        ...(command.promotion ? { promotion: command.promotion } : {}),
      },
      nowMs: nowMs(),
    });
    const advanced = next.fen !== session.fen;
    setSession(next);
    return advanced;
  };

  const hintSquares =
    session.hintLevel >= 2 && session.hintLevel < 4 && currentStep?.actor === 'user'
      ? (currentStep.hint?.candidateDestinations ?? [])
      : [];
  const lastMove = session.lastMove
    ? ([session.lastMove.from, session.lastMove.to] as const)
    : undefined;

  const tree = (
    <RepertoireTreePreview
      mode={mode}
      items={fixture.tree}
      revealedItemIds={session.treeRevealedItemIds}
      currentItemId={currentStep?.treeItemId}
    />
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 1 }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>
            Opening Trainer
          </Typography>

          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel id="repertoire-label">Training fixture</InputLabel>
            <Select
              labelId="repertoire-label"
              label="Training fixture"
              value={fixture.id}
              onChange={(event: SelectChangeEvent<string>) =>
                handleFixtureChange(String(event.target.value))
              }
            >
              {phase2TrainingFixtures.map((candidate) => (
                <MenuItem key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            aria-label="Training mode"
            onChange={(_: MouseEvent<HTMLElement>, nextMode: TrainingMode | null) => {
              if (nextMode) setMode(nextMode);
            }}
          >
            <ToggleButton value="train">Train</ToggleButton>
            <ToggleButton value="browse">Browse</ToggleButton>
          </ToggleButtonGroup>

          <Chip size="small" label={`${session.evidence.length} observations`} />
          <Chip
            size="small"
            variant="outlined"
            label={`${session.plyIndex}/${fixture.route.length} plies`}
          />

          <Tooltip title="Open repertoire tree">
            <IconButton
              ref={treeButtonRef}
              color="inherit"
              aria-label="Open repertoire tree"
              onClick={() => setTreeOpen(true)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <AccountTreeOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings placeholder">
            <IconButton color="inherit" aria-label="Settings placeholder">
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ py: { xs: 1.5, md: 3 } }}>
        <Box
          className="training-workspace"
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateAreas: {
              xs: '"board" "task"',
              md: '"tree board" "tree task"',
              lg: '"tree board task"',
            },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(240px, 300px) minmax(0, 1fr)',
              lg: 'minmax(250px, 300px) minmax(420px, 1fr) minmax(300px, 360px)',
            },
            alignItems: 'start',
          }}
        >
          <Box
            sx={{ gridArea: 'tree', display: { xs: 'none', md: 'block' }, minWidth: 0 }}
          >
            {tree}
          </Box>

          <Box sx={{ gridArea: 'board', minWidth: 0 }}>
            <ChessboardPreview
              position={session.fen}
              orientation={fixture.orientation}
              userTurn={mode === 'train' && canSubmitUserMove(session)}
              disabled={mode === 'browse'}
              lastMove={lastMove}
              hintSquares={hintSquares}
              reducedMotion={reducedMotion}
              onMove={handleMove}
            />
          </Box>

          <Box sx={{ gridArea: 'task', minWidth: 0 }}>
            <TaskPreviewCard
              session={session}
              fixture={fixture}
              onHint={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, { type: 'request-hint' }),
                )
              }
              onReveal={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, {
                    type: 'reveal',
                    nowMs: nowMs(),
                  }),
                )
              }
              onContinue={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, {
                    type: 'continue',
                    nowMs: nowMs(),
                  }),
                )
              }
              onRetest={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, {
                    type: 'start-retest',
                    nowMs: nowMs(),
                  }),
                )
              }
              onCompleteSession={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, { type: 'complete-session' }),
                )
              }
              onRestart={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, {
                    type: 'restart',
                    nowMs: nowMs(),
                  }),
                )
              }
              onAbandon={() =>
                setSession((current) =>
                  reduceTrainingSession(current, fixture, { type: 'abandon' }),
                )
              }
            />
          </Box>
        </Box>
      </Container>

      <Drawer
        open={treeOpen}
        onClose={() => setTreeOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: { sx: { width: 'min(88vw, 360px)', p: 1 } },
          transition: { onExited: () => treeButtonRef.current?.focus() },
        }}
      >
        {tree}
      </Drawer>
    </Box>
  );
}
