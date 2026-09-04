import {
  normalizeOpeningName,
  openingNameMatches,
  OPENING_NAME_MAPPING_POLICY_VERSION,
} from '../../domain/phase6/nameRecall';
import type {
  IndependentSchedulerDecisionRecord,
  NamePrompt,
  NameReviewLogRecord,
  NameReviewResult,
  NameSessionRecord,
  NameTrainingItemRecord,
  TrainingScope,
} from '../../domain/phase6/types';
import type { SchedulerGrade } from '../../domain/scheduling/schedulerPort';
import { assertIndependentSchedulerStateRecord, PHASE6_NAME_POLICY_VERSION } from './phase6Validation';
import { Phase6TrainingRepository } from './phase6RepositoryTraining';
import { breadcrumb, nowIso, randomId } from './phase6RepositoryCore';

export class Phase6NameRecallRepository extends Phase6TrainingRepository {
  protected async eligibleNameItems(scope: TrainingScope, now: Date): Promise<NameTrainingItemRecord[]> {
    const { graph, playlist, availableIds } = await this.scopeGraph(scope);
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const names = new Map((await this.database.managedOpeningNames.toArray()).map((row) => [row.contextId, row]));
    const states = new Map((await this.database.nameSchedulerStates.toArray()).map((row) => [row.itemId, row]));
    return (await this.database.nameTrainingItems.toArray())
      .filter((item) => item.status === 'active' && availableIds.includes(item.repertoireId))
      .filter((item) => {
        const context = contexts.get(item.contextId);
        const name = names.get(item.contextId);
        return Boolean(context && name && !name.archivedAt && this.contextAllowed(graph, scope, playlist, context));
      })
      .filter((item) => {
        const state = states.get(item.id);
        return Boolean(state && (state.state.stage === 'new' || this.scheduler.isDue(state.state, now)));
      })
      .sort((a, b) => {
        const sa = states.get(a.id)!.state;
        const sb = states.get(b.id)!.state;
        const an = sa.stage === 'new';
        const bn = sb.stage === 'new';
        if (an !== bn) return an ? 1 : -1;
        return sa.dueAt.localeCompare(sb.dueAt) || a.id.localeCompare(b.id);
      });
  }
  private async namePrompt(session: NameSessionRecord): Promise<NamePrompt> {
    if (session.status !== 'active') throw new Error('Name session is not active.');
    const itemId = session.itemIds[session.currentIndex];
    const item = itemId ? await this.database.nameTrainingItems.get(itemId) : undefined;
    if (!item) throw new Error('Name session item is missing.');
    const context = await this.database.repertoireContexts.get(item.contextId);
    const position = context ? await this.database.positions.get(context.entryPositionId) : undefined;
    const repertoire = await this.database.repertoires.get(item.repertoireId);
    if (!context || !position || !repertoire) throw new Error('Name prompt graph state is missing.');
    const graph = await this.base.loadCompleteGraph();
    return {
      sessionId: session.id,
      itemIndex: session.currentIndex,
      itemId: item.id,
      repertoireId: item.repertoireId,
      contextId: item.contextId,
      fen: position.fen,
      breadcrumb: breadcrumb(graph, context.id),
      orientation: repertoire.userColour,
    };
  }
  public startNameSession(
    scope: TrainingScope,
    options: { targetCount?: number; now?: Date } = {},
  ): Promise<NamePrompt> {
    this.assertWritable();
    return this.enqueue(async () => {
      const now = options.now ?? new Date();
      const items = (await this.eligibleNameItems(scope, now)).slice(0, options.targetCount ?? 8);
      if (items.length === 0) throw new Error('No opening-name reviews are due or new in this scope.');
      const timestamp = now.toISOString();
      const session: NameSessionRecord = {
        id: randomId('name-session'),
        scope,
        itemIds: items.map((row) => row.id),
        currentIndex: 0,
        status: 'active',
        committedObservationIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.database.nameSessions.add(session);
      return this.namePrompt(session);
    });
  }
  public resumeNameSession(id: string): Promise<NamePrompt> {
    return this.enqueue(async () => {
      const session = await this.database.nameSessions.get(id);
      if (!session || session.status !== 'active') throw new Error('Interrupted name session is unavailable.');
      return this.namePrompt(session);
    });
  }
  public nextNamePrompt(id: string): Promise<NamePrompt | null> {
    return this.enqueue(async () => {
      const session = await this.database.nameSessions.get(id);
      if (!session || session.status !== 'active') return null;
      return this.namePrompt(session);
    });
  }
  public reviewName(
    sessionId: string,
    itemIndex: number,
    answer: string,
    responseTimeMs: number,
    options: { reveal?: boolean; observedAt?: string } = {},
  ): Promise<NameReviewResult> {
    this.assertWritable();
    return this.enqueue(async () => {
      const observationId = `name-review:${sessionId}:${itemIndex}`;
      const existing = await this.database.nameReviewLogs.get(observationId);
      if (existing) {
        const item = await this.database.nameTrainingItems.get(
          existing.nameTrainingItemId,
        );
        const savedSession = await this.database.nameSessions.get(sessionId);
        if (!item || !savedSession) {
          throw new Error('Committed name review references missing durable state.');
        }
        return {
          accepted: existing.outcome === 'accepted',
          outcome: existing.outcome,
          expectedPrimaryLabel: item.primaryLabel,
          expectedAliases: item.aliases,
          complete: savedSession.status === 'complete',
        };
      }
      const session = await this.database.nameSessions.get(sessionId);
      if (
        !session ||
        session.status !== 'active' ||
        session.currentIndex !== itemIndex
      ) {
        throw new Error('Name review does not match the active session item.');
      }
      const itemId = session.itemIds[itemIndex];
      const item = itemId
        ? await this.database.nameTrainingItems.get(itemId)
        : undefined;
      if (!item) throw new Error('Name training item is missing.');
      const observedAt = options.observedAt ?? nowIso();
      const outcome = options.reveal
        ? 'revealed'
        : openingNameMatches(answer, item.answerSetKey)
          ? 'accepted'
          : 'incorrect';
      const accepted = outcome === 'accepted';
      const grade: SchedulerGrade = accepted ? 'Good' : 'Again';
      const priorState = await this.database.nameSchedulerStates.get(item.id);
      if (!priorState) throw new Error('Name scheduler state is missing.');
      assertIndependentSchedulerStateRecord(priorState, PHASE6_NAME_POLICY_VERSION);
      if (priorState.adapterVersion !== this.scheduler.adapterVersion || priorState.parametersVersion !== this.scheduler.parametersVersion || priorState.mappingPolicyVersion !== OPENING_NAME_MAPPING_POLICY_VERSION) {
        throw new Error('Opening-name scheduler configuration is incompatible with this build.');
      }
      let nextSession = session;
      {
        const reviewed = this.scheduler.review(priorState.state, grade, new Date(observedAt));
        const review: NameReviewLogRecord = {
          id: observationId,
          nameTrainingItemId: item.id,
          sessionId,
          itemIndex,
          observedAt,
          responseTimeMs: Math.max(0, responseTimeMs),
          outcome,
          normalizedAnswer: options.reveal ? '' : normalizeOpeningName(answer),
          expectedAnswerSetKey: item.answerSetKey,
        };
        const decision: IndependentSchedulerDecisionRecord = {
          id: observationId,
          observationId,
          itemId: item.id,
          grade,
          policyVersion: OPENING_NAME_MAPPING_POLICY_VERSION,
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
        await this.database.transaction('rw', [this.database.nameReviewLogs, this.database.nameSchedulerStates, this.database.nameSchedulerDecisions, this.database.nameSessions], async () => {
          await this.database.nameReviewLogs.add(review);
          await this.database.nameSchedulerStates.put({ ...priorState, state: reviewed.state, updatedAt: observedAt });
          await this.database.nameSchedulerDecisions.add(decision);
          await this.database.nameSessions.put(nextSession);
        });
      }
      return {
        accepted,
        outcome,
        expectedPrimaryLabel: item.primaryLabel,
        expectedAliases: item.aliases,
        complete: nextSession.status === 'complete',
      };
    });
  }
  public abandonNameSession(id: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const session = await this.database.nameSessions.get(id);
      if (!session || session.status !== 'active') return;
      await this.database.nameSessions.put({ ...session, status: 'abandoned', updatedAt: now, completedAt: now });
    });
  }
}
