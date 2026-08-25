import {
  applyMove,
  moveToUci,
  type AppliedChessMove,
  type ChessMoveInput,
} from '../chess/chessAdapter';
import type {
  TrainingFixture,
  TrainingFixtureMove,
} from '../../fixtures/trainingFixtures';

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
  status: TrainingStatus;
  fen: string;
  plyIndex: number;
  targetPly: number;
  runKind: 'primary' | 'retest';
  treeRevealedPlyCount: number;
  treeRevealedItemIds: readonly string[];
  hintLevel: HintLevel;
  illegalAttemptCount: number;
  attemptStartedAtMs: number;
  evidence: readonly ReviewObservation[];
  retestQueue: readonly RetestTicket[];
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
  | { type: 'complete-session' }
  | { type: 'abandon' }
  | { type: 'restart'; nowMs: number };

const USER_INPUT_STATUSES: readonly TrainingStatus[] = [
  'awaiting-user-move',
  'hint-offered',
  'illegal-feedback',
  'repair-replay',
];

function fixtureStep(
  fixture: TrainingFixture,
  plyIndex: number,
): TrainingFixtureMove | null {
  return fixture.route[plyIndex] ?? null;
}

function stepUci(step: TrainingFixtureMove): string {
  return `${step.from}${step.to}${step.promotion ?? ''}`;
}

function normalizedAcceptedSet(step: TrainingFixtureMove): string {
  return [...step.acceptedUci].sort().join('|');
}

function observationRole(state: TrainingSessionState): EvidenceRole {
  return state.plyIndex === state.targetPly ? 'targeted' : 'incidental';
}

function nextObservationId(state: TrainingSessionState): string {
  return `${state.sessionId}-obs-${String(state.evidence.length + 1).padStart(3, '0')}`;
}

function boundedDuration(nowMs: number, startedAtMs: number): number {
  return Math.max(0, Math.min(Math.round(nowMs - startedAtMs), 10 * 60 * 1000));
}

function makeObservation(
  state: TrainingSessionState,
  step: TrainingFixtureMove,
  nowMs: number,
  outcome: TrainingOutcome,
  options: { playedUci?: string; confusionContextId?: string } = {},
): ReviewObservation {
  return {
    id: nextObservationId(state),
    trainingItemId: `${state.fixtureId}-ply-${state.plyIndex + 1}`,
    sessionId: state.sessionId,
    observedAt: new Date(nowMs).toISOString(),
    evidenceRole: observationRole(state),
    outcome,
    responseTimeMs: boundedDuration(nowMs, state.attemptStartedAtMs),
    hintLevel: state.hintLevel,
    illegalAttemptCount: state.illegalAttemptCount,
    expectedMoveSetKey: normalizedAcceptedSet(step),
    ...(options.playedUci ? { playedUci: options.playedUci } : {}),
    ...(options.confusionContextId
      ? { confusionContextId: options.confusionContextId }
      : {}),
  };
}

function queueRetest(
  queue: readonly RetestTicket[],
  targetPly: number,
  observationId: string,
): readonly RetestTicket[] {
  if (queue.some((ticket) => ticket.targetPly === targetPly)) return queue;

  return [
    ...queue,
    {
      id: `retest-${observationId}`,
      targetPly,
      separationRemaining: 1,
      sourceObservationId: observationId,
    },
  ];
}

function ageRetests(queue: readonly RetestTicket[]): readonly RetestTicket[] {
  return queue.map((ticket) => ({
    ...ticket,
    separationRemaining: Math.max(0, ticket.separationRemaining - 1),
  }));
}

function statusForCurrentStep(
  fixture: TrainingFixture,
  plyIndex: number,
): TrainingStatus {
  const step = fixtureStep(fixture, plyIndex);
  if (!step) return 'line-complete';
  return step.actor === 'opponent' ? 'opponent-moving' : 'awaiting-user-move';
}

function revealTreeItem(
  revealedItemIds: readonly string[],
  treeItemId: string,
): readonly string[] {
  return revealedItemIds.includes(treeItemId)
    ? revealedItemIds
    : [...revealedItemIds, treeItemId];
}

