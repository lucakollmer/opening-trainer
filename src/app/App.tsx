import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  AppBar,
  Box,
  Button,
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
import {
  canSubmitUserMove,
  currentFixtureStep,
  readyRetestCount,
} from '../domain/training/session';
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
  adaptiveSessionSummary,
  advanceAdaptiveTrainingSession,
  deferAdaptiveRetests,
  createAdaptiveTrainingSession,
  hasNextAdaptiveExercise,
  type AdaptiveExercisePlan,
} from '../domain/scheduling/adaptiveSession';
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
const DEFAULT_TARGET_COUNT = 8;
const DEFAULT_NEW_ITEM_LIMIT = 3;
const DEFAULT_OPPONENT_DELAY_MS = 300;
type ScheduledPromptMode = 'guided' | 'normal' | 'strict' | 'contrast';
const DEFAULT_PROMPT_MODE: ScheduledPromptMode = 'normal';

interface StoredRepertoireSummary {
  id: string;
  name: string;
  trainable: boolean;
}

function monotonicNowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function wallNowIso() {
  return new Date().toISOString();
}

function isScheduledPromptMode(value: unknown): value is ScheduledPromptMode {
  return ['guided', 'normal', 'strict', 'contrast'].includes(String(value));
}

function sessionId(plan: TrainingExercisePlan) {
  return globalThis.crypto?.randomUUID?.() ?? `${plan.id}-${Date.now()}`;
}

