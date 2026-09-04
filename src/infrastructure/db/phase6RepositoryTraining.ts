import {
  createPhase6GraphExercisePlan,
  type GraphExercisePlanOptions,
} from '../../domain/phase6/exercisePlan';
import type { TrainingScope } from '../../domain/phase6/types';
import { contextPly } from '../../domain/repertoire/graph';
import type {
  PromptMode,
  RepertoireContext,
} from '../../domain/repertoire/types';
import {
  generateAdaptiveSessionSelection,
  type SelectedTrainingCandidate,
  type TrainingCandidateSnapshot,
} from '../../domain/scheduling/sessionGenerator';
import type {
  AdaptiveExercisePlan,
  AdaptiveSessionPlan,
} from '../../domain/scheduling/adaptiveSession';
import type {
  AdaptiveExerciseDescriptor,
  TrainingSessionState,
} from '../../domain/training/session';
import type {
  SessionRecord,
  TrainingItemRecord,
} from './openingTrainerDatabase';
import { Phase6AnnotationsRepository } from './phase6RepositoryAnnotations';
import {
  contextPath,
  nowIso,
  stableHash,
  unique,
} from './phase6RepositoryCore';

const FAILURE_OUTCOMES = new Set([
  'wrong-variation',
  'outside-repertoire',
  'revealed',
]);
const CLASS_ORDER: readonly SelectedTrainingCandidate['selectionClass'][] = [
  'repair',
  'weak-due',
  'due',
  'new',
  'contrast',
  'reinforcement',
];

export interface MoveSessionOptions {
  targetCount?: number;
  newItemLimit?: number;
  mode?: Exclude<PromptMode, 'name' | 'contrast'>;
  now?: Date;
  seed?: string;
  allowReinforcement?: boolean;
}

export interface LegacyMoveRecovery {
  scope: TrainingScope;
  exercise: AdaptiveExercisePlan;
}

type MoveCandidateRow = {
  repertoireId: string;
  contextId: string;
  item: TrainingItemRecord;
  snapshot: TrainingCandidateSnapshot;
};

type ClassifiedMoveCandidate = {
  selected: SelectedTrainingCandidate;
  row: MoveCandidateRow;
};