function acceptedMoveState(
  state: TrainingSessionState,
  step: TrainingFixtureMove,
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
  const nextPly = state.plyIndex + 1;
  const retestQueue = isRepair ? state.retestQueue : ageRetests(state.retestQueue);

  return {
    ...state,
    status: 'correct-feedback',
    fen: applied.fen,
    plyIndex: nextPly,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, nextPly),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    hintLevel: 0,
    illegalAttemptCount: 0,
    evidence: [...state.evidence, observation],
    retestQueue,
    lastMove: applied,
    feedback: {
      kind: isRepair ? 'repair' : 'correct',
      title: isRepair ? 'Repair complete' : 'Correct repertoire move',
      message: isRepair
        ? `${step.san} was replayed correctly. The original failure remains in the evidence log.`
        : `${step.san} is accepted. Continue the line.`,
    },
  };
}

function failedLegalMoveState(
  state: TrainingSessionState,
  step: TrainingFixtureMove,
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
      ? { confusionContextId: `${state.fixtureId}-sibling-ply-${state.plyIndex + 1}` }
      : {}),
  });

  return {
    ...state,
    status: isWrongVariation
      ? 'wrong-variation-feedback'
      : 'outside-repertoire-feedback',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    evidence: [...state.evidence, observation],
    retestQueue: queueRetest(state.retestQueue, state.plyIndex, observation.id),
    feedback: isWrongVariation
      ? {
          kind: 'variation',
          title: 'Known sibling variation',
          message: `${applied.san} is legal and belongs to another known branch. This prompt expects ${step.san}. Repair this decision before continuing.`,
        }
      : {
          kind: 'outside',
          title: 'Legal, but outside this repertoire line',
          message: `${applied.san} is legal but is not accepted by this fixture context. This prompt expects ${step.san}. Repair this decision before continuing.`,
        },
  };
}

function handleUserMove(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  move: ChessMoveInput,
  nowMs: number,
): TrainingSessionState {
  if (!USER_INPUT_STATUSES.includes(state.status)) return state;

  const step = fixtureStep(fixture, state.plyIndex);
  if (!step || step.actor !== 'user') return state;

  const applied = applyMove(state.fen, move);
  if (!applied) {
    const illegalAttemptCount = state.illegalAttemptCount + 1;
    const observation = makeObservation(
      { ...state, illegalAttemptCount },
      step,
      nowMs,
      'illegal-attempt',
      { playedUci: moveToUci(move) },
    );

    return {
      ...state,
      status: 'illegal-feedback',
      illegalAttemptCount,
      evidence: [...state.evidence, observation],
      feedback: {
        kind: 'illegal',
        title: 'Illegal move',
        message: 'The position did not advance. Try another legal move.',
      },
    };
  }

  if (step.acceptedUci.includes(applied.uci)) {
    return acceptedMoveState(state, step, applied, nowMs);
  }

  return failedLegalMoveState(state, step, applied, nowMs);
}

function requestHint(
  state: TrainingSessionState,
  fixture: TrainingFixture,
): TrainingSessionState {
  if (
    !['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)
  ) {
    return state;
  }

  const step = fixtureStep(fixture, state.plyIndex);
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
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  if (
    !['awaiting-user-move', 'hint-offered', 'illegal-feedback'].includes(state.status)
  ) {
    return state;
  }

  const step = fixtureStep(fixture, state.plyIndex);
  if (!step || step.actor !== 'user') return state;

  const revealedState = { ...state, hintLevel: 4 as const };
  const observation = makeObservation(revealedState, step, nowMs, 'revealed');

  return {
    ...revealedState,
    status: 'answer-revealed',
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, state.plyIndex + 1),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    evidence: [...state.evidence, observation],
    retestQueue: queueRetest(state.retestQueue, state.plyIndex, observation.id),
    feedback: {
      kind: 'reveal',
      title: 'Answer revealed',
      message: `Replay ${step.san} correctly. The reveal remains recorded as the original result.`,
    },
  };
}

