import { PHASE6_CONTRAST_MAPPING_POLICY_VERSION } from '../../domain/phase6/contrast';
import type {
  ContrastReviewLogRecord,
  ContrastReviewResult,
  ContrastSessionRecord,
  IndependentSchedulerDecisionRecord,
} from '../../domain/phase6/types';
import { queryAcceptedMoves } from '../../domain/repertoire/graph';
import type { SchedulerGrade } from '../../domain/scheduling/schedulerPort';
import {
  assertIndependentSchedulerStateRecord,
  PHASE6_CONTRAST_POLICY_VERSION,
} from './phase6Validation';
import { Phase6ContrastSessionRepository } from './phase6RepositoryContrastSession';
import { breadcrumb, nowIso } from './phase6RepositoryCore';

export class Phase6ContrastRecallRepository extends Phase6ContrastSessionRepository {
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
        const item = await this.database.contrastItems.get(
          existing.contrastItemId,
        );
        if (!item || !session) {
          throw new Error(
            'Committed contrast review references missing durable state.',
          );
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
      const item = itemId
        ? await this.database.contrastItems.get(itemId)
        : undefined;
      if (!item) throw new Error('Contrast item is missing.');
      const graph = await this.base.loadCompleteGraph();
      const context = graph.contexts.find(
        (row) => row.id === item.expectedContextId,
      );
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
      const outcome = options.reveal
        ? 'revealed'
        : playedUci && accepted.moves.some((move) => move.uci === playedUci)
          ? 'correct'
          : 'incorrect';
      const grade: SchedulerGrade = outcome === 'correct' ? 'Good' : 'Again';
      const observedAt = options.observedAt ?? nowIso();
      const priorState = await this.database.contrastSchedulerStates.get(item.id);
      if (!priorState) throw new Error('Contrast scheduler state is missing.');
      assertIndependentSchedulerStateRecord(
        priorState,
        PHASE6_CONTRAST_POLICY_VERSION,
      );
      if (
        priorState.adapterVersion !== this.scheduler.adapterVersion ||
        priorState.parametersVersion !== this.scheduler.parametersVersion ||
        priorState.mappingPolicyVersion !== PHASE6_CONTRAST_MAPPING_POLICY_VERSION
      ) {
        throw new Error(
          'Contrast scheduler configuration is incompatible with this build.',
        );
      }
      const reviewed = this.scheduler.review(
        priorState.state,
        grade,
        new Date(observedAt),
      );
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
      const nextSession: ContrastSessionRecord = {
        ...session,
        currentIndex: nextIndex,
        status: nextIndex >= session.itemIds.length ? 'complete' : 'active',
        committedObservationIds: [
          ...session.committedObservationIds,
          observationId,
        ],
        updatedAt: observedAt,
        ...(nextIndex >= session.itemIds.length
          ? { completedAt: observedAt }
          : {}),
      };
      await this.database.transaction(
        'rw',
        [
          this.database.contrastReviewLogs,
          this.database.contrastSchedulerStates,
          this.database.contrastSchedulerDecisions,
          this.database.contrastSessions,
        ],
        async () => {
          await this.database.contrastReviewLogs.add(review);
          await this.database.contrastSchedulerStates.put({
            ...priorState,
            state: reviewed.state,
            updatedAt: observedAt,
          });
          await this.database.contrastSchedulerDecisions.add(decision);
          await this.database.contrastSessions.put(nextSession);
        },
      );
      const confusedContext = graph.contexts.find(
        (row) => row.id === item.confusedContextId,
      );
      return {
        accepted: outcome === 'correct',
        outcome,
        expectedSan: accepted.moves.map((move) => move.san),
        confusedBranchLabel: confusedContext
          ? breadcrumb(graph, confusedContext.id)
          : item.confusedContextId,
        complete: nextSession.status === 'complete',
      };
    });
  }
}
