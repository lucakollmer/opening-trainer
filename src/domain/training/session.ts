import {
  tryApplyMove,
  type AppliedChessMove,
  type ChessMoveInput,
} from '../chess/chessAdapter';
import type { TrainingFixture } from '../../fixtures/trainingFixtures';
import {
  compileTrainingFixture,
  exerciseStep,
  type TrainingExercisePlan,
  type TrainingExerciseStep,
} from './exercisePlan';

export type HintLevel = 0 | 1 | 2 | 3 | 4;
export type EvidenceRole = 'targeted' | 'incidental';
export type TrainingOutcome =
  | 'instant-correct'
  | 'correct'
  | 'hesitant-correct'
  | 'hinted-correct'
  | 'wrong-variation'
  | 'outside-repertoire'
  | 'illegal-attempt'
  | 'revealed'
  | 'repair-correct';

export type TrainingStatus =
  | 'awaiting-user-move'
  | 'opponent-moving'
  | 'correct-feedback'
  | 'illegal-feedback'
  | 'outside-repertoire-feedback'
  | 'wrong-variation-feedback'
  | 'hint-offered'
  | 'answer-revealed'
  | 'repair-replay'
  | 'line-complete'
  | 'session-complete'
  | 'abandoned'
  | 'error';

export interface ReviewObservation {
  id: string;
  trainingItemId: string;
  sessionId: string;
  observedAt: string;
  evidenceRole: EvidenceRole;
  outcome: TrainingOutcome;
  responseTimeMs: number;
  hintLevel: HintLevel;
  illegalAttemptCount: number;
  expectedMoveSetKey: string;
  playedUci?: string;
  confusionContextId?: string;
}

export interface RetestTicket {
  id: string;
  targetStepId: string;
  separationRemaining: number;
  sourceObservationId: string;
  attempt: number;
}

export interface SessionFeedback {
  kind: 'info' | 'correct' | 'illegal' | 'outside' | 'variation' | 'reveal' | 'repair';
  title: string;
  message: string;
}

export interface TrainingSessionState {
  sessionId: string;
  planId: string;
  fixtureId: string;
  status: TrainingStatus;
  fen: string;
  currentStepId?: string;
  plyIndex: number;
  targetStepId: string;
  targetPly: number;
  runKind: 'primary' | 'retest';
  treeRevealedPlyCount: number;
  treeRevealedItemIds: readonly string[];
  hintLevel: HintLevel;
  illegalAttemptCount: number;
  attemptStartedAtMs: number;
  pausedDurationMs: number;
  pauseStartedAtMs?: number;
  evidence: readonly ReviewObservation[];
  retestQueue: readonly RetestTicket[];
  retestAttemptsByStep: Readonly<Record<string, number>>;
  lastMove?: AppliedChessMove;
  feedback?: SessionFeedback;
}

export type TrainingSessionEvent =
  | { type: 'user-move'; move: ChessMoveInput; nowMs: number }
  | { type: 'opponent-tick'; nowMs: number }
  | { type: 'request-hint' }
  | { type: 'reveal'; nowMs: number }
  | { type: 'continue'; nowMs: number }
  | { type: 'start-retest'; nowMs: number }
  | { type: 'pause-attempt'; nowMs: number }
  | { type: 'resume-attempt'; nowMs: number }
  | { type: 'complete-session' }
  | { type: 'abandon' }
  | { type: 'restart'; nowMs: number };

export type TrainingSource = TrainingFixture | TrainingExercisePlan;
const MAX_RETESTS_PER_DECISION = 2;

const USER_INPUT_STATUSES: readonly TrainingStatus[] = [
  'awaiting-user-move',
  'hint-offered',
  'illegal-feedback',
  'repair-replay',
];

function asPlan(source: TrainingSource): TrainingExercisePlan {
  return 'steps' in source ? source : compileTrainingFixture(source);
}

function stepIndex(plan: TrainingExercisePlan, stepId: string | undefined): number {
  if (!stepId) return plan.steps.length;
  const index = plan.steps.findIndex((step) => step.id === stepId);
  return index < 0 ? plan.steps.length : index;
}

function stepPly(
  plan: TrainingExercisePlan,
  stepId: string | undefined,
  fallback: number,
): number {
  return exerciseStep(plan, stepId)?.ply ?? fallback;
}

function currentStep(state: TrainingSessionState, plan: TrainingExercisePlan) {
  return exerciseStep(plan, state.currentStepId);
}