function continueSession(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  if (state.status === 'correct-feedback') {
    const status = statusForCurrentStep(fixture, state.plyIndex);
    return {
      ...state,
      status,
      attemptStartedAtMs:
        status === 'awaiting-user-move' ? nowMs : state.attemptStartedAtMs,
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
    const step = fixtureStep(fixture, state.plyIndex);
    if (!step) return state;

    return {
      ...state,
      status: 'repair-replay',
      feedback: {
        kind: 'repair',
        title: 'Repair this decision',
        message: `Play ${step.san} now. A correct repair will not erase the original evidence.`,
      },
    };
  }

  return state;
}

function applyOpponentMove(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  if (state.status !== 'opponent-moving') return state;

  const step = fixtureStep(fixture, state.plyIndex);
  if (!step || step.actor !== 'opponent') return state;

  const applied = applyMove(state.fen, {
    from: step.from,
    to: step.to,
    ...(step.promotion ? { promotion: step.promotion } : {}),
  });

  if (!applied || applied.uci !== stepUci(step)) {
    return {
      ...state,
      status: 'error',
      feedback: {
        kind: 'info',
        title: 'Fixture route error',
        message:
          'The deterministic opponent move was not legal from the current fixture state.',
      },
    };
  }

  const nextPly = state.plyIndex + 1;
  const nextStatus = statusForCurrentStep(fixture, nextPly);

  return {
    ...state,
    status: nextStatus,
    fen: applied.fen,
    plyIndex: nextPly,
    treeRevealedPlyCount: Math.max(state.treeRevealedPlyCount, nextPly),
    treeRevealedItemIds: revealTreeItem(state.treeRevealedItemIds, step.treeItemId),
    lastMove: applied,
    attemptStartedAtMs:
      nextStatus === 'awaiting-user-move' ? nowMs : state.attemptStartedAtMs,
    feedback:
      nextStatus === 'line-complete'
        ? {
            kind: 'info',
            title: 'Line complete',
            message: 'The deterministic fixture route is complete.',
          }
        : undefined,
  };
}

function startRetest(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  if (state.status !== 'line-complete') return state;

  const ticket = state.retestQueue.find(
    (candidate) => candidate.separationRemaining === 0,
  );
  if (!ticket) return state;

  const remainingQueue = state.retestQueue.filter(
    (candidate) => candidate.id !== ticket.id,
  );
  const status = statusForCurrentStep(fixture, 0);

  return {
    ...state,
    status,
    fen: fixture.initialFen,
    plyIndex: 0,
    targetPly: ticket.targetPly,
    runKind: 'retest',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: nowMs,
    retestQueue: remainingQueue,
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
  fixture: TrainingFixture,
  nowMs: number,
): TrainingSessionState {
  if (fixture.route.length === 0) {
    throw new Error('A training fixture requires at least one route move.');
  }

  return {
    sessionId: `${fixture.id}-${nowMs}`,
    fixtureId: fixture.id,
    status: statusForCurrentStep(fixture, 0),
    fen: fixture.initialFen,
    plyIndex: 0,
    targetPly: fixture.targetPly,
    runKind: 'primary',
    treeRevealedPlyCount: 0,
    treeRevealedItemIds: [],
    hintLevel: 0,
    illegalAttemptCount: 0,
    attemptStartedAtMs: nowMs,
    evidence: [],
    retestQueue: [],
  };
}

export function reduceTrainingSession(
  state: TrainingSessionState,
  fixture: TrainingFixture,
  event: TrainingSessionEvent,
): TrainingSessionState {
  if (state.fixtureId !== fixture.id) {
    throw new Error('Training state and fixture IDs must match.');
  }

  switch (event.type) {
    case 'user-move':
      return handleUserMove(state, fixture, event.move, event.nowMs);
    case 'opponent-tick':
      return applyOpponentMove(state, fixture, event.nowMs);
    case 'request-hint':
      return requestHint(state, fixture);
    case 'reveal':
      return revealMove(state, fixture, event.nowMs);
    case 'continue':
      return continueSession(state, fixture, event.nowMs);
    case 'start-retest':
      return startRetest(state, fixture, event.nowMs);
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
              : 'All in-memory fixture work for this session is complete.',
        },
      };
    case 'abandon':
      return { ...state, status: 'abandoned', feedback: undefined };
    case 'restart':
      return createTrainingSession(fixture, event.nowMs);
  }
}

export function currentFixtureStep(
  state: TrainingSessionState,
  fixture: TrainingFixture,
): TrainingFixtureMove | null {
  return fixtureStep(fixture, state.plyIndex);
}

export function hintDisclosure(
  state: TrainingSessionState,
  fixture: TrainingFixture,
): string | null {
  const step = fixtureStep(fixture, state.plyIndex);
  if (!step || step.actor !== 'user' || !step.hint || state.hintLevel === 0)
    return null;

  if (state.hintLevel === 1) {
    return `Piece: ${step.hint.piece}.`;
  }
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
