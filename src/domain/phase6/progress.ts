import { contextPly } from '../repertoire/graph';
import type { RepertoireContext, RepertoireGraph } from '../repertoire/types';
import type { SchedulerState } from '../scheduling/schedulerPort';
import type { ReviewObservation } from '../training/session';
import type {
  BranchProgressSummary,
  BrowseTreeNode,
  DecisionProgress,
} from './types';

export const PHASE6_WEAK_RETRIEVABILITY_THRESHOLD = 0.82;
export const PHASE6_RECENT_FAILURE_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const FAILURE_OUTCOMES = new Set([
  'wrong-variation',
  'outside-repertoire',
  'revealed',
]);

export interface ProgressTrainingItem {
  id: string;
  contextIds: readonly string[];
  promptMode: string;
  status: 'active' | 'superseded';
  playlistIds?: readonly string[];
  updatedAt?: string;
}

export interface ProgressSchedulerRecord {
  trainingItemId: string;
  state: SchedulerState;
  retrievability: number;
}

export interface ProgressInputs {
  graph: RepertoireGraph;
  repertoireId: string;
  items: readonly ProgressTrainingItem[];
  scheduler: readonly ProgressSchedulerRecord[];
  reviews: readonly ReviewObservation[];
  now: Date;
  currentContextId?: string;
  playlistId?: string;
  playlistEligibleContextIds?: ReadonlySet<string>;
}

function emptySummary(): BranchProgressSummary {
  return {
    decisions: 0,
    new: 0,
    learning: 0,
    mature: 0,
    due: 0,
    weak: 0,
    neverTrained: 0,
  };
}

function minDate(
  left: string | undefined,
  right: string | undefined,
): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) <= 0 ? left : right;
}

export function decisionProgress(
  scheduler: ProgressSchedulerRecord | undefined,
  reviews: readonly ReviewObservation[],
  now: Date,
): DecisionProgress {
  const state = scheduler?.state;
  const targeted = reviews.filter((review) => review.evidenceRole === 'targeted');
  const recentFailure = targeted.some((review) => {
    if (!FAILURE_OUTCOMES.has(review.outcome)) return false;
    const observed = new Date(review.observedAt).getTime();
    const age = now.getTime() - observed;
    return Number.isFinite(observed) && age >= 0 && age <= PHASE6_RECENT_FAILURE_WINDOW_DAYS * DAY_MS;
  });
  const lifecycle: DecisionProgress['lifecycle'] =
    !state || state.stage === 'new'
      ? 'new'
      : state.stage === 'learning' || state.stage === 'relearning'
        ? 'learning'
        : 'mature';
  return {
    lifecycle,
    due: Boolean(
      state &&
        state.stage !== 'new' &&
        new Date(state.dueAt).getTime() <= now.getTime(),
    ),
    weak: Boolean(
      state &&
        state.stage !== 'new' &&
        ((scheduler?.retrievability ?? 1) <
          PHASE6_WEAK_RETRIEVABILITY_THRESHOLD ||
          recentFailure),
    ),
    everTrained: targeted.length > 0,
    ...(state ? { nextDueAt: state.dueAt } : {}),
  };
}

function mergeDecision(
  summary: BranchProgressSummary,
  progress: DecisionProgress,
): BranchProgressSummary {
  return {
    decisions: summary.decisions + 1,
    new: summary.new + (progress.lifecycle === 'new' ? 1 : 0),
    learning: summary.learning + (progress.lifecycle === 'learning' ? 1 : 0),
    mature: summary.mature + (progress.lifecycle === 'mature' ? 1 : 0),
    due: summary.due + (progress.due ? 1 : 0),
    weak: summary.weak + (progress.weak ? 1 : 0),
    neverTrained: summary.neverTrained + (progress.everTrained ? 0 : 1),
    nextDueAt: minDate(summary.nextDueAt, progress.nextDueAt),
  };
}

function scopeRank(
  item: ProgressTrainingItem,
  playlistId: string | undefined,
): number {
  const playlistIds = item.playlistIds ?? [];
  if (!playlistId) return playlistIds.length === 0 ? 0 : 99;
  if (playlistIds.includes(playlistId)) return 0;
  return playlistIds.length === 0 ? 1 : 99;
}