function statusForStep(step: TrainingExerciseStep | null): TrainingStatus {
  if (!step) return 'line-complete';
  return step.actor === 'opponent' ? 'opponent-moving' : 'awaiting-user-move';
}

function observationRole(state: TrainingSessionState): EvidenceRole {
  return state.currentStepId === state.targetStepId ? 'targeted' : 'incidental';
}

function nextObservationId(state: TrainingSessionState): string {
  return `${state.sessionId}-obs-${String(state.evidence.length + 1).padStart(3, '0')}`;
}

function boundedDuration(state: TrainingSessionState, nowMs: number): number {
  const activePause =
    state.pauseStartedAtMs === undefined ? 0 : nowMs - state.pauseStartedAtMs;
  const elapsed =
    nowMs - state.attemptStartedAtMs - state.pausedDurationMs - activePause;
  return Math.max(0, Math.min(Math.round(elapsed), 10 * 60 * 1000));
}

function makeObservation(
  state: TrainingSessionState,
  step: TrainingExerciseStep,
  nowMs: number,
  outcome: TrainingOutcome,
  options: { playedUci?: string; confusionContextId?: string } = {},
): ReviewObservation {
  return {
    id: nextObservationId(state),
    trainingItemId: step.trainingItemId,
    sessionId: state.sessionId,
    observedAt: new Date(nowMs).toISOString(),
    evidenceRole: observationRole(state),
    outcome,
    responseTimeMs: boundedDuration(state, nowMs),
    hintLevel: state.hintLevel,
    illegalAttemptCount: state.illegalAttemptCount,
    expectedMoveSetKey: step.acceptedMoveSetKey,
    ...(options.playedUci ? { playedUci: options.playedUci } : {}),
    ...(options.confusionContextId
      ? { confusionContextId: options.confusionContextId }
      : {}),
  };
}

function queueRetest(
  state: TrainingSessionState,
  targetStepId: string,
  observationId: string,
): Pick<TrainingSessionState, 'retestQueue' | 'retestAttemptsByStep'> {
  if (state.retestQueue.some((ticket) => ticket.targetStepId === targetStepId)) {
    return {
      retestQueue: state.retestQueue,
      retestAttemptsByStep: state.retestAttemptsByStep,
    };
  }
  const priorAttempts = state.retestAttemptsByStep[targetStepId] ?? 0;
  if (priorAttempts >= MAX_RETESTS_PER_DECISION) {
    return {
      retestQueue: state.retestQueue,
      retestAttemptsByStep: state.retestAttemptsByStep,
    };
  }
  const attempt = priorAttempts + 1;
  return {
    retestQueue: [
      ...state.retestQueue,
      {
        id: `retest-${observationId}-${attempt}`,
        targetStepId,
        separationRemaining: 1,
        sourceObservationId: observationId,
        attempt,
      },
    ],
    retestAttemptsByStep: { ...state.retestAttemptsByStep, [targetStepId]: attempt },
  };
}

function ageRetests(queue: readonly RetestTicket[]): readonly RetestTicket[] {
  return queue.map((ticket) => ({
    ...ticket,
    separationRemaining: Math.max(0, ticket.separationRemaining - 1),
  }));
}

function revealTreeItem(ids: readonly string[], treeItemId: string): readonly string[] {
  return ids.includes(treeItemId) ? ids : [...ids, treeItemId];
}

function nextStepId(
  step: TrainingExerciseStep,
  acceptedUci?: string,
): string | undefined {
  if (acceptedUci && Object.hasOwn(step.nextStepByAcceptedUci, acceptedUci)) {
    return step.nextStepByAcceptedUci[acceptedUci];
  }
  return step.nextStepId;
}

function acceptedSans(step: TrainingExerciseStep): readonly string[] {
  const unique = [...new Set(step.acceptedSan.filter(Boolean))];
  return unique.length > 0 ? unique : [step.san];
}

function acceptedAnswerSentence(step: TrainingExerciseStep): string {
  const sans = acceptedSans(step);
  if (sans.length === 1) return `This prompt expects ${sans[0]}.`;
  if (sans.length === 2)
    return `Accepted repertoire moves here are ${sans[0]} or ${sans[1]}.`;
  return `Accepted repertoire moves here are ${sans.slice(0, -1).join(', ')}, or ${sans.at(-1)}.`;
}

