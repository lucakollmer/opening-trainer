import {
  contrastPairId,
  contrastTrainingItemId,
  insideContrastWindow,
  PHASE6_CONTRAST_CONFUSION_THRESHOLD,
  PHASE6_CONTRAST_MAPPING_POLICY_VERSION,
} from '../../domain/phase6/contrast';
import type { ConfusionSummary, ContrastItemRecord, TrainingScope } from '../../domain/phase6/types';
import type { ReviewObservation } from '../../domain/training/session';
import type { TrainingItemRecord } from './openingTrainerDatabase';
import { Phase6NameRecallRepository } from './phase6RepositoryNameRecall';
import {
  breadcrumb,
  schedulerRecord,
  validConfusionPair,
} from './phase6RepositoryCore';

export class Phase6ConfusionRepository extends Phase6NameRecallRepository {
  protected async syncContrastItems(now: Date): Promise<void> {
    const [graph, allReviews, allItems] = await Promise.all([
      this.base.loadCompleteGraph(),
      this.database.reviewLogs.toArray(),
      this.database.trainingItems.toArray(),
    ]);
    const reviews = allReviews.filter(
      (review) =>
        review.evidenceRole === 'targeted' && Boolean(review.confusionContextId),
    );
    const items = new Map(allItems.map((row) => [row.id, row]));
    const grouped = new Map<
      string,
      {
        source: TrainingItemRecord;
        expectedContextId: string;
        confusedContextId: string;
        reviews: ReviewObservation[];
      }
    >();
    for (const review of reviews) {
      const source = items.get(review.trainingItemId);
      if (
        !source ||
        source.status !== 'active' ||
        source.promptMode !== 'normal' ||
        !review.confusionContextId
      ) {
        continue;
      }
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
      const group = grouped.get(key) ?? {
        source,
        expectedContextId,
        confusedContextId: review.confusionContextId,
        reviews: [],
      };
      group.reviews.push(review);
      grouped.set(key, group);
    }
    for (const group of grouped.values()) {
      const count = group.reviews.filter((review) =>
        insideContrastWindow(review.observedAt, now),
      ).length;
      if (count < PHASE6_CONTRAST_CONFUSION_THRESHOLD) continue;
      const id = contrastTrainingItemId(
        group.source.id,
        group.expectedContextId,
        group.confusedContextId,
      );
      const existing = await this.database.contrastItems.get(id);
      const record: ContrastItemRecord = existing ?? {
        id,
        pairId: contrastPairId(
          group.expectedContextId,
          group.confusedContextId,
        ),
        repertoireId: group.source.repertoireId,
        expectedContextId: group.expectedContextId,
        confusedContextId: group.confusedContextId,
        sourceTrainingItemId: group.source.id,
        status: 'active',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await this.database.contrastItems.put({
        ...record,
        status: 'active',
        updatedAt: now.toISOString(),
      });
      if (!(await this.database.contrastSchedulerStates.get(id))) {
        await this.database.contrastSchedulerStates.put(
          schedulerRecord(
            this.scheduler,
            id,
            PHASE6_CONTRAST_MAPPING_POLICY_VERSION,
            now.toISOString(),
          ),
        );
      }
    }
  }

  public listConfusions(
    scope: TrainingScope,
    now = new Date(),
  ): Promise<ConfusionSummary[]> {
    return this.enqueue(() => this.listConfusionsUnsafe(scope, now));
  }

  protected async listConfusionsUnsafe(
    scope: TrainingScope,
    now: Date,
  ): Promise<ConfusionSummary[]> {
    const { graph, playlist, availableIds } = await this.scopeGraph(scope);
    const [trainingItemRows, contrastItems, contrastStateRows, reviews, rules] =
      await Promise.all([
        this.database.trainingItems.toArray(),
        this.database.contrastItems.toArray(),
        this.database.contrastSchedulerStates.toArray(),
        this.database.reviewLogs.toArray(),
        this.database.decisionRules.toArray(),
      ]);
    const trainingItems = new Map(
      trainingItemRows.map((row) => [row.id, row]),
    );
    const contrastStates = new Map(
      contrastStateRows.map((row) => [row.itemId, row]),
    );
    const confusionReviews = reviews.filter(
      (review) =>
        review.evidenceRole === 'targeted' && Boolean(review.confusionContextId),
    );
    const contexts = new Map(graph.contexts.map((row) => [row.id, row]));
    const groups = new Map<string, ConfusionSummary>();

    const scopeAuthorizes = (
      source: TrainingItemRecord,
      expectedContextId: string | undefined,
    ): boolean => {
      if (!expectedContextId) {
        return (
          scope.kind === 'repertoire' &&
          source.repertoireId === scope.id &&
          (!source.playlistIds || source.playlistIds.length === 0)
        );
      }
      return rules.some(
        (rule) =>
          rule.contextId === expectedContextId &&
          rule.promptMode === 'normal' &&
          rule.trainingItemId === source.id &&
          (scope.kind === 'playlist'
            ? rule.playlistId === scope.id
            : rule.playlistId === undefined),
      );
    };

    for (const review of confusionReviews) {
      const source = trainingItems.get(review.trainingItemId);
      if (
        !source ||
        source.status !== 'active' ||
        source.promptMode !== 'normal' ||
        !availableIds.includes(source.repertoireId) ||
        !review.confusionContextId
      ) {
        continue;
      }
      const contextual = review as ReviewObservation & { contextId?: string };
      const expectedContextId =
        contextual.contextId ??
        (source.contextIds.length === 1 ? source.contextIds[0] : undefined);
      if (!scopeAuthorizes(source, expectedContextId)) continue;
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
      const expectedContext = expectedContextId
        ? contexts.get(expectedContextId)
        : undefined;
      if (
        expectedContext &&
        !this.contextAllowed(graph, scope, playlist, expectedContext)
      ) {
        continue;
      }
      const key = expectedContextId
        ? `${source.id}:${expectedContextId}:${review.confusionContextId}`
        : `legacy:${source.id}:${review.confusionContextId}`;
      const existing = groups.get(key);
      const count =
        (existing?.countInWindow ?? 0) +
        (insideContrastWindow(review.observedAt, now) ? 1 : 0);
      const contrastItem = expectedContextId
        ? contrastItems.find(
            (row) =>
              row.sourceTrainingItemId === source.id &&
              row.expectedContextId === expectedContextId &&
              row.confusedContextId === review.confusionContextId &&
              row.status === 'active',
          )
        : undefined;
      const state = contrastItem
        ? contrastStates.get(contrastItem.id)
        : undefined;
      const qualifies =
        Boolean(expectedContextId) &&
        count >= PHASE6_CONTRAST_CONFUSION_THRESHOLD;
      const contrastDue = qualifies
        ? contrastItem
          ? Boolean(
              state &&
                (state.state.stage === 'new' ||
                  this.scheduler.isDue(state.state, now)),
            )
          : true
        : false;
      groups.set(key, {
        id: key,
        repertoireId: source.repertoireId,
        ...(expectedContextId
          ? {
              expectedContextId,
              expectedLabel: breadcrumb(graph, expectedContextId),
            }
          : {}),
        confusedContextId: review.confusionContextId,
        confusedLabel: contexts.has(review.confusionContextId)
          ? breadcrumb(graph, review.confusionContextId)
          : review.confusionContextId,
        countInWindow: count,
        lastObservedAt:
          existing && existing.lastObservedAt > review.observedAt
            ? existing.lastObservedAt
            : review.observedAt,
        ...(contrastItem ? { contrastItemId: contrastItem.id } : {}),
        contrastDue,
        legacyAmbiguous: !expectedContextId,
      });
    }
    return [...groups.values()]
      .filter((row) => row.countInWindow > 0)
      .sort(
        (a, b) =>
          b.lastObservedAt.localeCompare(a.lastObservedAt) ||
          a.id.localeCompare(b.id),
      );
  }
}
