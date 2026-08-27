import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  AppBar,
  Box,
  Chip,
  Container,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../features/board/ChessboardPreview';
import { DataManagementDialog } from '../features/data/DataManagementDialog';
import { PgnImportDialog } from '../features/import/PgnImportDialog';
import { SessionRecoveryDialog } from '../features/session/SessionRecoveryDialog';
import { RepertoireTreePreview } from '../features/repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../features/task/TaskPreviewCard';
import { canSubmitUserMove, currentFixtureStep } from '../domain/training/session';
import {
  compileTrainingFixture,
  type TrainingExercisePlan,
} from '../domain/training/exercisePlan';
import { createGraphExercisePlan } from '../domain/repertoire/exercisePlan';
import { contextPly } from '../domain/repertoire/graph';
import {
  createGraphTrainingSession,
  reduceGraphTrainingSession,
} from '../domain/repertoire/trainingIntegration';
import type {
  ImportCandidate,
  RepertoireContext,
  RepertoireGraph,
} from '../domain/repertoire/types';
import {
  phase2TrainingFixtures,
  type TrainingMode,
  type TrainingTreeItem,
} from '../fixtures/trainingFixtures';
import { phase3DemoFilteredPlan, phase3DemoPlan } from '../fixtures/phase3Demo';
import {
  OPENING_TRAINER_DATABASE_NAME,
  OpeningTrainerDatabase,
  type SessionRecord,
} from '../infrastructure/db/openingTrainerDatabase';
import { OpeningTrainerRepository } from '../infrastructure/db/openingTrainerRepository';

const phase2Plans = phase2TrainingFixtures.map(compileTrainingFixture);
const defaultPlan = phase2Plans[0]!;
const basePlans: readonly TrainingExercisePlan[] = [...phase2Plans, phase3DemoPlan];

function nowMs() {
  return Date.now();
}

function sessionId(plan: TrainingExercisePlan) {
  return globalThis.crypto?.randomUUID?.() ?? `${plan.id}-${nowMs()}`;
}

function applicationDatabaseName(): string {
  return import.meta.env.MODE === 'test'
    ? `opening-trainer-test-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`
    : OPENING_TRAINER_DATABASE_NAME;
}

function isDescendantOf(
  context: RepertoireContext,
  rootContextId: string,
  contexts: ReadonlyMap<string, RepertoireContext>,
): boolean {
  let current: RepertoireContext | undefined = context;
  const seen = new Set<string>();
  while (current) {
    if (current.id === rootContextId) return true;
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    current = current.parentContextId
      ? contexts.get(current.parentContextId)
      : undefined;
  }
  return false;
}

function importedExercisePlans(graph: RepertoireGraph): TrainingExercisePlan[] {
  const repertoire = graph.repertoires[0];
  if (!repertoire) throw new Error('Imported graph has no repertoire.');
  const contexts = new Map(graph.contexts.map((context) => [context.id, context]));
  const userDecisionIds = new Set(
    graph.moves
      .filter((move) => move.included && move.actor === 'user')
      .map((move) => move.contextId),
  );

  const plans = repertoire.rootContextIds.flatMap((rootContextId, rootIndex) => {
    const root = contexts.get(rootContextId);
    if (!root) return [];
    const targets = graph.contexts
      .filter(
        (context) =>
          context.repertoireId === repertoire.id &&
          userDecisionIds.has(context.id) &&
          isDescendantOf(context, root.id, contexts),
      )
      .sort(
        (a, b) =>
          contextPly(b, contexts) - contextPly(a, contexts) ||
          a.pathFingerprint.localeCompare(b.pathFingerprint) ||
          a.id.localeCompare(b.id),
      );
    const target = targets[0];
    if (!target) return [];
    const plan = createGraphExercisePlan(graph, {
      repertoireId: repertoire.id,
      rootContextId: root.id,
      targetContextId: target.id,
    });
    return [
      {
        ...plan,
        label:
          repertoire.rootContextIds.length > 1
            ? `${repertoire.name} · ${root.label ?? `Line ${rootIndex + 1}`}`
            : repertoire.name,
      },
    ];
  });

  if (plans.length === 0) {
    throw new Error('Imported repertoire contains no trainable user decision.');
  }
  return plans;
}

function persistedPlans(
  graphs: readonly RepertoireGraph[],
): {
  plans: TrainingExercisePlan[];
  repertoireByPlanId: Map<string, string>;
} {
  const plans: TrainingExercisePlan[] = [];
  const repertoireByPlanId = new Map<string, string>();
  for (const graph of graphs) {
    const repertoire = graph.repertoires[0];
    if (!repertoire) continue;
    try {
      const graphPlans = importedExercisePlans(graph);
      graphPlans.forEach((plan) => repertoireByPlanId.set(plan.id, repertoire.id));
      plans.push(...graphPlans);
    } catch {
      // A valid stored repertoire may contain no trainable user decision yet.
    }
  }
  return { plans, repertoireByPlanId };
}