function repairInstruction(step: TrainingExerciseStep): string {
  const sans = acceptedSans(step);
  if (sans.length === 1) {
    return `Play ${sans[0]} now. A correct repair will not erase the original evidence.`;
  }
  return `Play any accepted repertoire move (${sans.join(' / ')}) now. A correct repair will not erase the original evidence.`;
}

function acceptedMoveState(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  step: TrainingExerciseStep,
  applied: AppliedChessMove,
  nowMs: number,
): TrainingSessionState {
  const isRepair = state.status === 'repair-replay';
  const outcome: TrainingOutcome = isRepair
    ? 'repair-correct'
    : state.hintLevel > 0
      ? 'hinted-correct'
      : 'correct';
  const observation = makeObservation(state, step, nowMs, outcome, {
    playedUci: applied.uci,
  });
  const followingStepId = nextStepId(step, applied.uci);
  const followingPly = stepPly(plan, followingStepId, step.ply + 1);

  return {
    ...state,
    status: 'correct-feedback',
    fen: applied.fen,
    currentStepId: followingStepId,
    plyIndex: followingPly,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    hintLevel: 0,
    illegalAttemptCount: 0,
    pausedDurationMs: 0,
    pauseStartedAtMs: undefined,
    evidence: [...state.evidence, observation],
    retestQueue: isRepair ? state.retestQueue : ageRetests(state.retestQueue),
    lastMove: applied,
    feedback: {
      kind: isRepair ? 'repair' : 'correct',
      title: isRepair ? 'Repair complete' : 'Correct repertoire move',
      message: isRepair
        ? `${applied.san} was replayed correctly. The original failure remains in the evidence log.`
        : `${applied.san} is accepted. Continue the line.`,
    },
  };
}

function failedLegalMoveState(
  state: TrainingSessionState,
  step: TrainingExerciseStep,
  applied: AppliedChessMove,
  nowMs: number,
): TrainingSessionState {
  const isWrongVariation = step.wrongSiblingUci?.includes(applied.uci) ?? false;
  const outcome: TrainingOutcome = isWrongVariation
    ? 'wrong-variation'
    : 'outside-repertoire';
  const observation = makeObservation(state, step, nowMs, outcome, {
    playedUci: applied.uci,
    ...(isWrongVariation
      ? { confusionContextId: `${state.planId}:sibling:${step.id}` }
      : {}),
  });
  const queued = queueRetest(state, step.id, observation.id);
  const answer = acceptedAnswerSentence(step);

  return {
    ...state,
    status: isWrongVariation
      ? 'wrong-variation-feedback'
      : 'outside-repertoire-feedback',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    evidence: [...state.evidence, observation],
    ...queued,
    feedback: isWrongVariation
      ? {
          kind: 'variation',
          title: 'Known sibling variation',
          message: `${applied.san} is legal and belongs to another known branch. ${answer} Repair this decision before continuing.`,
        }
      : {
          kind: 'outside',
          title: 'Legal, but outside this repertoire line',
          message: `${applied.san} is legal but is not accepted by this repertoire context. ${answer} Repair this decision before continuing.`,
        },
  };
}

function handleUserMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  move: ChessMoveInput,
  nowMs: number,
): TrainingSessionState {
  if (!USER_INPUT_STATUSES.includes(state.status)) return state;
  const step = currentStep(state, plan);
  if (!step || step.actor !== 'user') return state;

  const result = tryApplyMove(state.fen, move);
  if (result.kind === 'invalid-position') {
    return {
      ...state,
      status: 'error',
      feedback: {
        kind: 'info',
        title: 'Invalid training position',
        message:
          'The training position could not be read safely. The exercise has stopped.',
      },
    };
  }
  if (result.kind === 'illegal-move') {
    return {
      ...state,
      status: 'illegal-feedback',
      illegalAttemptCount: state.illegalAttemptCount + 1,
      feedback: {
        kind: 'illegal',
        title: 'Illegal move',
        message: 'The position did not advance. Try another legal move.',
      },
    };
  }

  if (step.acceptedUci.includes(result.move.uci)) {
    return acceptedMoveState(state, plan, step, result.move, nowMs);
  }
  return failedLegalMoveState(state, step, result.move, nowMs);
}

