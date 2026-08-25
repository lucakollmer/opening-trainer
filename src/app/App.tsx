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
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
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
  currentExerciseStep,
  reduceTrainingSession,
  type TrainingTimeInput,
} from '../domain/training/session';
import { compileTrainingFixture } from '../domain/training/exercisePlan';
import { projectTrainingTree } from '../domain/training/treeProjection';
import {
  fix01White,
  phase2TrainingFixtures,
  type TrainingFixture,
  type TrainingMode,
} from '../fixtures/trainingFixtures';

function nowSample(): TrainingTimeInput {
  return {
    wallMs: Date.now(),
    monotonicMs: globalThis.performance?.now?.() ?? Date.now(),
  };
}

function newSessionId(sourceId: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `session-${uuid}` : `session-${sourceId}-${Date.now()}`;
}

export function App() {
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [fixtureId, setFixtureId] = useState<string>(fix01White.id);
  const [session, setSession] = useState(() => {
    const plan = compileTrainingFixture(fix01White);
    return createTrainingSession(plan, nowSample(), {
      sessionId: newSessionId(plan.sourceId),
    });
  });
  const treeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const fixture: TrainingFixture =
    phase2TrainingFixtures.find((candidate) => candidate.id === fixtureId) ??
    fix01White;
  const plan = useMemo(() => compileTrainingFixture(fixture), [fixture]);
  const currentStep = currentExerciseStep(session, plan);

  useEffect(() => {
    if (mode !== 'train') return undefined;
    if (session.status === 'opponent-moving') {
      const timer = window.setTimeout(
        () =>
          setSession((current) =>
            reduceTrainingSession(current, plan, {
              type: 'opponent-tick',
              nowMs: nowSample(),
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
            reduceTrainingSession(current, plan, {
              type: 'continue',
              nowMs: nowSample(),
            }),
          ),
        420,
      );
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mode, plan, reducedMotion, session.status]);

  const handleFixtureChange = (nextFixtureId: string) => {
    const nextFixture = phase2TrainingFixtures.find(
      (candidate) => candidate.id === nextFixtureId,
    );
    if (!nextFixture) return;
    const nextPlan = compileTrainingFixture(nextFixture);
    setFixtureId(nextFixture.id);
    setSession(
      createTrainingSession(nextPlan, nowSample(), {
        sessionId: newSessionId(nextPlan.sourceId),
      }),
    );
  };

  const handleMove = (command: BoardMoveCommand): boolean => {
    if (mode !== 'train') return false;
    const next = reduceTrainingSession(session, plan, {
      type: 'user-move',
      move: {
        from: command.from,
        to: command.to,
        ...(command.promotion ? { promotion: command.promotion } : {}),
      },
      nowMs: nowSample(),
    });
    const advanced = next.fen !== session.fen;
    setSession(next);
    return advanced;
  };

  const hintSquares =
    session.hintLevel >= 2 &&
    session.hintLevel < 4 &&
    currentStep?.actor === 'user'
      ? (currentStep.hint?.candidateDestinations ?? [])
      : [];
  const lastMove = session.lastMove
    ? ([session.lastMove.from, session.lastMove.to] as const)
    : undefined;
  const projectedTree = projectTrainingTree(
    plan.tree,
    mode,
    session.treeRevealedItemIds,
    currentStep?.treeItemId,
  );
  const tree = <RepertoireTreePreview mode={mode} items={projectedTree} />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 1 }}>
          <Typography
            component="h1"
            variant="h6"
            sx={{ fontWeight: 700, mr: 'auto' }}
          >
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
            label={`${session.plyIndex}/${plan.totalPlies} plies`}
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
              plan={plan}
              onHint={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, { type: 'request-hint' }),
                )
              }
              onReveal={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, {
                    type: 'reveal',
                    nowMs: nowSample(),
                  }),
                )
              }
              onContinue={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, {
                    type: 'continue',
                    nowMs: nowSample(),
                  }),
                )
              }
              onRetest={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, {
                    type: 'start-retest',
                    nowMs: nowSample(),
                  }),
                )
              }
              onCompleteSession={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, { type: 'complete-session' }),
                )
              }
              onRestart={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, {
                    type: 'restart',
                    nowMs: nowSample(),
                    sessionId: newSessionId(plan.sourceId),
                  }),
                )
              }
              onAbandon={() =>
                setSession((current) =>
                  reduceTrainingSession(current, plan, { type: 'abandon' }),
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
