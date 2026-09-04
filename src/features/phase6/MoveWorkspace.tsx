import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrainingScope, ScopeQueueSummary } from '../../domain/phase6/types';
import { reducePhase6TrainingSession } from '../../domain/phase6/trainingIntegration';
import {
  adaptiveSessionSummary,
  advanceAdaptiveTrainingSession,
  createAdaptiveTrainingSession,
  deferAdaptiveRetests,
  hasNextAdaptiveExercise,
  type AdaptiveExercisePlan,
} from '../../domain/scheduling/adaptiveSession';
import {
  canSubmitUserMove,
  currentFixtureStep,
  readyRetestCount,
  type TrainingSessionState,
} from '../../domain/training/session';
import type { TrainingExercisePlan } from '../../domain/training/exercisePlan';
import type { TrainingTreeItem } from '../../fixtures/trainingFixtures';
import type { SessionRecord } from '../../infrastructure/db/openingTrainerDatabase';
import type {
  MoveSessionOptions,
  Phase6OpeningTrainerRepository,
} from '../../infrastructure/db/phase6Repository';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../board/ChessboardPreview';
import { RepertoireTreePreview } from '../repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../task/TaskPreviewCard';

interface MoveWorkspaceProps {
  repository: Phase6OpeningTrainerRepository;
  scope: TrainingScope;
  options?: MoveSessionOptions;
  recovery?: SessionRecord;
  reducedMotion?: boolean;
  opponentDelayMs?: number;
  onExit: () => Promise<void> | void;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function wallNow(): string {
  return new Date().toISOString();
}

function newSessionId(scope: TrainingScope): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `move-session-${scope.kind}-${scope.id}-${Date.now()}`
  );
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

