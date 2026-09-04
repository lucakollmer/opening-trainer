import {
  contrastPairId,
  contrastTrainingItemId,
  insideContrastWindow,
  PHASE6_CONTRAST_CONFUSION_THRESHOLD,
  PHASE6_CONTRAST_MAPPING_POLICY_VERSION,
} from '../../domain/phase6/contrast';
import type {
  ConfusionSummary,
  ContrastItemRecord,
  ContrastPrompt,
  ContrastReviewLogRecord,
  ContrastReviewResult,
  ContrastSessionRecord,
  IndependentSchedulerDecisionRecord,
  TrainingScope,
} from '../../domain/phase6/types';
import { queryAcceptedMoves } from '../../domain/repertoire/graph';
import type { SchedulerGrade } from '../../domain/scheduling/schedulerPort';
import type { ReviewObservation } from '../../domain/training/session';
import type { TrainingItemRecord } from './openingTrainerDatabase';
import { assertIndependentSchedulerStateRecord, PHASE6_CONTRAST_POLICY_VERSION } from './phase6Validation';
import { Phase6NameRecallRepository } from './phase6RepositoryNameRecall';
import {
  breadcrumb,
  nowIso,
  randomId,
  schedulerRecord,
  validConfusionPair,
} from './phase6RepositoryCore';