function fullTreeLabels(items: readonly TrainingTreeItem[]): Map<string, string> {
  const labels = new Map<string, string>();
  const visit = (nodes: readonly TrainingTreeItem[]) => {
    for (const item of nodes) {
      labels.set(item.id, item.visibleLabel);
      visit(item.children ?? []);
    }
  };
  visit(items);
  return labels;
}

function revealTrainTreeLabels(
  items: readonly TrainingTreeItem[],
  browseItems: readonly TrainingTreeItem[],
  revealedItemIds: readonly string[],
): readonly TrainingTreeItem[] {
  const labels = fullTreeLabels(browseItems);
  const revealed = new Set(revealedItemIds);
  const visit = (nodes: readonly TrainingTreeItem[]): readonly TrainingTreeItem[] =>
    nodes.map((item) => ({
      ...item,
      visibleLabel: revealed.has(item.id)
        ? (labels.get(item.id) ?? item.visibleLabel)
        : item.visibleLabel,
      ...(item.children ? { children: visit(item.children) } : {}),
    }));
  return visit(items);
}

function hasDurableSessionProgress(session: SessionRecord['state']): boolean {
  return (
    session.plyIndex > 0 ||
    session.evidence.length > 0 ||
    session.hintLevel > 0 ||
    session.retestQueue.length > 0 ||
    session.status === 'session-complete' ||
    session.status === 'abandoned'
  );
}