export function MoveWorkspace({
  repository,
  scope,
  options = {},
  recovery,
  reducedMotion = false,
  opponentDelayMs = 300,
  onExit,
}: MoveWorkspaceProps) {
  const [exercises, setExercises] = useState<readonly AdaptiveExercisePlan[]>([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [session, setSession] = useState<TrainingSessionState | null>(null);
  const [queueSummary, setQueueSummary] = useState<ScopeQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());

  const queueSave = useCallback((snapshot: TrainingSessionState) => {
    saveChainRef.current = saveChainRef.current
      .then(() => repository.saveMoveSession(structuredClone(snapshot)))
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Move-session persistence failed.');
      });
    return saveChainRef.current;
  }, [repository]);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        if (recovery?.state.adaptive) {
          const rebuilt = await Promise.all(
            recovery.state.adaptive.exercises.map((descriptor) =>
              repository.rebuildMoveExercise(descriptor),
            ),
          );
          if (!active) return;
          setExercises(rebuilt);
          setExerciseIndex(recovery.state.adaptive.exerciseIndex);
          setSession({
            ...structuredClone(recovery.state),
            attemptStartedAtMs: monotonicNow(),
            pausedDurationMs: 0,
            pauseStartedAtMs: undefined,
          });
        } else if (recovery) {
          const rebuilt = await repository.rebuildLegacyMoveSession(recovery);
          if (!active) return;
          setExercises([rebuilt.exercise]);
          setExerciseIndex(0);
          setSession({
            ...structuredClone(recovery.state),
            attemptStartedAtMs: monotonicNow(),
            pausedDurationMs: 0,
            pauseStartedAtMs: undefined,
          });
        } else {
          const planned = await repository.createMoveSessionPlan(scope, options);
          if (planned.exercises.length === 0) {
            throw new Error('No move reviews are due or new in this scope.');
          }
          const created = createAdaptiveTrainingSession(
            planned,
            monotonicNow(),
            newSessionId(scope),
          );
          await repository.saveMoveSession(created.state);
          if (!active) return;
          setExercises(planned.exercises);
          setExerciseIndex(0);
          setSession(created.state);
        }
        const summary = await repository.getScopeQueueSummary(scope);
        if (active) setQueueSummary(summary);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not start move session.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [recovery, repository, scope, options]);

  useEffect(() => {
    if (!session || loading) return;
    void queueSave(session);
  }, [session, loading, queueSave]);

  const exercise = exercises[exerciseIndex];
  const plan: TrainingExercisePlan | undefined = exercise?.plan;
  const currentStep = session && plan ? currentFixtureStep(session, plan) : null;

  useEffect(() => {
    if (!session || !plan) return undefined;
    if (session.status === 'opponent-moving') {
      const timer = globalThis.setTimeout(
        () =>
          setSession((current) =>
            current
              ? reducePhase6TrainingSession(current, plan, {
                  type: 'opponent-tick',
                  nowMs: monotonicNow(),
                })
              : current,
          ),
        reducedMotion ? 0 : opponentDelayMs,
      );
      return () => globalThis.clearTimeout(timer);
    }
    if (session.status === 'correct-feedback') {
      const timer = globalThis.setTimeout(
        () =>
          setSession((current) =>
            current
              ? reducePhase6TrainingSession(current, plan, {
                  type: 'continue',
                  nowMs: monotonicNow(),
                })
              : current,
          ),
        reducedMotion ? 0 : 420,
      );
      return () => globalThis.clearTimeout(timer);
    }
    return undefined;
  }, [opponentDelayMs, plan, reducedMotion, session]);

  const handleMove = (command: BoardMoveCommand): boolean => {
    if (!session || !plan) return false;
    const next = reducePhase6TrainingSession(session, plan, {
      type: 'user-move',
      move: {
        from: command.from,
        to: command.to,
        ...(command.promotion ? { promotion: command.promotion } : {}),
      },
      nowMs: monotonicNow(),
      observedAt: wallNow(),
    });
    const advanced = next.fen !== session.fen;
    setSession(next);
    return advanced;
  };

  const reduce = (event: Parameters<typeof reducePhase6TrainingSession>[2]) => {
    if (!plan) return;
    setSession((current) =>
      current ? reducePhase6TrainingSession(current, plan, event) : current,
    );
  };

  const completeOrAdvance = async () => {
    if (!session || !plan) return;
    if (session.status === 'line-complete' && hasNextAdaptiveExercise(session)) {
      if (readyRetestCount(session) > 0) return;
      const deferred = deferAdaptiveRetests(session, plan);
      let nextExercises = exercises;
      if (deferred.descriptors.length > 0) {
        const rebuilt = await Promise.all(
          deferred.descriptors.map((descriptor) =>
            repository.rebuildMoveExercise(descriptor),
          ),
        );
        nextExercises = [...exercises, ...rebuilt];
        setExercises(nextExercises);
      }
      const nextIndex = (deferred.state.adaptive?.exerciseIndex ?? 0) + 1;
      const nextExercise = nextExercises[nextIndex];
      if (!nextExercise) {
        setError('The next scheduled move exercise could not be reconstructed.');
        return;
      }
      setExerciseIndex(nextIndex);
      setSession(
        advanceAdaptiveTrainingSession(
          deferred.state,
          nextExercise.plan,
          monotonicNow(),
        ),
      );
      return;
    }
    reduce({ type: 'complete-session' });
    setQueueSummary(await repository.getScopeQueueSummary(scope));
  };

  const restart = async () => {
    if (session) {
      await repository.saveMoveSession(session);
      await repository.awaitPendingOperations();
    }
    const planned = await repository.createMoveSessionPlan(scope, options);
    if (planned.exercises.length === 0) {
      setError('No move reviews are due or new in this scope.');
      return;
    }
    const created = createAdaptiveTrainingSession(
      planned,
      monotonicNow(),
      newSessionId(scope),
    );
    await repository.saveMoveSession(created.state);
    setExercises(planned.exercises);
    setExerciseIndex(0);
    setSession(created.state);
  };

  const endAndExit = async () => {
    if (session && plan) {
      const terminal = ['session-complete', 'abandoned'].includes(session.status);
      const finalState = terminal
        ? session
        : reducePhase6TrainingSession(session, plan, { type: 'abandon' });
      setSession(finalState);
      await repository.saveMoveSession(finalState);
      await repository.awaitPendingOperations();
      await saveChainRef.current;
    }
    await onExit();
  };

  if (loading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
        <Typography>Preparing scheduled move recall...</Typography>
      </Stack>
    );
  }

  if (!session || !plan) {
    return (
      <Stack spacing={2} sx={{ py: 4 }}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Button variant="contained" onClick={() => void onExit()}>
          Return to Browse
        </Button>
      </Stack>
    );
  }

  const hintSquares =
    session.hintLevel >= 2 && session.hintLevel < 4 && currentStep?.actor === 'user'
      ? (currentStep.hint?.candidateDestinations ?? [])
      : [];
  const lastMove = session.lastMove
    ? ([session.lastMove.from, session.lastMove.to] as const)
    : undefined;
  const displayedTree = revealTrainTreeLabels(
    plan.tree,
    plan.browseTree,
    session.treeRevealedItemIds,
  );
  const summary = adaptiveSessionSummary(session);
  const hasNext = hasNextAdaptiveExercise(session) && readyRetestCount(session) === 0;

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Typography component="h2" variant="h5">
          Move recall
        </Typography>
        <Button color="warning" onClick={() => void endAndExit()}>
          {['session-complete', 'abandoned'].includes(session.status)
            ? 'Return to Browse'
            : 'End session and Browse'}
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' },
        }}
      >
        <Stack spacing={2}>
          <ChessboardPreview
            position={session.fen}
            orientation={plan.orientation}
            userTurn={canSubmitUserMove(session)}
            disabled={!canSubmitUserMove(session)}
            lastMove={lastMove}
            hintSquares={hintSquares}
            reducedMotion={reducedMotion}
            onMove={handleMove}
            onInteractionBlockChange={(blocked: boolean) =>
              reduce({
                type: blocked ? 'pause-attempt' : 'resume-attempt',
                nowMs: monotonicNow(),
              })
            }
          />
          <TaskPreviewCard
            session={session}
            plan={plan}
            hasNextExercise={hasNext}
            queueSummary={
              queueSummary
                ? {
                    due: queueSummary.due,
                    new: queueSummary.new,
                    contrast: queueSummary.contrast,
                  }
                : undefined
            }
            sessionSummary={summary}
            onHint={() => reduce({ type: 'request-hint' })}
            onReveal={() =>
              reduce({ type: 'reveal', nowMs: monotonicNow(), observedAt: wallNow() })
            }
            onContinue={() => reduce({ type: 'continue', nowMs: monotonicNow() })}
            onRetest={() => reduce({ type: 'start-retest', nowMs: monotonicNow() })}
            onCompleteSession={() => void completeOrAdvance()}
            onRestart={() => void restart()}
            onAbandon={() => void endAndExit()}
          />
        </Stack>
        <Box sx={{ minWidth: 0 }}>
          <RepertoireTreePreview
            mode="train"
            items={displayedTree}
            revealedItemIds={session.treeRevealedItemIds}
            currentItemId={currentStep?.treeItemId}
          />
        </Box>
      </Box>
    </Stack>
  );
}