function requestHint(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
): TrainingSessionState {
  if (
    !['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)
  ) {
    return state;
  }
  const step = currentStep(state, plan);
  if (!step || step.actor !== 'user' || !step.hint) return state;
  const nextLevel = Math.min(3, state.hintLevel + 1) as HintLevel;
  return {
    ...state,
    status: 'hint-offered',
    hintLevel: nextLevel,
    feedback: {
      kind: 'info',
      title: `Hint ${nextLevel} of 3`,
      message:
        'Only the requested hint level is disclosed. The full move remains hidden.',
    },
  };
}

function revealMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowMs: number,
): TrainingSessionState {
  if (
    !['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)
  ) {
    return state;
  }
  const step = currentStep(state, plan);
  if (!step || step.actor !== 'user') return state;
  const revealedState = { ...state, hintLevel: 4 as const };
  const observation = makeObservation(revealedState, step, nowMs, 'revealed');
  const queued = queueRetest(revealedState, step.id, observation.id);
  return {
    ...revealedState,
    status: 'answer-revealed',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    evidence: [...state.evidence, observation],
    ...queued,
    feedback: {
      kind: 'reveal',
      title: 'Answer revealed',
      message: `Replay ${step.san} correctly. The reveal remains recorded as the original result.`,
    },
  };
}

function continueSession(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowMs: number,
): TrainingSessionState {
  if (state.status === 'correct-feedback') {
    const status = statusForStep(currentStep(state, plan));
    return {
      ...state,
      status,
      attemptStartedAtMs:
        status === 'awaiting-user-move' ? nowMs : state.attemptStartedAtMs,
      pausedDurationMs: status === 'awaiting-user-move' ? 0 : state.pausedDurationMs,
      feedback: undefined,
    };
  }
  if (state.status === 'illegal-feedback') {
    return {
      ...state,
      status: state.hintLevel > 0 ? 'hint-offered' : 'awaiting-user-move',
      feedback: undefined,
    };
  }
  if (
    state.status === 'wrong-variation-feedback' ||
    state.status === 'outside-repertoire-feedback' ||
    state.status === 'answer-revealed'
  ) {
    const step = currentStep(state, plan);
    if (!step) return state;
    return {
      ...state,
      status: 'repair-replay',
      feedback: {
        kind: 'repair',
        title: 'Repair this decision',
        message: repairInstruction(step),
      },
    };
  }
  return state;
}

function applyOpponentMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowMs: number,
): TrainingSessionState {
  if (state.status !== 'opponent-moving') return state;
  const step = currentStep(state, plan);
  if (!step || step.actor !== 'opponent') return state;
  const result = tryApplyMove(state.fen, {
    from: step.from,
    to: step.to,
    ...(step.promotion ? { promotion: step.promotion } : {}),
  });
  if (result.kind !== 'applied') {
    return {
      ...state,
      status: 'error',
      feedback: {
        kind: 'info',
        title:
          result.kind === 'invalid-position'
            ? 'Invalid training position'
            : 'Exercise route error',
        message: 'The deterministic opponent route could not continue safely.',
      },
    };
  }
  const followingStepId = nextStepId(step, result.move.uci);
  const following = exerciseStep(plan, followingStepId);
  const nextStatus = statusForStep(following);
  return {
    ...state,
    status: nextStatus,
    fen: result.move.fen,
    currentStepId: followingStepId,
    plyIndex: following?.ply ?? step.ply + 1,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    lastMove: result.move,
    attemptStartedAtMs:
      nextStatus === 'awaiting-user-move' ? nowMs : state.attemptStartedAtMs,
    pausedDurationMs: nextStatus === 'awaiting-user-move' ? 0 : state.pausedDurationMs,
    feedback:
      nextStatus === 'line-complete'
        ? {
            kind: 'info',
            title: 'Line complete',
            message: 'The selected repertoire route is complete.',
          }
        : undefined,
  };
}

function startRetest(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowMs: number,
): TrainingSessionState {
  if (state.status !== 'line-complete') return state;
  const ticket = state.retestQueue.find(
    (candidate) => candidate.separationRemaining === 0,
  );
  if (!ticket) return state;
  const start = exerciseStep(plan, plan.startStepId);
  const target = exerciseStep(plan, ticket.targetStepId);
  return {
    ...state,
    status: statusForStep(start),
    fen: plan.initialFen,
    currentStepId: plan.startStepId,
    plyIndex: start?.ply ?? 0,
    targetStepId: ticket.targetStepId,
    targetPly: target?.ply ?? stepIndex(plan, ticket.targetStepId),
    runKind: 'retest',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: nowMs,
    pausedDurationMs: 0,
    pauseStartedAtMs: undefined,
    retestQueue: state.retestQueue.filter((candidate) => candidate.id !== ticket.id),
    lastMove: undefined,
    feedback: {
      kind: 'info',
      title: 'Delayed retest',
      message:
        'Replay the containing line from move one. The previously failed decision is targeted again.',
    },
  };
}