export class Phase6ContrastRecallRepository extends Phase6NameRecallRepository {
  private async syncContrastItems(now: Date): Promise<void> {
    const [graph, allReviews, allItems] = await Promise.all([
      this.base.loadCompleteGraph(),
      this.database.reviewLogs.toArray(),
      this.database.trainingItems.toArray(),
    ]);
    const reviews = allReviews.filter((review) => Boolean(review.confusionContextId));
    const items = new Map(allItems.map((row) => [row.id, row]));
    const grouped = new Map<string, { source: TrainingItemRecord; expectedContextId: string; confusedContextId: string; reviews: ReviewObservation[] }>();
    for (const review of reviews) {
      const source = items.get(review.trainingItemId);
      if (!source || source.promptMode !== 'normal' || !review.confusionContextId) continue;
      const contextual = review as ReviewObservation & { contextId?: string };
      const expectedContextId =
        contextual.contextId ??
        (source.contextIds.length === 1 ? source.contextIds[0] : undefined);
      if (
        !expectedContextId ||
        !validConfusionPair(
          graph,
          source,
          expectedContextId,
          review.confusionContextId,
        )
      ) {
        continue;
      }
      const key = `${source.id}\u0000${expectedContextId}\u0000${review.confusionContextId}`;
      const group = grouped.get(key) ?? { source, expectedContextId, confusedContextId: review.confusionContextId, reviews: [] };
      group.reviews.push(review);
      grouped.set(key, group);
    }
    for (const group of grouped.values()) {
      const count = group.reviews.filter((review) => insideContrastWindow(review.observedAt, now)).length;
      if (count < PHASE6_CONTRAST_CONFUSION_THRESHOLD) continue;
      const id = contrastTrainingItemId(group.source.id, group.expectedContextId, group.confusedContextId);
      const existing = await this.database.contrastItems.get(id);
      const record: ContrastItemRecord = existing ?? {
        id,
        pairId: contrastPairId(group.expectedContextId, group.confusedContextId),
        repertoireId: group.source.repertoireId,
        expectedContextId: group.expectedContextId,
        confusedContextId: group.confusedContextId,
        sourceTrainingItemId: group.source.id,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await this.database.contrastItems.put({ ...record, status: 'active', updatedAt: now.toISOString() });
      if (!(await this.database.contrastSchedulerStates.get(id))) {
        await this.database.contrastSchedulerStates.put(schedulerRecord(this.scheduler, id, PHASE6_CONTRAST_MAPPING_POLICY_VERSION, now.toISOString()));
      }
    }
  }
  public listConfusions(
    scope: TrainingScope,
    now = new Date(),
  ): Promise<ConfusionSummary[]> {
    return this.enqueue(() => this.listConfusionsUnsafe(scope, now));
  }
  private async contrastPrompt(session: ContrastSessionRecord): Promise<ContrastPrompt> {
    if (session.status !== 'active') throw new Error('Contrast session is not active.');
    const itemId = session.itemIds[session.currentIndex];
    const item = itemId ? await this.database.contrastItems.get(itemId) : undefined;
    if (!item) throw new Error('Contrast session item is missing.');
    const context = await this.database.repertoireContexts.get(item.expectedContextId);
    const position = context ? await this.database.positions.get(context.entryPositionId) : undefined;
    const repertoire = await this.database.repertoires.get(item.repertoireId);
    if (!context || !position || !repertoire) throw new Error('Contrast prompt graph state is missing.');
    return {
      sessionId: session.id,
      itemIndex: session.currentIndex,
      itemId: item.id,
      repertoireId: item.repertoireId,
      expectedContextId: item.expectedContextId,
      confusedContextId: item.confusedContextId,
      fen: position.fen,
      orientation: repertoire.userColour,
    };
  }
  public startContrastSession(
    scope: TrainingScope,
    options: { targetCount?: number; now?: Date } = {},
  ): Promise<ContrastPrompt> {
    this.assertWritable();
    return this.enqueue(async () => {
      const now = options.now ?? new Date();
      const confusions = await this.listConfusionsUnsafe(scope, now);
      const itemIds = confusions.filter((row) => row.contrastDue && row.contrastItemId).slice(0, options.targetCount ?? 6).map((row) => row.contrastItemId!);
      if (itemIds.length === 0) throw new Error('No contrast drills are due in this scope.');
      const timestamp = now.toISOString();
      const session: ContrastSessionRecord = {
        id: randomId('contrast-session'),
        scope,
        itemIds,
        currentIndex: 0,
        status: 'active',
        committedObservationIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.database.contrastSessions.add(session);
      return this.contrastPrompt(session);
    });
  }
  protected async listConfusionsUnsafe(scope: TrainingScope, now: Date): Promise<ConfusionSummary[]> {
    await this.syncContrastItems(now);
    const { graph, playlist, availableIds } = await this.scopeGraph(scope);
    const trainingItems = new Map((await this.database.trainingItems.toArray()).map((row) => [row.id, row]));
    const contrastItems = await this.database.contrastItems.toArray();
    const contrastStates = new Map((await this.database.contrastSchedulerStates.toArray()).map((row) => [row.itemId, row]));
    const reviews = (await this.database.reviewLogs.toArray()).filter((review) => Boolean(review.confusionContextId));
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const groups = new Map<string, ConfusionSummary>();
    for (const review of reviews) {
      const source = trainingItems.get(review.trainingItemId);
      if (
        !source ||
        source.promptMode !== 'normal' ||
        !availableIds.includes(source.repertoireId) ||
        !this.trainingItemAllowedByScope(source, scope) ||
        !review.confusionContextId
      ) {
        continue;
      }
      const contextual = review as ReviewObservation & { contextId?: string };
      const expectedContextId =
        contextual.contextId ??
        (source.contextIds.length === 1 ? source.contextIds[0] : undefined);
      if (
        expectedContextId &&
        !validConfusionPair(
          graph,
          source,
          expectedContextId,
          review.confusionContextId,
        )
      ) {
        continue;
      }
      const expectedContext = expectedContextId ? contexts.get(expectedContextId) : undefined;
      if (expectedContext && !this.contextAllowed(graph, scope, playlist, expectedContext)) continue;
      const key = expectedContextId ? `${source.id}:${expectedContextId}:${review.confusionContextId}` : `legacy:${source.id}:${review.confusionContextId}`;
      const existing = groups.get(key);
      const count = (existing?.countInWindow ?? 0) + (insideContrastWindow(review.observedAt, now) ? 1 : 0);
      const contrastItem = expectedContextId ? contrastItems.find((row) => row.sourceTrainingItemId === source.id && row.expectedContextId === expectedContextId && row.confusedContextId === review.confusionContextId && row.status === 'active') : undefined;
      const state = contrastItem ? contrastStates.get(contrastItem.id) : undefined;
      groups.set(key, {
        id: key,
        repertoireId: source.repertoireId,
        ...(expectedContextId ? { expectedContextId, expectedLabel: breadcrumb(graph, expectedContextId) } : {}),
        confusedContextId: review.confusionContextId,
        confusedLabel: contexts.has(review.confusionContextId) ? breadcrumb(graph, review.confusionContextId) : review.confusionContextId,
        countInWindow: count,
        lastObservedAt: existing && existing.lastObservedAt > review.observedAt ? existing.lastObservedAt : review.observedAt,
        ...(contrastItem ? { contrastItemId: contrastItem.id } : {}),
        contrastDue: Boolean(contrastItem && state && count >= PHASE6_CONTRAST_CONFUSION_THRESHOLD && (state.state.stage === 'new' || this.scheduler.isDue(state.state, now))),
        legacyAmbiguous: !expectedContextId,
      });
    }
    return [...groups.values()].sort((a, b) => b.lastObservedAt.localeCompare(a.lastObservedAt) || a.id.localeCompare(b.id));
  }
  public resumeContrastSession(id: string): Promise<ContrastPrompt> {
    return this.enqueue(async () => {
      const session = await this.database.contrastSessions.get(id);
      if (!session || session.status !== 'active') throw new Error('Interrupted contrast session is unavailable.');
      return this.contrastPrompt(session);
    });
  }
  public nextContrastPrompt(id: string): Promise<ContrastPrompt | null> {
    return this.enqueue(async () => {
      const session = await this.database.contrastSessions.get(id);
      if (!session || session.status !== 'active') return null;
      return this.contrastPrompt(session);
    });
  }
  public reviewContrast(
    sessionId: string,
    itemIndex: number,
    playedUci: string | undefined,
    responseTimeMs: number,
    options: { reveal?: boolean; observedAt?: string } = {},
  ): Promise<ContrastReviewResult> {
    this.assertWritable();
    return this.enqueue(async () => {
      const observationId = `contrast-review:${sessionId}:${itemIndex}`;
      const existing = await this.database.contrastReviewLogs.get(observationId);
      const session = await this.database.contrastSessions.get(sessionId);
      if (existing) {
        const item = await this.database.contrastItems.get(existing.contrastItemId);
        if (!item || !session) {
          throw new Error('Committed contrast review references missing durable state.');
        }
        const graph = await this.base.loadCompleteGraph();
        const context = graph.contexts.find(
          (row) => row.id === item.expectedContextId,
        );
        if (!context) throw new Error('Contrast expected context is missing.');
        const acceptedMoves = queryAcceptedMoves(graph, {
          repertoireId: item.repertoireId,
          activeContextIds: [item.expectedContextId],
          ...(session.scope.kind === 'playlist'
            ? { playlistId: session.scope.id }
            : {}),
          positionId: context.entryPositionId,
          promptMode: 'normal',
        });
        const confusedContext = graph.contexts.find(
          (row) => row.id === item.confusedContextId,
        );
        return {
          accepted: existing.outcome === 'correct',
          outcome: existing.outcome,
          expectedSan: acceptedMoves.moves.map((move) => move.san),
          confusedBranchLabel: confusedContext
            ? breadcrumb(graph, confusedContext.id)
            : item.confusedContextId,
          complete: session.status === 'complete',
        };
      }
      if (
        !session ||
        session.status !== 'active' ||
        session.currentIndex !== itemIndex
      ) {
        throw new Error('Contrast review does not match the active session item.');
      }
      const itemId = session.itemIds[itemIndex];
      const item = itemId ? await this.database.contrastItems.get(itemId) : undefined;
      if (!item) throw new Error('Contrast item is missing.');
      const graph = await this.base.loadCompleteGraph();
      const context = graph.contexts.find((row) => row.id === item.expectedContextId);
      if (!context) throw new Error('Contrast expected context is missing.');
      const accepted = queryAcceptedMoves(graph, {
        repertoireId: item.repertoireId,
        activeContextIds: [item.expectedContextId],
        ...(session.scope.kind === 'playlist'
          ? { playlistId: session.scope.id }
          : {}),
        positionId: context.entryPositionId,
        promptMode: 'normal',
      });
      const outcome = options.reveal ? 'revealed' : playedUci && accepted.moves.some((move) => move.uci === playedUci) ? 'correct' : 'incorrect';
      const grade: SchedulerGrade = outcome === 'correct' ? 'Good' : 'Again';
      const observedAt = options.observedAt ?? nowIso();
      const priorState = await this.database.contrastSchedulerStates.get(item.id);
      if (!priorState) throw new Error('Contrast scheduler state is missing.');
      assertIndependentSchedulerStateRecord(priorState, PHASE6_CONTRAST_POLICY_VERSION);
      if (priorState.adapterVersion !== this.scheduler.adapterVersion || priorState.parametersVersion !== this.scheduler.parametersVersion || priorState.mappingPolicyVersion !== PHASE6_CONTRAST_MAPPING_POLICY_VERSION) {
        throw new Error('Contrast scheduler configuration is incompatible with this build.');
      }
      let nextSession = session;
      {
        const reviewed = this.scheduler.review(priorState.state, grade, new Date(observedAt));
        const review: ContrastReviewLogRecord = {
          id: observationId,
          contrastItemId: item.id,
          sessionId,
          itemIndex,
          observedAt,
          responseTimeMs: Math.max(0, responseTimeMs),
          outcome,
          ...(playedUci ? { playedUci } : {}),
        };
        const decision: IndependentSchedulerDecisionRecord = {
          id: observationId,
          observationId,
          itemId: item.id,
          grade,
          policyVersion: PHASE6_CONTRAST_MAPPING_POLICY_VERSION,
          adapterVersion: this.scheduler.adapterVersion,
          parametersVersion: this.scheduler.parametersVersion,
          decidedAt: observedAt,
          previousDueAt: priorState.state.dueAt,
          resultingDueAt: reviewed.state.dueAt,
          resultingState: reviewed.state,
        };
        const nextIndex = itemIndex + 1;
        nextSession = {
          ...session,
          currentIndex: nextIndex,
          status: nextIndex >= session.itemIds.length ? 'complete' : 'active',
          committedObservationIds: [...session.committedObservationIds, observationId],
          updatedAt: observedAt,
          ...(nextIndex >= session.itemIds.length ? { completedAt: observedAt } : {}),
        };
        await this.database.transaction('rw', [this.database.contrastReviewLogs, this.database.contrastSchedulerStates, this.database.contrastSchedulerDecisions, this.database.contrastSessions], async () => {
          await this.database.contrastReviewLogs.add(review);
          await this.database.contrastSchedulerStates.put({ ...priorState, state: reviewed.state, updatedAt: observedAt });
          await this.database.contrastSchedulerDecisions.add(decision);
          await this.database.contrastSessions.put(nextSession);
        });
      }
      const confusedContext = graph.contexts.find((row) => row.id === item.confusedContextId);
      return {
        accepted: outcome === 'correct',
        outcome,
        expectedSan: accepted.moves.map((move) => move.san),
        confusedBranchLabel: confusedContext ? breadcrumb(graph, confusedContext.id) : item.confusedContextId,
        complete: nextSession.status === 'complete',
      };
    });
  }
  public abandonContrastSession(id: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const session = await this.database.contrastSessions.get(id);
      if (!session || session.status !== 'active') return;
      await this.database.contrastSessions.put({ ...session, status: 'abandoned', updatedAt: now, completedAt: now });
    });
  }
  public async latestInterruptedAuxSession(): Promise<
    | { kind: 'name'; id: string; updatedAt: string }
    | { kind: 'contrast'; id: string; updatedAt: string }
    | undefined
  > {
    await this.awaitPendingOperations();
    const names = (await this.database.nameSessions.where('status').equals('active').toArray()).map((row) => ({ kind: 'name' as const, id: row.id, updatedAt: row.updatedAt }));
    const contrasts = (await this.database.contrastSessions.where('status').equals('active').toArray()).map((row) => ({ kind: 'contrast' as const, id: row.id, updatedAt: row.updatedAt }));
    return [...names, ...contrasts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }
  public async getAuxSessionScope(kind: 'name' | 'contrast', id: string): Promise<TrainingScope> {
    await this.awaitPendingOperations();
    const session = kind === 'name' ? await this.database.nameSessions.get(id) : await this.database.contrastSessions.get(id);
    if (!session) throw new Error(`Missing ${kind} session ${id}.`);
    return session.scope;
  }
}