function adaptiveSessionId(repertoireId: string) {
  return globalThis.crypto?.randomUUID?.() ?? `adaptive-${repertoireId}-${Date.now()}`;
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

  return repertoire.rootContextIds.flatMap((rootContextId, rootIndex) => {
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
}

function persistedPlans(graphs: readonly RepertoireGraph[]): {
  plans: TrainingExercisePlan[];
  repertoireByPlanId: Map<string, string>;
  repertoires: StoredRepertoireSummary[];
} {
  const plans: TrainingExercisePlan[] = [];
  const repertoireByPlanId = new Map<string, string>();
  const repertoires: StoredRepertoireSummary[] = [];
  for (const graph of graphs) {
    const repertoire = graph.repertoires[0];
    if (!repertoire) continue;
    const graphPlans = importedExercisePlans(graph);
    graphPlans.forEach((plan) => repertoireByPlanId.set(plan.id, repertoire.id));
    plans.push(...graphPlans);
    repertoires.push({
      id: repertoire.id,
      name: repertoire.name,
      trainable: graphPlans.length > 0,
    });
  }
  return { plans, repertoireByPlanId, repertoires };
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

export interface AppProps {
  initialDemoFixtures?: boolean;
  repository?: OpeningTrainerRepository;
}

export function App({
  initialDemoFixtures = import.meta.env.MODE === 'test',
  repository: suppliedRepository,
}: AppProps = {}) {
  const ownsRepository = suppliedRepository === undefined;
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [bootReady, setBootReady] = useState(initialDemoFixtures);
  const [plans, setPlans] = useState<readonly TrainingExercisePlan[]>(() =>
    initialDemoFixtures ? basePlans : [],
  );
  const [selectionId, setSelectionId] = useState(
    initialDemoFixtures ? defaultPlan.id : '',
  );
  const [storedRepertoires, setStoredRepertoires] = useState<
    readonly StoredRepertoireSummary[]
  >([]);
  const [includeDemoAlternative, setIncludeDemoAlternative] = useState(true);
  const [repertoireByPlanId, setRepertoireByPlanId] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  const [adaptiveExercises, setAdaptiveExercises] = useState<
    readonly AdaptiveExercisePlan[]
  >([]);
  const [adaptiveExerciseIndex, setAdaptiveExerciseIndex] = useState(0);
  const [targetCount, setTargetCount] = useState(DEFAULT_TARGET_COUNT);
  const [newItemLimit, setNewItemLimit] = useState(DEFAULT_NEW_ITEM_LIMIT);
  const [opponentDelayMs, setOpponentDelayMs] = useState(DEFAULT_OPPONENT_DELAY_MS);
  const [sessionPromptMode, setSessionPromptMode] =
    useState<ScheduledPromptMode>(DEFAULT_PROMPT_MODE);
  const [queueSummary, setQueueSummary] = useState({ due: 0, new: 0, contrast: 0 });
  const [recoverySession, setRecoverySession] = useState<SessionRecord | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const hasWorkspace = plans.length > 0;
  const hasSavedRepertoires = storedRepertoires.length > 0;
  const selectedPlan =
    plans.find((candidate) => candidate.id === selectionId) ?? defaultPlan;
  const directPlan =
    selectionId === phase3DemoPlan.id && !includeDemoAlternative
      ? phase3DemoFilteredPlan
      : selectedPlan;
  const activeAdaptiveExercise = adaptiveExercises[adaptiveExerciseIndex];
  const plan = activeAdaptiveExercise?.plan ?? directPlan;
  const [session, setSession] = useState(() =>
    createGraphTrainingSession(defaultPlan, monotonicNowMs(), {
      sessionId: sessionId(defaultPlan),
    }),
  );
  const [repository] = useState(
    () =>
      suppliedRepository ??
      new OpeningTrainerRepository(
        new OpeningTrainerDatabase(applicationDatabaseName()),
      ),
  );
  const treeButtonRef = useRef<HTMLButtonElement>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const currentStep = currentFixtureStep(session, plan);
  const totalPlies = Math.max(1, ...plan.steps.map((step) => step.ply + 1));
  const adaptiveRepertoireId =
    session.adaptive?.exercises[session.adaptive.exerciseIndex]?.repertoireId;
  const selectedRepertoireId =
    adaptiveRepertoireId ??
    repertoireByPlanId.get(plan.id) ??
    repertoireByPlanId.get(selectionId) ??
    storedRepertoires[0]?.id;

  const refreshPersistedPlans = async (activateFirst = false) => {
    const stored = persistedPlans(await repository.listRepertoireGraphs());
    const storedIds = new Set(stored.plans.map((item) => item.id));
    const bundledPlans = initialDemoFixtures ? basePlans : [];
    const nextPlans = [
      ...bundledPlans.filter((item) => !storedIds.has(item.id)),
      ...stored.plans,
    ];
    setPlans(nextPlans);
    setStoredRepertoires(stored.repertoires);
    setRepertoireByPlanId(stored.repertoireByPlanId);
    if (activateFirst && stored.plans[0]) {
      const first = stored.plans[0];
      setSelectionId(first.id);
      setIncludeDemoAlternative(true);
      setMode('train');
      setAdaptiveExercises([]);
      setAdaptiveExerciseIndex(0);
      setSession(
        createGraphTrainingSession(first, monotonicNowMs(), {
          sessionId: sessionId(first),
        }),
      );
    } else if (activateFirst && stored.plans.length === 0) {
      setSelectionId('');
      setAdaptiveExercises([]);
    }
    return { ...stored, allPlans: nextPlans };
  };

  const startScheduledSession = async (
    repertoireId: string,
    options: {
      seed?: string;
      target?: number;
      newLimit?: number;
      promptMode?: ScheduledPromptMode;
    } = {},
  ) => {
    const requestedTargetCount = options.target ?? targetCount;
    const requestedNewLimit = options.newLimit ?? newItemLimit;
    const requestedPromptMode = options.promptMode ?? sessionPromptMode;
    const sessionPlan = await repository.createAdaptiveSessionPlan(repertoireId, {
      targetCount: requestedTargetCount,
      newItemLimit: requestedNewLimit,
      mode: requestedPromptMode,
      seed: options.seed ?? `ui-${wallNowIso()}`,
    });
    setQueueSummary(await repository.getTrainingQueueSummary(repertoireId));
    if (sessionPlan.exercises.length === 0) {
      setPersistenceError(
        'No due or new decisions are currently eligible for this scheduled session.',
      );
      return;
    }
    const created = createAdaptiveTrainingSession(
      sessionPlan,
      monotonicNowMs(),
      adaptiveSessionId(repertoireId),
    );
    setAdaptiveExercises(sessionPlan.exercises);
    setAdaptiveExerciseIndex(0);
    setSession(created.state);
    setMode('train');
    setSessionPromptMode(requestedPromptMode);
    await Promise.all([
      repository.putSetting('session-target-count', requestedTargetCount),
      repository.putSetting('new-item-limit', requestedNewLimit),
      repository.putSetting('session-prompt-mode', requestedPromptMode),
    ]);
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await repository.initialize();
        const refreshed = await refreshPersistedPlans();
        if (!active) return;
        const [
          requestedPlanId,
          savedTargetCount,
          savedNewLimit,
          savedPromptMode,
          savedOpponentDelayMs,
        ] = await Promise.all([
          repository.getSetting<string>('active-plan-id'),
          repository.getSetting<number>('session-target-count'),
          repository.getSetting<number>('new-item-limit'),
          repository.getSetting<string>('session-prompt-mode'),
          repository.getSetting<number>('opponent-delay-ms'),
        ]);
        const initialTargetCount = savedTargetCount ?? DEFAULT_TARGET_COUNT;
        const initialNewLimit = savedNewLimit ?? DEFAULT_NEW_ITEM_LIMIT;
        const initialPromptMode = isScheduledPromptMode(savedPromptMode)
          ? savedPromptMode
          : DEFAULT_PROMPT_MODE;
        setTargetCount(initialTargetCount);
        setNewItemLimit(initialNewLimit);
        setSessionPromptMode(initialPromptMode);
        setOpponentDelayMs(
          [0, 150, 300, 600].includes(savedOpponentDelayMs ?? -1)
            ? (savedOpponentDelayMs as number)
            : DEFAULT_OPPONENT_DELAY_MS,
        );
        const requestedPlan = requestedPlanId
          ? refreshed.allPlans.find((candidate) => candidate.id === requestedPlanId)
          : undefined;
        const initialPlan = requestedPlan ?? refreshed.plans[0];
        if (initialPlan) {
          setSelectionId(initialPlan.id);
          const repertoireId = refreshed.repertoireByPlanId.get(initialPlan.id);
          if (repertoireId) {
            const scheduled = await repository.createAdaptiveSessionPlan(repertoireId, {
              targetCount: initialTargetCount,
              newItemLimit: initialNewLimit,
              mode: initialPromptMode,
              seed: `bootstrap-${repertoireId}`,
            });
            if (!active) return;
            if (scheduled.exercises.length > 0) {
              const created = createAdaptiveTrainingSession(
                scheduled,
                monotonicNowMs(),
                adaptiveSessionId(repertoireId),
              );
              setAdaptiveExercises(scheduled.exercises);
              setAdaptiveExerciseIndex(0);
              setSession(created.state);
              setQueueSummary(await repository.getTrainingQueueSummary(repertoireId));
            } else {
              setAdaptiveExercises([]);
              setSession(
                createGraphTrainingSession(initialPlan, monotonicNowMs(), {
                  sessionId: sessionId(initialPlan),
                }),
              );
              setMode('browse');
              setQueueSummary(await repository.getTrainingQueueSummary(repertoireId));
            }
          } else {
            setSession(
              createGraphTrainingSession(initialPlan, monotonicNowMs(), {
                sessionId: sessionId(initialPlan),
              }),
            );
          }
        }
        const interrupted = await repository.latestInterruptedSession();
        if (
          active &&
          interrupted &&
          (Boolean(interrupted.state.adaptive) ||
            refreshed.allPlans.some((candidate) => candidate.id === interrupted.planId))
        ) {
          setRecoverySession(interrupted);
        }
      } catch (error) {
        if (active) {
          setPersistenceError(
            error instanceof Error
              ? error.message
              : 'Local data initialization failed.',
          );
        }
      } finally {
        if (active) setBootReady(true);
      }
    })();

    return () => {
      active = false;
      if (import.meta.env.MODE === 'test' && ownsRepository) {
        void repository.deleteDatabase();
      } else {
        repository.close();
      }
    };
    // Repository is intentionally constructed once for the application lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository]);

  useEffect(() => {
    const persistentSession = Boolean(
      session.adaptive || repertoireByPlanId.has(session.planId),
    );
    if (!persistentSession || !hasDurableSessionProgress(session)) {
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
              nowMs: monotonicNowMs(),
            }),
          ),
        reducedMotion ? 0 : opponentDelayMs,
      );
      return () => window.clearTimeout(timer);
    }
    if (session.status === 'correct-feedback') {
      const timer = window.setTimeout(
        () =>
          setSession((current) =>
            reduceGraphTrainingSession(current, plan, {
              type: 'continue',
              nowMs: monotonicNowMs(),
            }),
          ),
        420,
      );
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mode, opponentDelayMs, plan, reducedMotion, session.status]);

  const beginPlan = (nextPlan: TrainingExercisePlan) => {
    setAdaptiveExercises([]);
    setAdaptiveExerciseIndex(0);
    setSession(
      createGraphTrainingSession(nextPlan, monotonicNowMs(), {
        sessionId: sessionId(nextPlan),
      }),
    );
  };

  const loadBundledDemo = () => {
    setPlans(basePlans);
    setSelectionId(defaultPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    beginPlan(defaultPlan);
  };

  const handlePlanChange = (nextPlanId: string) => {
    const nextPlan = plans.find((candidate) => candidate.id === nextPlanId);
    if (!nextPlan) return;
    setSelectionId(nextPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    const repertoireId = repertoireByPlanId.get(nextPlan.id);
    if (repertoireId) {
      void repository.putSetting('active-plan-id', nextPlan.id);
      void startScheduledSession(repertoireId).catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : 'Could not start scheduled session.',
        );
      });
    } else {
      beginPlan(nextPlan);
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
    const refreshed = await refreshPersistedPlans();
    const firstPlan = importedPlans[0];
    if (!firstPlan) {
      setSelectionId('');
      setPersistenceError(
        'Repertoire saved locally, but it contains no trainable user decision. It remains available for backup/PGN export; import another PGN to add trainable lines.',
      );
      return;
    }
    const refreshedPlan =
      refreshed.allPlans.find((candidatePlan) => candidatePlan.id === firstPlan.id) ??
      firstPlan;
    setSelectionId(refreshedPlan.id);
    setIncludeDemoAlternative(true);
    setMode('train');
    await repository.putSetting('active-plan-id', refreshedPlan.id);
    setSessionPromptMode('normal');
    await startScheduledSession(storedGraph.repertoires[0]!.id, {
      promptMode: 'normal',
    });
  };

  const handleModeChange = (nextMode: TrainingMode) => {
    if (nextMode === mode) return;
    const persistedRepertoireId = repertoireByPlanId.get(selectionId);
    if (
      nextMode === 'train' &&
      mode === 'browse' &&
      persistedRepertoireId &&
      !session.adaptive
    ) {
      void startScheduledSession(persistedRepertoireId).catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : 'Could not start scheduled session.',
        );
      });
      return;
    }
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
      nowMs: monotonicNowMs(),
      observedAt: wallNowIso(),
    });
    const advanced = next.fen !== session.fen;
    setSession(next);
    return advanced;
  };

  const handleInteractionBlockChange = (blocked: boolean) => {
    setSession((current) =>
      reduceGraphTrainingSession(current, plan, {
        type: blocked ? 'pause-attempt' : 'resume-attempt',
        nowMs: monotonicNowMs(),
      }),
    );
  };

  const resumeInterruptedSession = async () => {
    if (!recoverySession) return;
    try {
      if (recoverySession.state.adaptive) {
        const rebuilt = await Promise.all(
          recoverySession.state.adaptive.exercises.map((descriptor) =>
            repository.rebuildAdaptiveExercise(descriptor),
          ),
        );
        const index = recoverySession.state.adaptive.exerciseIndex;
        const repertoireId =
          recoverySession.state.adaptive.exercises[index]?.repertoireId;
        const selectorPlan = repertoireId
          ? plans.find(
              (candidate) => repertoireByPlanId.get(candidate.id) === repertoireId,
            )
          : undefined;
        if (selectorPlan) {
          setSelectionId(selectorPlan.id);
          await repository.putSetting('active-plan-id', selectorPlan.id);
        }
        setAdaptiveExercises(rebuilt);
        setAdaptiveExerciseIndex(index);
        setMode('train');
        setSession({
          ...structuredClone(recoverySession.state),
          attemptStartedAtMs: monotonicNowMs(),
          pausedDurationMs: 0,
          pauseStartedAtMs: undefined,
        });
        if (repertoireId) {
          setQueueSummary(await repository.getTrainingQueueSummary(repertoireId));
        }
      } else {
        const recoveredPlan = plans.find(
          (candidate) => candidate.id === recoverySession.planId,
        );
        if (!recoveredPlan) {
          setPersistenceError('The saved session repertoire is not available.');
          setRecoverySession(null);
          return;
        }
        await repository.putSetting('active-plan-id', recoveredPlan.id);
        setSelectionId(recoveredPlan.id);
        setIncludeDemoAlternative(true);
        setAdaptiveExercises([]);
        setAdaptiveExerciseIndex(0);
        setMode('train');
        setSession({
          ...structuredClone(recoverySession.state),
          attemptStartedAtMs: monotonicNowMs(),
          pausedDurationMs: 0,
          pauseStartedAtMs: undefined,
        });
      }
      setRecoverySession(null);
    } catch (error) {
      setPersistenceError(
        error instanceof Error ? error.message : 'Could not resume saved session.',
      );
      throw error;
    }
  };

  const abandonInterruptedSession = async () => {
    if (!recoverySession) return;
    try {
      await repository.markSessionAbandoned(recoverySession.id);
      setRecoverySession(null);
    } catch (error) {
      setPersistenceError(
        error instanceof Error ? error.message : 'Could not abandon saved session.',
      );
      throw error;
    }
  };

  const handleCompleteOrAdvance = async () => {
    if (session.status === 'line-complete' && hasNextAdaptiveExercise(session)) {
      if (readyRetestCount(session) > 0) {
        return;
      }
      const deferred = deferAdaptiveRetests(session, plan);
      let nextExercises = adaptiveExercises;
      if (deferred.descriptors.length > 0) {
        const rebuilt = await Promise.all(
          deferred.descriptors.map((descriptor) =>
            repository.rebuildAdaptiveExercise(descriptor),
          ),
        );
        nextExercises = [...adaptiveExercises, ...rebuilt];
        setAdaptiveExercises(nextExercises);
      }
      const nextIndex = (deferred.state.adaptive?.exerciseIndex ?? 0) + 1;
      const nextExercise = nextExercises[nextIndex];
      if (!nextExercise) {
        setPersistenceError('The next scheduled exercise could not be reconstructed.');
        return;
      }
      setAdaptiveExerciseIndex(nextIndex);
      setSession(
        advanceAdaptiveTrainingSession(
          deferred.state,
          nextExercise.plan,
          monotonicNowMs(),
        ),
      );
      return;
    }
    setSession((current) =>
      reduceGraphTrainingSession(current, plan, { type: 'complete-session' }),
    );
    if (selectedRepertoireId) {
      void repository
        .getTrainingQueueSummary(selectedRepertoireId)
        .then(setQueueSummary)
        .catch(() => undefined);
    }
  };

  const handleRestart = () => {
    if (selectedRepertoireId && session.adaptive) {
      void startScheduledSession(selectedRepertoireId).catch((error: unknown) => {
        setPersistenceError(
          error instanceof Error ? error.message : 'Could not start scheduled session.',
        );
      });
      return;
    }
    setSession((current) =>
      reduceGraphTrainingSession(current, plan, {
        type: 'restart',
        nowMs: monotonicNowMs(),
      }),
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
  const summary = adaptiveSessionSummary(session);
  const hasNextExercise =
    hasNextAdaptiveExercise(session) && readyRetestCount(session) === 0;
  const isPersistedSelection = Boolean(
    selectedRepertoireId && repertoireByPlanId.has(selectionId),
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 1 }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>
            Opening Trainer
          </Typography>
          {hasWorkspace ? (
            <>
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
                label={
                  selectedRepertoireId &&
                  (session.adaptive || repertoireByPlanId.has(plan.id))
                    ? 'Scheduled locally'
                    : 'Demo fixture'
                }
              />
              {selectionId === phase3DemoPlan.id ? (
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeDemoAlternative}
                      onChange={(_: ChangeEvent<HTMLInputElement>, checked: boolean) =>
                        handleDemoAlternativeChange(checked)
                      }
                      slotProps={{
                        input: { 'aria-label': 'Include alternative branch' },
                      }}
                    />
                  }
                  label="Include alternative branch"
                  sx={{ mx: 0 }}
                />
              ) : null}
              {selectedRepertoireId && isPersistedSelection ? (
                <>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="session-prompt-mode-label">Session mode</InputLabel>
                    <Select
                      labelId="session-prompt-mode-label"
                      label="Session mode"
                      value={sessionPromptMode}
                      onChange={(event: SelectChangeEvent<string>) => {
                        const value = String(event.target.value);
                        if (isScheduledPromptMode(value)) setSessionPromptMode(value);
                      }}
                    >
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="guided">Guided</MenuItem>
                      <MenuItem value="strict">Strict</MenuItem>
                      <MenuItem value="contrast">Contrast</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel id="session-target-count-label">Targets</InputLabel>
                    <Select
                      labelId="session-target-count-label"
                      label="Targets"
                      value={String(targetCount)}
                      onChange={(event: SelectChangeEvent<string>) =>
                        setTargetCount(Number(event.target.value))
                      }
                    >
                      {[3, 5, 8, 12].map((value) => (
                        <MenuItem key={value} value={String(value)}>
                          {value} targets
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <InputLabel id="new-item-limit-label">New limit</InputLabel>
                    <Select
                      labelId="new-item-limit-label"
                      label="New limit"
                      value={String(newItemLimit)}
                      onChange={(event: SelectChangeEvent<string>) =>
                        setNewItemLimit(Number(event.target.value))
                      }
                    >
                      {[0, 1, 3, 5].map((value) => (
                        <MenuItem key={value} value={String(value)}>
                          {value} new
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 125 }}>
                    <InputLabel id="opponent-delay-label">Opponent delay</InputLabel>
                    <Select
                      labelId="opponent-delay-label"
                      label="Opponent delay"
                      value={String(opponentDelayMs)}
                      onChange={(event: SelectChangeEvent<string>) => {
                        const value = Number(event.target.value);
                        setOpponentDelayMs(value);
                        void repository
                          .putSetting('opponent-delay-ms', value)
                          .catch((error: unknown) =>
                            setPersistenceError(
                              error instanceof Error
                                ? error.message
                                : 'Could not save opponent delay.',
                            ),
                          );
                      }}
                    >
                      {[0, 150, 300, 600].map((value) => (
                        <MenuItem key={value} value={String(value)}>
                          {value === 0 ? 'No delay' : `${value} ms`}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    color="inherit"
                    variant="outlined"
                    onClick={() =>
                      void startScheduledSession(selectedRepertoireId).catch(
                        (error: unknown) =>
                          setPersistenceError(
                            error instanceof Error
                              ? error.message
                              : 'Could not start scheduled session.',
                          ),
                      )
                    }
                  >
                    New scheduled session
                  </Button>
                  <Chip
                    size="small"
                    label={`${queueSummary.due} due · ${queueSummary.new} new${queueSummary.contrast > 0 ? ` · ${queueSummary.contrast} contrast` : ''}`}
                  />
                </>
              ) : null}
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                aria-label="Training mode"
                onChange={(
                  _: MouseEvent<HTMLElement>,
                  nextMode: TrainingMode | null,
                ) => {
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
            </>
          ) : null}
          <Tooltip title="Import PGN repertoire">
            <IconButton
              color="inherit"
              aria-label="Import PGN repertoire"
              onClick={() => setImportOpen(true)}
            >
              <UploadFileOutlinedIcon />
            </IconButton>
          </Tooltip>
          {hasWorkspace ? (
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
          ) : null}
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
        {!bootReady ? (
          <Typography color="text.secondary">Opening local data…</Typography>
        ) : !hasWorkspace ? (
          <Box
            sx={{
              maxWidth: 640,
              mx: 'auto',
              py: { xs: 6, md: 10 },
              textAlign: 'center',
            }}
          >
            <Typography component="h2" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              {hasSavedRepertoires
                ? 'Saved repertoire has no trainable lines'
                : 'No repertoire yet'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {hasSavedRepertoires
                ? 'The repertoire is safely stored and will be included in backup/export, but it currently contains no user decision that can generate a training exercise.'
                : 'No repertoire is stored on this device. Import a PGN to create one, or load the bundled demo without saving it.'}
            </Typography>
            {hasSavedRepertoires ? (
              <Typography variant="body2" sx={{ mb: 3 }}>
                Saved: {storedRepertoires.map((item) => item.name).join(', ')}
              </Typography>
            ) : null}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="contained"
                startIcon={<UploadFileOutlinedIcon />}
                onClick={() => setImportOpen(true)}
              >
                {hasSavedRepertoires ? 'Import another PGN' : 'Import PGN'}
              </Button>
              <Button variant="outlined" onClick={loadBundledDemo}>
                Load demo repertoire
              </Button>
              {hasSavedRepertoires ? (
                <Button variant="outlined" onClick={() => setDataOpen(true)}>
                  Local data and recovery
                </Button>
              ) : null}
            </Box>
          </Box>
        ) : (
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
                hasNextExercise={hasNextExercise}
                queueSummary={queueSummary}
                sessionSummary={summary}
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
                      nowMs: monotonicNowMs(),
                      observedAt: wallNowIso(),
                    }),
                  )
                }
                onContinue={() =>
                  setSession((current) =>
                    reduceGraphTrainingSession(current, plan, {
                      type: 'continue',
                      nowMs: monotonicNowMs(),
                    }),
                  )
                }
                onRetest={() =>
                  setSession((current) =>
                    reduceGraphTrainingSession(current, plan, {
                      type: 'start-retest',
                      nowMs: monotonicNowMs(),
                    }),
                  )
                }
                onCompleteSession={() =>
                  void handleCompleteOrAdvance().catch((error: unknown) =>
                    setPersistenceError(
                      error instanceof Error
                        ? error.message
                        : 'Could not continue the scheduled session.',
                    ),
                  )
                }
                onRestart={handleRestart}
                onAbandon={() =>
                  setSession((current) =>
                    reduceGraphTrainingSession(current, plan, { type: 'abandon' }),
                  )
                }
              />
            </Box>
          </Box>
        )}
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