export function createTrainingSession(
  source: TrainingSource,
  nowMs: number,
  options: { sessionId?: string } = {},
): TrainingSessionState {
  const plan = asPlan(source);
  const start = exerciseStep(plan, plan.startStepId);
  const target = exerciseStep(plan, plan.targetStepId);
  const targetPly = target?.ply ?? stepIndex(plan, plan.targetStepId);
  return {
    sessionId: options.sessionId ?? `${plan.id}-${nowMs}`,
    planId: plan.id,
    fixtureId: plan.id,
    status: statusForStep(start),
    fen: plan.initialFen,
    currentStepId: plan.startStepId,
    plyIndex: start?.ply ?? 0,
    targetStepId: plan.targetStepId,
    targetPly,
    runKind: 'primary',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: nowMs,
    pausedDurationMs: 0,
    evidence: [],
    retestQueue: [],
    retestAttemptsByStep: {},
  };
}

export function reduceTrainingSession(
  state: TrainingSessionState,
  source: TrainingSource,
  event: TrainingSessionEvent,
): TrainingSessionState {
  const plan = asPlan(source);
  if (state.planId !== plan.id)
    throw new Error('Training state and plan IDs must match.');
  switch (event.type) {
    case 'user-move':
      return handleUserMove(state, plan, event.move, event.nowMs);
    case 'opponent-tick':
      return applyOpponentMove(state, plan, event.nowMs);
    case 'request-hint':
      return requestHint(state, plan);
    case 'reveal':
      return revealMove(state, plan, event.nowMs);
    case 'continue':
      return continueSession(state, plan, event.nowMs);
    case 'start-retest':
      return startRetest(state, plan, event.nowMs);
    case 'pause-attempt':
      if (state.pauseStartedAtMs !== undefined) return state;
      return { ...state, pauseStartedAtMs: event.nowMs };
    case 'resume-attempt':
      if (state.pauseStartedAtMs === undefined) return state;
      return {
        ...state,
        pausedDurationMs:
          state.pausedDurationMs + Math.max(0, event.nowMs - state.pauseStartedAtMs),
        pauseStartedAtMs: undefined,
      };
    case 'complete-session':
      if (state.status !== 'line-complete') return state;
      return {
        ...state,
        status: 'session-complete',
        feedback: {
          kind: 'info',
          title: 'Session complete',
          message:
            state.retestQueue.length > 0
              ? 'The session ended with unresolved retest work still recorded.'
              : 'All in-memory repertoire work for this session is complete.',
        },
      };
    case 'abandon':
      return { ...state, status: 'abandoned', feedback: undefined };
    case 'restart':
      return createTrainingSession(plan, event.nowMs, { sessionId: state.sessionId });
  }
}

export function currentFixtureStep(
  state: TrainingSessionState,
  source: TrainingSource,
): TrainingExerciseStep | null {
  return currentStep(state, asPlan(source));
}

export function hintDisclosure(
  state: TrainingSessionState,
  source: TrainingSource,
): string | null {
  const step = currentStep(state, asPlan(source));
  if (!step || step.actor !== 'user' || !step.hint || state.hintLevel === 0)
    return null;
  if (state.hintLevel === 1) return `Piece: ${step.hint.piece}.`;
  if (state.hintLevel === 2) {
    return `Piece: ${step.hint.piece}. Candidate destinations: ${step.hint.candidateDestinations.join(', ')}.`;
  }
  if (state.hintLevel === 3) {
    return `Piece: ${step.hint.piece}. Candidate destinations: ${step.hint.candidateDestinations.join(', ')}. Purpose: ${step.hint.purpose}`;
  }
  return `Move: ${step.san}.`;
}

export function canSubmitUserMove(state: TrainingSessionState): boolean {
  return USER_INPUT_STATUSES.includes(state.status);
}

export function readyRetestCount(state: TrainingSessionState): number {
  return state.retestQueue.filter((ticket) => ticket.separationRemaining === 0).length;
}
