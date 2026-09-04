import type { SchedulerGrade, SchedulerState } from '../scheduling/schedulerPort';

export type TrainingScope =
  | { kind: 'repertoire'; id: string }
  | { kind: 'playlist'; id: string };

export interface RepertoireLifecycleRecord {
  id: string;
  archivedAt?: string;
  updatedAt: string;
}

export interface PlaylistLifecycleRecord {
  id: string;
  archivedAt?: string;
  updatedAt: string;
}

export interface ManagedOpeningNameRecord {
  id: string;
  repertoireId: string;
  contextId: string;
  primaryLabel: string;
  aliases: readonly string[];
  answerSetKey: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface NameTrainingItemRecord {
  id: string;
  repertoireId: string;
  contextId: string;
  positionKey: string;
  primaryLabel: string;
  aliases: readonly string[];
  answerSetKey: string;
  status: 'active' | 'superseded';
  createdAt: string;
  updatedAt: string;
}

export type NameOutcome = 'accepted' | 'incorrect' | 'revealed';

export interface NameReviewLogRecord {
  id: string;
  nameTrainingItemId: string;
  sessionId: string;
  itemIndex: number;
  observedAt: string;
  responseTimeMs: number;
  outcome: NameOutcome;
  normalizedAnswer: string;
  expectedAnswerSetKey: string;
}

export interface IndependentSchedulerStateRecord {
  id: string;
  itemId: string;
  state: SchedulerState;
  adapterVersion: string;
  parametersVersion: string;
  mappingPolicyVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface IndependentSchedulerDecisionRecord {
  id: string;
  observationId: string;
  itemId: string;
  grade: SchedulerGrade;
  policyVersion: string;
  adapterVersion: string;
  parametersVersion: string;
  decidedAt: string;
  previousDueAt: string;
  resultingDueAt: string;
  resultingState: SchedulerState;
}

export interface NameSessionRecord {
  id: string;
  scope: TrainingScope;
  itemIds: readonly string[];
  currentIndex: number;
  status: 'active' | 'complete' | 'abandoned';
  committedObservationIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface NamePrompt {
  sessionId: string;
  itemIndex: number;
  itemId: string;
  repertoireId: string;
  contextId: string;
  fen: string;
  breadcrumb: string;
  orientation: 'white' | 'black';
}

export interface NameReviewResult {
  accepted: boolean;
  outcome: NameOutcome;
  expectedPrimaryLabel: string;
  expectedAliases: readonly string[];
  complete: boolean;
}

export interface ContrastItemRecord {
  id: string;
  pairId: string;
  repertoireId: string;
  expectedContextId: string;
  confusedContextId: string;
  sourceTrainingItemId: string;
  status: 'active' | 'superseded';
  createdAt: string;
  updatedAt: string;
}

export type ContrastOutcome = 'correct' | 'incorrect' | 'revealed';

export interface ContrastReviewLogRecord {
  id: string;
  contrastItemId: string;
  sessionId: string;
  itemIndex: number;
  observedAt: string;
  responseTimeMs: number;
  outcome: ContrastOutcome;
  playedUci?: string;
}

export interface ContrastSessionRecord {
  id: string;
  scope: TrainingScope;
  itemIds: readonly string[];
  currentIndex: number;
  status: 'active' | 'complete' | 'abandoned';
  committedObservationIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ContrastPrompt {
  sessionId: string;
  itemIndex: number;
  itemId: string;
  repertoireId: string;
  expectedContextId: string;
  confusedContextId: string;
  fen: string;
  orientation: 'white' | 'black';
}

export interface ContrastReviewResult {
  accepted: boolean;
  outcome: ContrastOutcome;
  expectedSan: readonly string[];
  confusedBranchLabel: string;
  complete: boolean;
}

export interface DecisionProgress {
  lifecycle: 'new' | 'learning' | 'mature';
  due: boolean;
  weak: boolean;
  everTrained: boolean;
  nextDueAt?: string;
}

export interface BranchProgressSummary {
  decisions: number;
  new: number;
  learning: number;
  mature: number;
  due: number;
  weak: number;
  neverTrained: number;
  nextDueAt?: string;
}

export interface BrowseTreeNode {
  id: string;
  contextId: string;
  positionId: string;
  repertoireId: string;
  parentContextId?: string;
  incomingMoveId?: string;
  incomingSan?: string;
  label: string;
  ply: number;
  explicitIncluded: boolean;
  effectiveIncluded: boolean;
  playlistEligible: boolean;
  transposition: boolean;
  current: boolean;
  progress: BranchProgressSummary;
  children: readonly BrowseTreeNode[];
}

export interface ScopeQueueSummary {
  due: number;
  new: number;
  contrast: number;
  namesDue: number;
  namesNew: number;
}

export type PlaylistAvailability =
  | 'ready'
  | 'partially-unavailable'
  | 'unavailable'
  | 'archived';

export interface ManagedRepertoireSummary {
  id: string;
  name: string;
  userColour: 'white' | 'black';
  archived: boolean;
  trainable: boolean;
}

export interface ManagedPlaylistSummary {
  id: string;
  name: string;
  archived: boolean;
  availability: PlaylistAvailability;
  availableRepertoireIds: readonly string[];
  unavailableRepertoireIds: readonly string[];
}

export interface ManagementImpact {
  title: string;
  details: readonly string[];
  blockedReason?: string;
}

export interface ConfusionSummary {
  id: string;
  repertoireId: string;
  expectedContextId?: string;
  confusedContextId: string;
  expectedLabel?: string;
  confusedLabel?: string;
  countInWindow: number;
  lastObservedAt: string;
  contrastItemId?: string;
  contrastDue: boolean;
  legacyAmbiguous: boolean;
}

export interface BrowseWorkspaceSnapshot {
  scope: TrainingScope;
  repertoireId: string;
  tree: readonly BrowseTreeNode[];
  selectedContextId: string;
  selectedFen: string;
  selectedOrientation: 'white' | 'black';
  confusions: readonly ConfusionSummary[];
  queue: ScopeQueueSummary;
}