export function App() {
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [plans, setPlans] = useState<readonly TrainingExercisePlan[]>(basePlans);
  const [selectionId, setSelectionId] = useState(defaultPlan.id);
  const [includeDemoAlternative, setIncludeDemoAlternative] = useState(true);
  const [repertoireByPlanId, setRepertoireByPlanId] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const [recoverySession, setRecoverySession] = useState<SessionRecord | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const selectedPlan =
    plans.find((candidate) => candidate.id === selectionId) ?? defaultPlan;
  const plan =
    selectionId === phase3DemoPlan.id && !includeDemoAlternative
      ? phase3DemoFilteredPlan
      : selectedPlan;
  const [session, setSession] = useState(() =>
    createGraphTrainingSession(defaultPlan, nowMs(), {
      sessionId: sessionId(defaultPlan),
    }),
  );
  const [repository] = useState(
    () =>
      new OpeningTrainerRepository(
        new OpeningTrainerDatabase(applicationDatabaseName()),
      ),
  );
  const treeButtonRef = useRef<HTMLButtonElement>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const currentStep = currentFixtureStep(session, plan);
  const totalPlies = Math.max(1, ...plan.steps.map((step) => step.ply + 1));
  const selectedRepertoireId = repertoireByPlanId.get(plan.id);

  const refreshPersistedPlans = async (activateFirst = false) => {
    const stored = persistedPlans(await repository.listRepertoireGraphs());
    const storedIds = new Set(stored.plans.map((item) => item.id));
    const nextPlans = [
      ...basePlans.filter((item) => !storedIds.has(item.id)),
      ...stored.plans,
    ];
    setPlans(nextPlans);
    setRepertoireByPlanId(stored.repertoireByPlanId);
    if (activateFirst && stored.plans[0]) {
      const first = stored.plans[0];
      setSelectionId(first.id);
      setIncludeDemoAlternative(true);
      setMode('train');
      setSession(
        createGraphTrainingSession(first, nowMs(), {
          sessionId: sessionId(first),
        }),
      );
    }
    return { ...stored, allPlans: nextPlans };
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await repository.initialize();
        const refreshed = await refreshPersistedPlans();
        if (!active) return;
        const requestedPlanId = await repository.getSetting<string>('active-plan-id');
        if (
          requestedPlanId &&
          refreshed.allPlans.some((candidate) => candidate.id === requestedPlanId)
        ) {
          const requestedPlan = refreshed.allPlans.find(
            (candidate) => candidate.id === requestedPlanId,
          )!;
          setSelectionId(requestedPlanId);
          setSession(
            createGraphTrainingSession(requestedPlan, nowMs(), {
              sessionId: sessionId(requestedPlan),
            }),
          );
        }
        const interrupted = await repository.latestInterruptedSession();
        if (
          active &&
          interrupted &&
          refreshed.allPlans.some((candidate) => candidate.id === interrupted.planId)
        ) {
          setRecoverySession(interrupted);
        }
      } catch (error) {
        if (active) {
          setPersistenceError(
            error instanceof Error ? error.message : 'Local data initialization failed.',
          );
        }
      }
    })();

    return () => {
      active = false;
      repository.close();
      if (import.meta.env.MODE === 'test') {
        void repository.deleteDatabase();
      }
    };
    // Repository is intentionally constructed once for the application lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  useEffect(() => {
    if (!repertoireByPlanId.has(session.planId) || !hasDurableSessionProgress(session)) {
      return;
    }
    const snapshot = structuredClone(session);
    persistenceQueueRef.current = persistenceQueueRef.current
      .then(() => repository.saveSession(snapshot))
      .catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : 'Session persistence failed.',
        );
      });
  }, [repository, repertoireByPlanId, session]);

  useEffect(() => {
    if (mode !== 'train') return undefined;
    if (session.status === 'opponent-moving') {
      const timer = window.setTimeout(
        () =>
          setSession((current) =>
            reduceGraphTrainingSession(current, plan, {
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
            reduceGraphTrainingSession(current, plan, {
              type: 'continue',
              nowMs: nowMs(),
            }),
          ),
        420,
      );
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mode, plan, reducedMotion, session.status]);

  const beginPlan = (nextPlan: TrainingExercisePlan) => {
    setSession(
      createGraphTrainingSession(nextPlan, nowMs(), {
        sessionId: sessionId(nextPlan),
      }),
    );
  };

  const handlePlanChange = (nextPlanId: string) => {
    const nextPlan = plans.find((candidate) => candidate.id === nextPlanId);
    if (!nextPlan) return;
    setSelectionId(nextPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    beginPlan(nextPlan);
    if (repertoireByPlanId.has(nextPlan.id)) {
      void repository.putSetting('active-plan-id', nextPlan.id);
    }
  };

  const handleDemoAlternativeChange = (checked: boolean) => {
    setIncludeDemoAlternative(checked);
    setMode('train');
    beginPlan(checked ? phase3DemoPlan : phase3DemoFilteredPlan);
  };

  const handleImportedCandidate = async (candidate: ImportCandidate) => {
    const storedGraph = await repository.createRepertoire(candidate);
    const importedPlans = importedExercisePlans(storedGraph);
    const importedIds = new Set(importedPlans.map((item) => item.id));
    setPlans((current) => [
      ...current.filter((item) => !importedIds.has(item.id)),
      ...importedPlans,
    ]);
    const repertoireId = storedGraph.repertoires[0]!.id;
    setRepertoireByPlanId((current) => {
      const next = new Map(current);
      importedPlans.forEach((item) => next.set(item.id, repertoireId));
      return next;
    });
    const firstPlan = importedPlans[0]!;
    setSelectionId(firstPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    beginPlan(firstPlan);
    await repository.putSetting('active-plan-id', firstPlan.id);
  };

  const handleModeChange = (nextMode: TrainingMode) => {
    if (nextMode === mode) return;
    if (mode === 'train' && nextMode === 'browse') {
      setSession((current) =>
        ['session-complete', 'abandoned'].includes(current.status)
          ? current
          : reduceGraphTrainingSession(current, plan, { type: 'abandon' }),
      );
    }
    setMode(nextMode);
  };

  const handleMove = (command: BoardMoveCommand): boolean => {
    if (mode !== 'train') return false;
    const next = reduceGraphTrainingSession(session, plan, {
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

  const handleInteractionBlockChange = (blocked: boolean) => {
    setSession((current) =>
      reduceGraphTrainingSession(current, plan, {
        type: blocked ? 'pause-attempt' : 'resume-attempt',
        nowMs: nowMs(),
      }),
    );
  };

  const resumeInterruptedSession = () => {
    if (!recoverySession) return;
    const recoveredPlan = plans.find(
      (candidate) => candidate.id === recoverySession.planId,
    );
    if (!recoveredPlan) {
      setPersistenceError('The saved session repertoire is not available.');
      setRecoverySession(null);
      return;
    }
    setSelectionId(recoveredPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    setSession({
      ...structuredClone(recoverySession.state),
      attemptStartedAtMs: nowMs(),
      pausedDurationMs: 0,
      pauseStartedAtMs: undefined,
    });
    setRecoverySession(null);
  };

  const abandonInterruptedSession = () => {
    if (!recoverySession) return;
    const id = recoverySession.id;
    setRecoverySession(null);
    void repository.markSessionAbandoned(id).catch((error: unknown) =>
      setPersistenceError(
        error instanceof Error ? error.message : 'Could not abandon saved session.',
      ),
    );
  };

  const hintSquares =
    session.hintLevel >= 2 && session.hintLevel < 4 && currentStep?.actor === 'user'
      ? (currentStep.hint?.candidateDestinations ?? [])
      : [];
  const lastMove = session.lastMove
    ? ([session.lastMove.from, session.lastMove.to] as const)
    : undefined;
  const displayedTree =
    mode === 'browse'
      ? plan.browseTree
      : revealTrainTreeLabels(plan.tree, plan.browseTree, session.treeRevealedItemIds);
  const tree = (
    <RepertoireTreePreview
      mode={mode}
      items={displayedTree}
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
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel id="repertoire-label">Training fixture</InputLabel>
            <Select
              labelId="repertoire-label"
              label="Training fixture"
              value={selectionId}
              onChange={(event: SelectChangeEvent<string>) =>
                handlePlanChange(String(event.target.value))
              }
            >
              {plans.map((candidate) => (
                <MenuItem key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Chip
            size="small"
            variant="outlined"
            label={selectedRepertoireId ? 'Saved locally' : 'Demo fixture'}
          />
          {selectionId === phase3DemoPlan.id ? (
            <FormControlLabel
              control={
                <Switch
                  checked={includeDemoAlternative}
                  onChange={(_: ChangeEvent<HTMLInputElement>, checked: boolean) =>
                    handleDemoAlternativeChange(checked)
                  }
                  slotProps={{ input: { 'aria-label': 'Include alternative branch' } }}
                />
              }
              label="Include alternative branch"
              sx={{ mx: 0 }}
            />
          ) : null}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            aria-label="Training mode"
            onChange={(_: MouseEvent<HTMLElement>, nextMode: TrainingMode | null) => {
              if (nextMode) handleModeChange(nextMode);
            }}
          >
            <ToggleButton value="train">Train</ToggleButton>
            <ToggleButton value="browse">Browse</ToggleButton>
          </ToggleButtonGroup>
          <Chip size="small" label={`${session.evidence.length} observations`} />
          <Chip
            size="small"
            variant="outlined"
            label={`${session.plyIndex}/${totalPlies} plies`}
          />
          <Tooltip title="Import PGN repertoire">
            <IconButton
              color="inherit"
              aria-label="Import PGN repertoire"
              onClick={() => setImportOpen(true)}
            >
              <UploadFileOutlinedIcon />
            </IconButton>
          </Tooltip>
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
          <Tooltip title="Local data and recovery">
            <IconButton
              color="inherit"
              aria-label="Local data and recovery"
              onClick={() => setDataOpen(true)}
            >
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ py: { xs: 1.5, md: 3 } }}>
        {persistenceError ? (
          <Alert
            severity="error"
            onClose={() => setPersistenceError(null)}
            sx={{ mb: 2 }}
          >
            {persistenceError}
          </Alert>
        ) : null}
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
            sx={{
              gridArea: 'tree',
              display: { xs: 'none', md: 'block' },
              minWidth: 0,
            }}
          >
            {tree}
          </Box>
          <Box sx={{ gridArea: 'board', minWidth: 0 }}>
            <ChessboardPreview
              position={session.fen}
              orientation={plan.orientation}
              userTurn={mode === 'train' && canSubmitUserMove(session)}
              disabled={mode === 'browse'}
              lastMove={lastMove}
              hintSquares={hintSquares}
              reducedMotion={reducedMotion}
              onMove={handleMove}
              onInteractionBlockChange={handleInteractionBlockChange}
            />
          </Box>
          <Box sx={{ gridArea: 'task', minWidth: 0 }}>
            <TaskPreviewCard
              session={session}
              plan={plan}
              onHint={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'request-hint',
                  }),
                )
              }
              onReveal={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'reveal',
                    nowMs: nowMs(),
                  }),
                )
              }
              onContinue={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'continue',
                    nowMs: nowMs(),
                  }),
                )
              }
              onRetest={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'start-retest',
                    nowMs: nowMs(),
                  }),
                )
              }
              onCompleteSession={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'complete-session',
                  }),
                )
              }
              onRestart={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, {
                    type: 'restart',
                    nowMs: nowMs(),
                  }),
                )
              }
              onAbandon={() =>
                setSession((current) =>
                  reduceGraphTrainingSession(current, plan, { type: 'abandon' }),
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
      <PgnImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCommit={handleImportedCandidate}
      />
      <DataManagementDialog
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        repository={repository}
        selectedRepertoireId={selectedRepertoireId}
        onDataChanged={async () => {
          await refreshPersistedPlans(true);
          const interrupted = await repository.latestInterruptedSession();
          setRecoverySession(interrupted ?? null);
        }}
      />
      <SessionRecoveryDialog
        session={recoverySession}
        onResume={resumeInterruptedSession}
        onAbandon={abandonInterruptedSession}
      />
    </Box>
  );
}
