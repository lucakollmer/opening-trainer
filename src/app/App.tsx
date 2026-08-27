import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
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
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../features/board/ChessboardPreview';
import { PgnImportDialog } from '../features/import/PgnImportDialog';
import { RepertoireTreePreview } from '../features/repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../features/task/TaskPreviewCard';
import { canSubmitUserMove, currentFixtureStep } from '../domain/training/session';
import {
  compileTrainingFixture,
  type TrainingExercisePlan,
} from '../domain/training/exercisePlan';
import { createGraphExercisePlan } from '../domain/repertoire/exercisePlan';
import { contextPly } from '../domain/repertoire/graph';
import { InMemoryImportRepository } from '../domain/repertoire/importRepository';
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
import {
  phase3DemoFilteredPlan,
  phase3DemoPlan,
} from '../fixtures/phase3Demo';

const phase2Plans = phase2TrainingFixtures.map(compileTrainingFixture);
const defaultPlan = phase2Plans[0]!;
const basePlans: readonly TrainingExercisePlan[] = [...phase2Plans, phase3DemoPlan];

function nowMs() {
  return Date.now();
}

function sessionId(plan: TrainingExercisePlan) {
  return globalThis.crypto?.randomUUID?.() ?? `${plan.id}-${nowMs()}`;
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
    current = current.parentContextId ? contexts.get(current.parentContextId) : undefined;
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

export function App() {
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [plans, setPlans] = useState<readonly TrainingExercisePlan[]>(basePlans);
  const [selectionId, setSelectionId] = useState(defaultPlan.id);
  const [includeDemoAlternative, setIncludeDemoAlternative] = useState(true);
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
  const treeButtonRef = useRef<HTMLButtonElement>(null);
  const importRepositoryRef = useRef(new InMemoryImportRepository());
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const currentStep = currentFixtureStep(session, plan);
  const totalPlies = Math.max(1, ...plan.steps.map((step) => step.ply + 1));

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
  };

  const handleDemoAlternativeChange = (checked: boolean) => {
    setIncludeDemoAlternative(checked);
    setMode('train');
    beginPlan(checked ? phase3DemoPlan : phase3DemoFilteredPlan);
  };

  const handleImportedCandidate = (candidate: ImportCandidate) => {
    const importedPlans = importedExercisePlans(candidate.proposedGraph);
    importRepositoryRef.current.createRepertoire(candidate);
    const importedIds = new Set(importedPlans.map((item) => item.id));
    setPlans((current) => [
      ...current.filter((item) => !importedIds.has(item.id)),
      ...importedPlans,
    ]);
    const firstPlan = importedPlans[0]!;
    setSelectionId(firstPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    beginPlan(firstPlan);
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

  const hintSquares =
    session.hintLevel >= 2 &&
    session.hintLevel < 4 &&
    currentStep?.actor === 'user'
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
          <Typography
            component="h1"
            variant="h6"
            sx={{ fontWeight: 700, mr: 'auto' }}
          >
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
    </Box>
  );
}
