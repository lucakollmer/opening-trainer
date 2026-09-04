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
import { generateAdaptiveSessionSelection, type TrainingCandidateSnapshot } from '../../domain/scheduling/sessionGenerator';
import type { AdaptiveExercisePlan, AdaptiveSessionPlan } from '../../domain/scheduling/adaptiveSession';
import type { AdaptiveExerciseDescriptor, TrainingSessionState } from '../../domain/training/session';
import type { SessionRecord, TrainingItemRecord } from './openingTrainerDatabase';
import { Phase6AnnotationsRepository } from './phase6RepositoryAnnotations';
import { contextPath, nowIso, stableHash, unique } from './phase6RepositoryCore';

const FAILURE_OUTCOMES = new Set(['wrong-variation', 'outside-repertoire', 'revealed']);

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

export class Phase6TrainingRepository extends Phase6AnnotationsRepository {
  protected async moveCandidateRows(
    scope: TrainingScope,
    mode: Exclude<PromptMode, 'name' | 'contrast'>,
    now: Date,
    seed: string,
  ): Promise<Array<{ repertoireId: string; contextId: string; item: TrainingItemRecord; snapshot: TrainingCandidateSnapshot }>> {
    const { graph, playlist, availableIds } = await this.scopeGraph(scope);
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const states = new Map((await this.database.schedulerStates.toArray()).map((row) => [row.trainingItemId, row]));
    const reviews = await this.database.reviewLogs.toArray();
    const items = (await this.database.trainingItems.toArray()).filter((row) => row.status === 'active' && row.promptMode === mode && availableIds.includes(row.repertoireId));
    const result: Array<{ repertoireId: string; contextId: string; item: TrainingItemRecord; snapshot: TrainingCandidateSnapshot }> = [];
    for (const item of items) {
      const eligibleContexts = item.contextIds
        .map((id) => contexts.get(id))
        .filter((row): row is RepertoireContext => Boolean(row))
        .filter((row) => this.contextAllowed(graph, scope, playlist, row));
      if (eligibleContexts.length === 0) continue;
      const context = [...eligibleContexts].sort((a, b) => stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`) || a.id.localeCompare(b.id))[0]!;
      const state = states.get(item.id);
      if (!state) continue;
      const targeted = reviews.filter((review) => review.trainingItemId === item.id && review.evidenceRole === 'targeted').sort((a, b) => b.observedAt.localeCompare(a.observedAt));
      const failure = targeted.find((review) => FAILURE_OUTCOMES.has(review.outcome));
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
          prefixKey: `${item.repertoireId}:${contextPath(context.id, contexts).slice(0, 3).map((row) => row.id).join('>')}`,
          ...(failure ? { recentFailureAt: failure.observedAt } : {}),
          ...(targeted[0] ? { lastTargetedAt: targeted[0].observedAt } : {}),
          confusionCount: 0,
        },
      });
    }
    return result;
  }
  public createMoveSessionPlan(scope: TrainingScope, options: MoveSessionOptions = {}): Promise<AdaptiveSessionPlan> {
    return this.enqueue(async () => {
      const now = options.now ?? new Date();
      const seed = options.seed ?? `phase6-${now.toISOString()}`;
      const mode = options.mode ?? 'normal';
      const targetCount = options.targetCount ?? 8;
      const newItemLimit = options.newItemLimit ?? 3;
      const { graph, playlist, availableIds } = await this.scopeGraph(scope);
      if (availableIds.length === 0) throw new Error('This training scope has no available repertoires.');
      if (mode !== 'normal') {
        // Preserve PHASE-5 guided/strict behavior for single-repertoire scopes.
        if (scope.kind !== 'repertoire') throw new Error('Guided/strict multi-repertoire playlist sessions are not available in PHASE-6.');
        return this.base.createAdaptiveSessionPlan(scope.id, { ...options, mode });
      }
      if (scope.kind === 'playlist') await this.materializePlaylistNormalItems(scope.id, now.toISOString());
      const rows = await this.moveCandidateRows(scope, mode, now, seed);
      const chosen: typeof rows = [];
      const byRep = new Map<string, typeof rows>();
      for (const id of availableIds) byRep.set(id, rows.filter((row) => row.repertoireId === id));
      const selectedByRep = new Map<string, typeof rows>();
      for (const [id, candidates] of byRep) {
        if (candidates.length === 0) continue;
        const selection = generateAdaptiveSessionSelection(candidates.map((row) => row.snapshot), {
          repertoireId: id,
          ...(scope.kind === 'playlist' ? { playlistId: scope.id } : {}),
          mode,
          targetCount,
          newItemLimit,
          now,
          seed: `${seed}:${id}`,
          ...(options.allowReinforcement ? { allowReinforcement: true } : {}),
        });
        const byItem = new Map(candidates.map((row) => [row.item.id, row]));
        selectedByRep.set(id, selection.selected.map((row) => byItem.get(row.trainingItemId)!).filter(Boolean));
      }
      if (playlist?.weighting.kind === 'balanced') {
        while (chosen.length < targetCount && [...selectedByRep.values()].some((rowsForRep) => rowsForRep.length > 0)) {
          for (const id of availableIds) {
            const next = selectedByRep.get(id)?.shift();
            if (next) chosen.push(next);
            if (chosen.length >= targetCount) break;
          }
        }
      } else {
        const all = [...selectedByRep.values()].flat();
        all.sort((a, b) => {
          const aNew = a.snapshot.schedulerState.stage === 'new';
          const bNew = b.snapshot.schedulerState.stage === 'new';
          if (aNew !== bNew) return aNew ? 1 : -1;
          return new Date(a.snapshot.schedulerState.dueAt).getTime() - new Date(b.snapshot.schedulerState.dueAt).getTime() || a.item.id.localeCompare(b.item.id);
        });
        chosen.push(...all.slice(0, targetCount));
      }
      const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
      const exercises: AdaptiveExercisePlan[] = chosen.map((row) => {
        const path = contextPath(row.contextId, contexts);
        const rootContextId = path[0]?.id;
        if (!rootContextId) throw new Error(`Cannot resolve root for ${row.contextId}.`);
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
          plan: createPhase6GraphExercisePlan(graph, descriptor as GraphExercisePlanOptions),
        };
      });
      return {
        generatorVersion: 'adaptive-generator-v1',
        seed,
        requestedTargetCount: targetCount,
        newItemLimit,
        exercises,
      };
    });
  }
  public async rebuildMoveExercise(descriptor: AdaptiveExerciseDescriptor): Promise<AdaptiveExercisePlan> {
    await this.awaitPendingOperations();
    const graph = await this.base.loadCompleteGraph();
    const rules = await this.database.decisionRules.toArray();
    const targetTrainingItemIds = unique(descriptor.targetContextIds.flatMap((contextId) => rules.filter((rule) => rule.contextId === contextId && rule.promptMode === descriptor.promptMode && (rule.playlistId ?? undefined) === (descriptor.playlistId ?? undefined)).map((rule) => rule.trainingItemId)));
    return {
      descriptor,
      targetTrainingItemIds,
      plan: createPhase6GraphExercisePlan(graph, descriptor as GraphExercisePlanOptions),
    };
  }
  public async rebuildLegacyMoveSession(record: SessionRecord): Promise<LegacyMoveRecovery> {
    await this.awaitPendingOperations();
    const itemIds = record.targetIdentityKind === 'training-item' ? record.targetIds : record.state.targetTrainingItemIds;
    const items = (await Promise.all(itemIds.map((id) => this.database.trainingItems.get(id)))).filter((row): row is TrainingItemRecord => Boolean(row));
    const item = items[0];
    if (!item) throw new Error('Legacy move session target identity is no longer available.');
    const graph = await this.base.loadCompleteGraph();
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const targetContextId = item.contextIds.find((id) => contexts.has(id));
    if (!targetContextId) throw new Error('Legacy move session target context is no longer available.');
    const path = contextPath(targetContextId, contexts);
    const rootContextId = path[0]?.id;
    if (!rootContextId) throw new Error('Legacy move session root context is unavailable.');
    const scope: TrainingScope = { kind: 'repertoire', id: item.repertoireId };
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
      plan: createPhase6GraphExercisePlan(graph, descriptor as GraphExercisePlanOptions),
    };
    if (exercise.plan.id !== record.planId) throw new Error('SESSION_SCOPE_LOCKED: legacy move session can no longer be reconstructed with its original semantics.');
    return { scope, exercise };
  }
  public saveMoveSession(state: TrainingSessionState, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(() => this.base.saveSession(state, now));
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
