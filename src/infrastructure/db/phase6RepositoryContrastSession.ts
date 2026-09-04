import type { ContrastPrompt, ContrastSessionRecord, TrainingScope } from '../../domain/phase6/types';
import { Phase6ConfusionRepository } from './phase6RepositoryConfusions';
import { nowIso, randomId } from './phase6RepositoryCore';

export class Phase6ContrastSessionRepository extends Phase6ConfusionRepository {
  private async contrastPrompt(
    session: ContrastSessionRecord,
  ): Promise<ContrastPrompt> {
    if (session.status !== 'active') {
      throw new Error('Contrast session is not active.');
    }
    const itemId = session.itemIds[session.currentIndex];
    const item = itemId
      ? await this.database.contrastItems.get(itemId)
      : undefined;
    if (!item) throw new Error('Contrast session item is missing.');
    const context = await this.database.repertoireContexts.get(
      item.expectedContextId,
    );
    const position = context
      ? await this.database.positions.get(context.entryPositionId)
      : undefined;
    const repertoire = await this.database.repertoires.get(item.repertoireId);
    if (!context || !position || !repertoire) {
      throw new Error('Contrast prompt graph state is missing.');
    }
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
      await this.assertNoActiveRecallSession();
      const now = options.now ?? new Date();
      const targetCount = options.targetCount ?? 6;
      if (!Number.isInteger(targetCount) || targetCount < 1) {
        throw new Error('Contrast targetCount must be a positive integer.');
      }
      await this.syncContrastItems(now);
      const confusions = await this.listConfusionsUnsafe(scope, now);
      const itemIds = confusions
        .filter((row) => row.contrastDue && row.contrastItemId)
        .slice(0, targetCount)
        .map((row) => row.contrastItemId!);
      if (itemIds.length === 0) {
        throw new Error('No contrast drills are due in this scope.');
      }
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

  public resumeContrastSession(id: string): Promise<ContrastPrompt> {
    return this.enqueue(async () => {
      await this.assertNoActiveRecallSession({ kind: 'contrast', id });
      const session = await this.database.contrastSessions.get(id);
      if (!session || session.status !== 'active') {
        throw new Error('Interrupted contrast session is unavailable.');
      }
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

  public abandonContrastSession(id: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const session = await this.database.contrastSessions.get(id);
      if (!session || session.status !== 'active') return;
      await this.database.contrastSessions.put({
        ...session,
        status: 'abandoned',
        updatedAt: now,
        completedAt: now,
      });
    });
  }

  public async latestInterruptedAuxSession(): Promise<
    | { kind: 'name'; id: string; updatedAt: string }
    | { kind: 'contrast'; id: string; updatedAt: string }
    | undefined
  > {
    await this.awaitPendingOperations();
    const names = (
      await this.database.nameSessions.where('status').equals('active').toArray()
    ).map((row) => ({
      kind: 'name' as const,
      id: row.id,
      updatedAt: row.updatedAt,
    }));
    const contrasts = (
      await this.database.contrastSessions
        .where('status')
        .equals('active')
        .toArray()
    ).map((row) => ({
      kind: 'contrast' as const,
      id: row.id,
      updatedAt: row.updatedAt,
    }));
    return [...names, ...contrasts].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];
  }

  public async getAuxSessionScope(
    kind: 'name' | 'contrast',
    id: string,
  ): Promise<TrainingScope> {
    await this.awaitPendingOperations();
    const session =
      kind === 'name'
        ? await this.database.nameSessions.get(id)
        : await this.database.contrastSessions.get(id);
    if (!session) throw new Error(`Missing ${kind} session ${id}.`);
    return session.scope;
  }
}