function preferredContextItemIds(
  items: readonly ProgressTrainingItem[],
  playlistId: string | undefined,
): Map<string, string[]> {
  const candidates = new Map<string, ProgressTrainingItem[]>();
  for (const item of items.filter((row) => row.promptMode === 'normal')) {
    if (scopeRank(item, playlistId) >= 99) continue;
    for (const contextId of item.contextIds) {
      const list = candidates.get(contextId) ?? [];
      list.push(item);
      candidates.set(contextId, list);
    }
  }
  const result = new Map<string, string[]>();
  for (const [contextId, rows] of candidates) {
    const active = rows.filter((row) => row.status === 'active');
    const pool = active.length > 0 ? active : rows;
    const bestRank = Math.min(...pool.map((row) => scopeRank(row, playlistId)));
    const ranked = pool
      .filter((row) => scopeRank(row, playlistId) === bestRank)
      .sort(
        (a, b) =>
          (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') ||
          a.id.localeCompare(b.id),
      );
    const chosen = ranked[0];
    if (chosen) result.set(contextId, [chosen.id]);
  }
  return result;
}

export function buildBrowseTreeWithProgress(
  inputs: ProgressInputs,
): readonly BrowseTreeNode[] {
  const repertoire = inputs.graph.repertoires.find(
    (row) => row.id === inputs.repertoireId,
  );
  if (!repertoire) throw new Error(`Missing repertoire ${inputs.repertoireId}.`);
  const contexts = new Map(inputs.graph.contexts.map((row) => [row.id, row]));
  const edges = new Map(inputs.graph.edges.map((row) => [row.id, row]));
  const incomingMoves = new Map(
    inputs.graph.moves.map((move) => [move.destinationContextId, move]),
  );
  const occurrences = new Map<string, number>();
  inputs.graph.contexts
    .filter((row) => row.repertoireId === inputs.repertoireId)
    .forEach((row) =>
      occurrences.set(
        row.entryPositionId,
        (occurrences.get(row.entryPositionId) ?? 0) + 1,
      ),
    );

  const children = new Map<string, RepertoireContext[]>();
  for (const context of inputs.graph.contexts) {
    if (
      context.repertoireId !== inputs.repertoireId ||
      !context.parentContextId
    ) {
      continue;
    }
    const list = children.get(context.parentContextId) ?? [];
    list.push(context);
    children.set(context.parentContextId, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => {
      const ma = incomingMoves.get(a.id);
      const mb = incomingMoves.get(b.id);
      return (
        (ma?.order ?? Number.MAX_SAFE_INTEGER) -
          (mb?.order ?? Number.MAX_SAFE_INTEGER) ||
        a.pathFingerprint.localeCompare(b.pathFingerprint) ||
        a.id.localeCompare(b.id)
      );
    });
  }

  const schedulerByItem = new Map(
    inputs.scheduler.map((row) => [row.trainingItemId, row]),
  );
  const reviewsByItem = new Map<string, ReviewObservation[]>();
  for (const review of inputs.reviews) {
    const list = reviewsByItem.get(review.trainingItemId) ?? [];
    list.push(review);
    reviewsByItem.set(review.trainingItemId, list);
  }
  const itemIdsByContext = preferredContextItemIds(
    inputs.items,
    inputs.playlistId,
  );
  const progressByItem = new Map<string, DecisionProgress>();
  for (const itemId of new Set([...itemIdsByContext.values()].flat())) {
    progressByItem.set(
      itemId,
      decisionProgress(
        schedulerByItem.get(itemId),
        reviewsByItem.get(itemId) ?? [],
        inputs.now,
      ),
    );
  }

  const effectiveIncluded = (context: RepertoireContext): boolean => {
    let current: RepertoireContext | undefined = context;
    const seen = new Set<string>();
    while (current) {
      if (!current.included || seen.has(current.id)) return false;
      seen.add(current.id);
      current = current.parentContextId
        ? contexts.get(current.parentContextId)
        : undefined;
    }
    return true;
  };

  const summaryForIds = (
    itemIds: ReadonlySet<string>,
  ): BranchProgressSummary => {
    let result = emptySummary();
    for (const itemId of itemIds) {
      const progress = progressByItem.get(itemId);
      if (progress) result = mergeDecision(result, progress);
    }
    return result;
  };

  const build = (
    context: RepertoireContext,
  ): { node: BrowseTreeNode; itemIds: ReadonlySet<string> } => {
    const childResults = (children.get(context.id) ?? []).map(build);
    const itemIds = new Set(itemIdsByContext.get(context.id) ?? []);
    for (const child of childResults) {
      child.itemIds.forEach((id) => itemIds.add(id));
    }
    const incoming = incomingMoves.get(context.id);
    const edge = incoming ? edges.get(incoming.edgeId) : undefined;
    const rootIndex = repertoire.rootContextIds.indexOf(context.id);
    return {
      itemIds,
      node: {
        id: `browse:${context.id}`,
        contextId: context.id,
        positionId: context.entryPositionId,
        repertoireId: context.repertoireId,
        ...(context.parentContextId
          ? { parentContextId: context.parentContextId }
          : {}),
        ...(incoming ? { incomingMoveId: incoming.id } : {}),
        ...(edge ? { incomingSan: edge.san } : {}),
        label:
          edge?.san ??
          context.label ??
          (rootIndex >= 0 ? `Line ${rootIndex + 1}` : 'Position'),
        ply: contextPly(context, contexts),
        explicitIncluded: context.included,
        effectiveIncluded: effectiveIncluded(context),
        playlistEligible:
          inputs.playlistEligibleContextIds?.has(context.id) ?? true,
        transposition: (occurrences.get(context.entryPositionId) ?? 0) > 1,
        current: context.id === inputs.currentContextId,
        progress: summaryForIds(itemIds),
        children: childResults.map((result) => result.node),
      },
    };
  };

  return repertoire.rootContextIds
    .map((id) => contexts.get(id))
    .filter((context): context is RepertoireContext => Boolean(context))
    .map((context) => build(context).node);
}
