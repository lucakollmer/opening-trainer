import {
  tryApplyMove,
  type AppliedChessMove,
  type ChessMoveInput,
} from '../chess/chessAdapter';
import {
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
export type TrainingTimeInput = number | { wallMs: number; monotonicMs: number };

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
  targetPly: number;
  separationRemaining: number;
  sourceObservationId: string;
}

export interface SessionFeedback {
  kind: 'info' | 'correct' | 'illegal' | 'outside' | 'variation' | 'reveal' | 'repair';
  title: string;
  message: string;
}

export interface TrainingSessionState {
  sessionId: string;
  fixtureId: string;
  planId: string;
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
  evidence: readonly ReviewObservation[];
  retestQueue: readonly RetestTicket[];
  retestAttempts: Readonly<Record<string, number>>;
  lastMove?: AppliedChessMove;
  feedback?: SessionFeedback;
}

export type TrainingSessionEvent =
  | { type: 'user-move'; move: ChessMoveInput; nowMs: TrainingTimeInput }
  | { type: 'opponent-tick'; nowMs: TrainingTimeInput }
  | { type: 'request-hint' }
  | { type: 'reveal'; nowMs: TrainingTimeInput }
  | { type: 'continue'; nowMs: TrainingTimeInput }
  | { type: 'start-retest'; nowMs: TrainingTimeInput }
  | { type: 'complete-session' }
  | { type: 'abandon' }
  | { type: 'restart'; nowMs: TrainingTimeInput; sessionId?: string };

const USER_INPUT_STATUSES: readonly TrainingStatus[] = [
  'awaiting-user-move',
  'hint-offered',
  'illegal-feedback',
  'repair-replay',
];
const MAX_RETESTS_PER_TARGET = 2;

function time(value: TrainingTimeInput) {
  return typeof value === 'number'
    ? { wallMs: value, monotonicMs: value }
    : value;
}

function selected(step: TrainingExerciseStep) {
  return step.acceptedMoves.find((move) => move.uci === step.selectedMoveUci) ?? null;
}

function statusFor(plan: TrainingExercisePlan, stepId?: string): TrainingStatus {
  const step = exerciseStep(plan, stepId);
  if (!step) return 'line-complete';
  return step.actor === 'opponent' ? 'opponent-moving' : 'awaiting-user-move';
}

function reveal(ids: readonly string[], id: string): readonly string[] {
  return ids.includes(id) ? ids : [...ids, id];
}

function observe(
  state: TrainingSessionState,
  step: TrainingExerciseStep,
  nowInput: TrainingTimeInput,
  outcome: TrainingOutcome,
  extra: { playedUci?: string; confusionContextId?: string } = {},
): ReviewObservation {
  const now = time(nowInput);
  return {
    id: `${state.sessionId}-obs-${String(state.evidence.length + 1).padStart(3, '0')}`,
    trainingItemId: step.trainingItemId,
    sessionId: state.sessionId,
    observedAt: new Date(now.wallMs).toISOString(),
    evidenceRole: step.id === state.targetStepId ? 'targeted' : 'incidental',
    outcome,
    responseTimeMs: Math.max(
      0,
      Math.min(Math.round(now.monotonicMs - state.attemptStartedAtMs), 600_000),
    ),
    hintLevel: state.hintLevel,
    illegalAttemptCount: state.illegalAttemptCount,
    expectedMoveSetKey: step.acceptedMoveSetKey,
    ...extra,
  };
}

function queueRetest(
  state: TrainingSessionState,
  step: TrainingExerciseStep,
  observationId: string,
) {
  if (state.retestQueue.some((ticket) => ticket.targetStepId === step.id)) {
    return state.retestQueue;
  }
  if ((state.retestAttempts[step.id] ?? 0) >= MAX_RETESTS_PER_TARGET) {
    return state.retestQueue;
  }
  return [
    ...state.retestQueue,
    {
      id: `retest-${observationId}`,
      targetStepId: step.id,
      targetPly: state.plyIndex,
      separationRemaining: 1,
      sourceObservationId: observationId,
    },
  ];
}

function accept(
  state: TrainingSessionState,
  step: TrainingExerciseStep,
  move: AppliedChessMove,
  now: TrainingTimeInput,
): TrainingSessionState {
  const branch = step.acceptedMoves.find((candidate) => candidate.uci === move.uci);
  if (!branch) return state;
  const isRepair = state.status === 'repair-replay';
  const observation = observe(
    state,
    step,
    now,
    isRepair ? 'repair-correct' : state.hintLevel > 0 ? 'hinted-correct' : 'correct',
    { playedUci: move.uci },
  );
  return {
    ...state,
    status: 'correct-feedback',
    fen: move.fen,
    currentStepId: branch.nextStepId,
    plyIndex: state.plyIndex + 1,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: reveal(state.treeRevealedItemIds, step.treeItemId),
    hintLevel: 0,
    illegalAttemptCount: 0,
    evidence: [...state.evidence, observation],
    retestQueue: isRepair
      ? state.retestQueue
      : state.retestQueue.map((ticket) => ({
          ...ticket,
          separationRemaining: Math.max(0, ticket.separationRemaining - 1),
        })),
    lastMove: move,
    feedback: {
      kind: isRepair ? 'repair' : 'correct',
      title: isRepair ? 'Repair complete' : 'Correct repertoire move',
      message: isRepair
        ? `${move.san} was replayed correctly. The original failure remains in the evidence log.`
        : `${move.san} is accepted. Continue the line.`,
    },
  };
}

function userMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  input: ChessMoveInput,
  now: TrainingTimeInput,
): TrainingSessionState {
  if (!USER_INPUT_STATUSES.includes(state.status)) return state;
  const step = exerciseStep(plan, state.currentStepId);
  if (!step || step.actor !== 'user') return state;
  const result = tryApplyMove(state.fen, input);
  if (!result.ok) {
    if (result.code !== 'CHESS_ILLEGAL_MOVE') {
      return {
        ...state,
        status: 'error',
        feedback: {
          kind: 'info',
          title: 'Training position error',
          message: result.message,
        },
      };
    }
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
  if (step.acceptedMoves.some((candidate) => candidate.uci === result.move.uci)) {
    return accept(state, step, result.move, now);
  }

  const sibling = step.wrongSiblingUci.includes(result.move.uci);
  const observation = observe(
    state,
    step,
    now,
    sibling ? 'wrong-variation' : 'outside-repertoire',
    {
      playedUci: result.move.uci,
      ...(sibling
        ? {
            confusionContextId: `${state.fixtureId}:sibling:${step.id}:${result.move.uci}`,
          }
        : {}),
    },
  );
  const withEvidence = { ...state, evidence: [...state.evidence, observation] };
  const expected = selected(step)?.san ?? 'the selected repertoire move';
  return {
    ...withEvidence,
    status: sibling ? 'wrong-variation-feedback' : 'outside-repertoire-feedback',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: reveal(state.treeRevealedItemIds, step.treeItemId),
    retestQueue: queueRetest(withEvidence, step, observation.id),
    feedback: sibling
      ? {
          kind: 'variation',
          title: 'Known sibling variation',
          message: `${result.move.san} is legal and belongs to another known branch. This prompt expects ${expected}. Repair this decision before continuing.`,
        }
      : {
          kind: 'outside',
          title: 'Legal, but outside this repertoire line',
          message: `${result.move.san} is legal but is not accepted by this context. This prompt expects ${expected}. Repair this decision before continuing.`,
        },
  };
}

function hint(state: TrainingSessionState, plan: TrainingExercisePlan) {
  if (!['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)) {
    return state;
  }
  const step = exerciseStep(plan, state.currentStepId);
  if (!step || step.actor !== 'user' || !step.hint) return state;
  const level = Math.min(3, state.hintLevel + 1) as HintLevel;
  return {
    ...state,
    status: 'hint-offered' as const,
    hintLevel: level,
    feedback: {
      kind: 'info' as const,
      title: `Hint ${level} of 3`,
      message: 'Only the requested hint level is disclosed. The full move remains hidden.',
    },
  };
}

function revealMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  now: TrainingTimeInput,
): TrainingSessionState {
  if (!['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)) {
    return state;
  }
  const step = exerciseStep(plan, state.currentStepId);
  const expected = step ? selected(step) : null;
  if (!step || step.actor !== 'user' || !expected) return state;
  const base = { ...state, hintLevel: 4 as const };
  const observation = observe(base, step, now, 'revealed');
  const withEvidence = { ...base, evidence: [...state.evidence, observation] };
  return {
    ...withEvidence,
    status: 'answer-revealed',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: reveal(state.treeRevealedItemIds, step.treeItemId),
    retestQueue: queueRetest(withEvidence, step, observation.id),
    feedback: {
      kind: 'reveal',
      title: 'Answer revealed',
      message: `Replay ${expected.san} correctly. The reveal remains recorded as the original result.`,
    },
  };
}

function continueSession(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowInput: TrainingTimeInput,
): TrainingSessionState {
  if (state.status === 'correct-feedback') {
    const status = statusFor(plan, state.currentStepId);
    return {
      ...state,
      status,
      attemptStartedAtMs:
        status === 'awaiting-user-move'
          ? time(nowInput).monotonicMs
          : state.attemptStartedAtMs,
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
    const step = exerciseStep(plan, state.currentStepId);
    const expected = step ? selected(step) : null;
    if (!expected) return state;
    return {
      ...state,
      status: 'repair-replay',
      feedback: {
        kind: 'repair',
        title: 'Repair this decision',
        message: `Play ${expected.san} now. A correct repair will not erase the original evidence.`,
      },
    };
  }
  return state;
}

function opponentMove(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowInput: TrainingTimeInput,
): TrainingSessionState {
  if (state.status !== 'opponent-moving') return state;
  const step = exerciseStep(plan, state.currentStepId);
  const expected = step?.actor === 'opponent' ? selected(step) : null;
  if (!step || !expected) return state;
  const result = tryApplyMove(state.fen, {
    from: expected.from,
    to: expected.to,
    ...(expected.promotion ? { promotion: expected.promotion } : {}),
  });
  if (!result.ok || result.move.uci !== expected.uci) {
    return {
      ...state,
      status: 'error',
      feedback: {
        kind: 'info',
        title: 'Exercise route error',
        message:
          'The deterministic opponent move was not legal from the current exercise state.',
      },
    };
  }
  const status = statusFor(plan, expected.nextStepId);
  return {
    ...state,
    status,
    fen: result.move.fen,
    currentStepId: expected.nextStepId,
    plyIndex: state.plyIndex + 1,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: reveal(state.treeRevealedItemIds, step.treeItemId),
    lastMove: result.move,
    attemptStartedAtMs:
      status === 'awaiting-user-move'
        ? time(nowInput).monotonicMs
        : state.attemptStartedAtMs,
  };
}

function startRetest(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  nowInput: TrainingTimeInput,
): TrainingSessionState {
  if (state.status !== 'line-complete') return state;
  const ticket = state.retestQueue.find(
    (candidate) => candidate.separationRemaining === 0,
  );
  if (!ticket) return state;
  return {
    ...state,
    status: statusFor(plan, plan.firstStepId),
    fen: plan.initialFen,
    currentStepId: plan.firstStepId,
    plyIndex: 0,
    targetStepId: ticket.targetStepId,
    targetPly: ticket.targetPly,
    runKind: 'retest',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: time(nowInput).monotonicMs,
    retestQueue: state.retestQueue.filter((candidate) => candidate.id !== ticket.id),
    retestAttempts: {
      ...state.retestAttempts,
      [ticket.targetStepId]: (state.retestAttempts[ticket.targetStepId] ?? 0) + 1,
    },
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
  plan: TrainingExercisePlan,
  nowInput: TrainingTimeInput,
  options: { sessionId?: string } = {},
): TrainingSessionState {
  const now = time(nowInput);
  return {
    sessionId: options.sessionId ?? `session-${plan.sourceId}-${now.wallMs}`,
    fixtureId: plan.sourceId,
    planId: plan.id,
    status: statusFor(plan, plan.firstStepId),
    fen: plan.initialFen,
    currentStepId: plan.firstStepId,
    plyIndex: 0,
    targetStepId: plan.targetStepId,
    targetPly: plan.targetPly,
    runKind: 'primary',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: now.monotonicMs,
    evidence: [],
    retestQueue: [],
    retestAttempts: {},
  };
}

export function reduceTrainingSession(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
  event: TrainingSessionEvent,
): TrainingSessionState {
  if (state.planId !== plan.id || state.fixtureId !== plan.sourceId) {
    throw new Error('Training state and exercise plan IDs must match.');
  }
  switch (event.type) {
    case 'user-move':
      return userMove(state, plan, event.move, event.nowMs);
    case 'opponent-tick':
      return opponentMove(state, plan, event.nowMs);
    case 'request-hint':
      return hint(state, plan);
    case 'reveal':
      return revealMove(state, plan, event.nowMs);
    case 'continue':
      return continueSession(state, plan, event.nowMs);
    case 'start-retest':
      return startRetest(state, plan, event.nowMs);
    case 'complete-session':
      if (state.status !== 'line-complete') return state;
      return {
        ...state,
        status: 'session-complete',
        feedback: {
          kind: 'info',
          title: 'Session complete',
          message: state.retestQueue.length
            ? 'The session ended with unresolved retest work still recorded.'
            : 'All in-memory exercise work for this session is complete.',
        },
      };
    case 'abandon':
      return { ...state, status: 'abandoned', feedback: undefined };
    case 'restart':
      return createTrainingSession(plan, event.nowMs, { sessionId: event.sessionId });
  }
}

export function currentExerciseStep(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
): TrainingExerciseStep | null {
  return exerciseStep(plan, state.currentStepId);
}

export function hintDisclosure(
  state: TrainingSessionState,
  plan: TrainingExercisePlan,
): string | null {
  const step = currentExerciseStep(state, plan);
  if (!step || step.actor !== 'user' || !step.hint || state.hintLevel === 0) {
    return null;
  }
  if (state.hintLevel === 1) return `Piece: ${step.hint.piece}.`;
  if (state.hintLevel === 2) {
    return `Piece: ${step.hint.piece}. Candidate destinations: ${step.hint.candidateDestinations.join(', ')}.`;
  }
  if (state.hintLevel === 3) {
    return `Piece: ${step.hint.piece}. Candidate destinations: ${step.hint.candidateDestinations.join(', ')}. Purpose: ${step.hint.purpose}`;
  }
  const expected = selected(step);
  return expected ? `Move: ${expected.san}.` : null;
}

export function canSubmitUserMove(state: TrainingSessionState): boolean {
  return USER_INPUT_STATUSES.includes(state.status);
}

export function readyRetestCount(state: TrainingSessionState): number {
  return state.retestQueue.filter((ticket) => ticket.separationRemaining === 0).length;
}