function balanceWithinSchedulerClasses(
  candidates: readonly ClassifiedMoveCandidate[],
  targetCount: number,
): MoveCandidateRow[] {
  const result: MoveCandidateRow[] = [];
  for (const selectionClass of CLASS_ORDER) {
    const classRows = candidates.filter(
      (candidate) => candidate.selected.selectionClass === selectionClass,
    );
    const buckets = new Map<string, ClassifiedMoveCandidate[]>();
    for (const candidate of classRows) {
      const key = `${candidate.row.repertoireId}\u0000${candidate.row.snapshot.prefixKey}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(candidate);
      buckets.set(key, bucket);
    }
    const keys = [...buckets.keys()].sort();
    let emitted = true;
    while (emitted && result.length < targetCount) {
      emitted = false;
      for (const key of keys) {
        const next = buckets.get(key)?.shift();
        if (!next) continue;
        result.push(next.row);
        emitted = true;
        if (result.length >= targetCount) break;
      }
    }
    if (result.length >= targetCount) break;
  }
  return result;
}

export class Phase6TrainingRepository extends Phase6AnnotationsRepository {
  protected async moveCandidateRows(
    scope: TrainingScope,
    mode: Exclude<PromptMode, 'name' | 'contrast'>,
    now: Date,
    seed: string,
  ): Promise<MoveCandidateRow[]> {
    const { graph, playlist, availableIds } = await this.scopeGraph(scope);
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const [stateRows, reviews, itemRows, decisionRules] = await Promise.all([
      this.database.schedulerStates.toArray(),
      this.database.reviewLogs.toArray(),
      this.database.trainingItems.toArray(),
      this.database.decisionRules.toArray(),
    ]);
    const states = new Map(
      stateRows.map((row) => [row.trainingItemId, row]),
    );
    const authorizedContextsByItem = new Map<string, Set<string>>();
    for (const rule of decisionRules) {
      if (rule.promptMode !== mode) continue;
      const scopeMatches =
        scope.kind === 'playlist'
          ? rule.playlistId === scope.id
          : rule.playlistId === undefined;
      if (!scopeMatches) continue;
      const set = authorizedContextsByItem.get(rule.trainingItemId) ?? new Set();
      set.add(rule.contextId);
      authorizedContextsByItem.set(rule.trainingItemId, set);
    }
    const items = itemRows.filter(
      (row) =>
        row.status === 'active' &&
        row.promptMode === mode &&
        availableIds.includes(row.repertoireId),
    );
    const result: MoveCandidateRow[] = [];
    for (const item of items) {
      const authorizedContexts = authorizedContextsByItem.get(item.id);
      if (!authorizedContexts || authorizedContexts.size === 0) continue;
      const eligibleContexts = item.contextIds
        .map((id) => contexts.get(id))
        .filter((row): row is RepertoireContext => Boolean(row))
        .filter(
          (row) =>
            authorizedContexts.has(row.id) &&
            this.contextAllowed(graph, scope, playlist, row),
        );
      if (eligibleContexts.length === 0) continue;
      const context = [...eligibleContexts].sort(
        (a, b) =>
          stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`) ||
          a.id.localeCompare(b.id),
      )[0]!;
      const state = states.get(item.id);
      if (!state) continue;
      const targeted = reviews
        .filter(
          (review) =>
            review.trainingItemId === item.id &&
            review.evidenceRole === 'targeted',
        )
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const failure = targeted.find((review) =>
        FAILURE_OUTCOMES.has(review.outcome),
      );
      result.push({
        repertoireId: item.repertoireId,
        contextId: context.id,
        item,
        snapshot: {
          trainingItemId: item.id,
          contextIds: eligibleContexts.map((row) => row.id),
          promptMode: item.promptMode,
          schedulerState: state.state,
          retrievability: this.scheduler.retrievability(state.state, now),
          depth: contextPly(context, contexts),
          prefixKey: `${item.repertoireId}:${contextPath(context.id, contexts)
            .slice(0, 3)
            .map((row) => row.id)
            .join('>')}`,
          ...(failure ? { recentFailureAt: failure.observedAt } : {}),
          ...(targeted[0] ? { lastTargetedAt: targeted[0].observedAt } : {}),
          confusionCount: 0,
        },
      });
    }
    return result;
  }

  public createMoveSessionPlan(
    scope: TrainingScope,
    options: MoveSessionOptions = {},
  ): Promise<AdaptiveSessionPlan> {
    return this.enqueue(async () => {
      await this.assertNoActiveRecallSession();
      const now = options.now ?? new Date();
      const seed = options.seed ?? `phase6-${now.toISOString()}`;
      const mode = options.mode ?? 'normal';
      const targetCount = options.targetCount ?? 8;
      const newItemLimit = options.newItemLimit ?? 3;
      if (!Number.isInteger(targetCount) || targetCount < 1) {
        throw new Error('Adaptive targetCount must be a positive integer.');
      }
      if (!Number.isInteger(newItemLimit) || newItemLimit < 0) {
        throw new Error('Adaptive newItemLimit must be a non-negative integer.');
      }
      const { graph, playlist, availableIds } = await this.scopeGraph(scope);
      if (availableIds.length === 0) {
        throw new Error('This training scope has no available repertoires.');
      }
      if (mode !== 'normal') {
        if (scope.kind !== 'repertoire') {
          throw new Error(
            'Guided/strict multi-repertoire playlist sessions are not available in PHASE-6.',
          );
        }
        return this.base.createAdaptiveSessionPlan(scope.id, {
          ...options,
          mode,
        });
      }
      if (scope.kind === 'playlist') {
        await this.materializePlaylistNormalItems(scope.id, now.toISOString());
      }
      const rows = await this.moveCandidateRows(scope, mode, now, seed);
      const selection = generateAdaptiveSessionSelection(
        rows.map((row) => row.snapshot),
        {
          repertoireId:
            scope.kind === 'repertoire' ? scope.id : `playlist:${scope.id}`,
          ...(scope.kind === 'playlist' ? { playlistId: scope.id } : {}),
          mode,
          targetCount: Math.max(1, rows.length),
          newItemLimit,
          now,
          seed,
          ...(options.allowReinforcement ? { allowReinforcement: true } : {}),
        },
      );
      const rowByItem = new Map(rows.map((row) => [row.item.id, row]));
      const classified = selection.selected.flatMap((selected) => {
        const row = rowByItem.get(selected.trainingItemId);
        return row ? [{ selected, row }] : [];
      });
      const chosen =
        playlist?.weighting.kind === 'balanced'
          ? balanceWithinSchedulerClasses(classified, targetCount)
          : classified.slice(0, targetCount).map((candidate) => candidate.row);
      const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
      const exercises: AdaptiveExercisePlan[] = chosen.map((row) => {
        const path = contextPath(row.contextId, contexts);
        const rootContextId = path[0]?.id;
        if (!rootContextId) {
          throw new Error(`Cannot resolve root for ${row.contextId}.`);
        }
        const descriptor: AdaptiveExerciseDescriptor = {
          repertoireId: row.repertoireId,
          rootContextId,
          targetContextId: row.contextId,
          targetContextIds: [row.contextId],
          promptMode: mode,
          ...(scope.kind === 'playlist' ? { playlistId: scope.id } : {}),
        };
        return {
          descriptor,
          targetTrainingItemIds: [row.item.id],
          plan: createPhase6GraphExercisePlan(
            graph,
            descriptor as GraphExercisePlanOptions,
          ),
        };
      });
      return {
        generatorVersion: selection.generatorVersion,
        seed,
        requestedTargetCount: targetCount,
        newItemLimit,
        exercises,
      };
    });
  }

  public async rebuildMoveExercise(
    descriptor: AdaptiveExerciseDescriptor,
  ): Promise<AdaptiveExercisePlan> {
    await this.awaitPendingOperations();
    const graph = await this.base.loadCompleteGraph();
    const rules = await this.database.decisionRules.toArray();
    const targetTrainingItemIds = unique(
      descriptor.targetContextIds.flatMap((contextId) =>
        rules
          .filter(
            (rule) =>
              rule.contextId === contextId &&
              rule.promptMode === descriptor.promptMode &&
              (rule.playlistId ?? undefined) ===
                (descriptor.playlistId ?? undefined),
          )
          .map((rule) => rule.trainingItemId),
      ),
    );
    return {
      descriptor,
      targetTrainingItemIds,
      plan: createPhase6GraphExercisePlan(
        graph,
        descriptor as GraphExercisePlanOptions,
      ),
    };
  }

  public async rebuildLegacyMoveSession(
    record: SessionRecord,
  ): Promise<LegacyMoveRecovery> {
    await this.awaitPendingOperations();
    const itemIds =
      record.targetIdentityKind === 'training-item'
        ? record.targetIds
        : record.state.targetTrainingItemIds;
    const items = (
      await Promise.all(
        itemIds.map((id) => this.database.trainingItems.get(id)),
      )
    ).filter((row): row is TrainingItemRecord => Boolean(row));
    const item = items[0];
    if (!item) {
      throw new Error('Legacy move session target identity is no longer available.');
    }
    const graph = await this.base.loadCompleteGraph();
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const targetContextId = item.contextIds.find((id) => contexts.has(id));
    if (!targetContextId) {
      throw new Error('Legacy move session target context is no longer available.');
    }
    const path = contextPath(targetContextId, contexts);
    const rootContextId = path[0]?.id;
    if (!rootContextId) {
      throw new Error('Legacy move session root context is unavailable.');
    }
    const scope: TrainingScope = {
      kind: 'repertoire',
      id: item.repertoireId,
    };
    const descriptor: AdaptiveExerciseDescriptor = {
      repertoireId: item.repertoireId,
      rootContextId,
      targetContextId,
      targetContextIds: [targetContextId],
      promptMode: item.promptMode,
    };
    const exercise: AdaptiveExercisePlan = {
      descriptor,
      targetTrainingItemIds: [item.id],
      plan: createPhase6GraphExercisePlan(
        graph,
        descriptor as GraphExercisePlanOptions,
      ),
    };
    if (exercise.plan.id !== record.planId) {
      throw new Error(
        'SESSION_SCOPE_LOCKED: legacy move session can no longer be reconstructed with its original semantics.',
      );
    }
    return { scope, exercise };
  }

  public saveMoveSession(
    state: TrainingSessionState,
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      await this.assertNoActiveRecallSession({
        kind: 'move',
        id: state.sessionId,
      });
      await this.base.saveSession(state, now);
    });
  }

  public latestInterruptedMoveSession(): Promise<SessionRecord | undefined> {
    return this.base.latestInterruptedSession();
  }

  public async getMoveSessionScope(record: SessionRecord): Promise<TrainingScope> {
    await this.awaitPendingOperations();
    return this.getMoveSessionScopeUnsafe(record);
  }

  public abandonMoveSession(id: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(() => this.base.markSessionAbandoned(id, now));
  }
}
