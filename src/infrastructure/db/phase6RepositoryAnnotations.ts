import {
  nameTrainingItemId,
  OPENING_NAME_MAPPING_POLICY_VERSION,
  validateOpeningNameLabels,
} from '../../domain/phase6/nameRecall';
import type { ManagedOpeningNameRecord, ManagementImpact } from '../../domain/phase6/types';
import { boundedText, validateTags } from '../../domain/phase6/validation';
import { Phase6ManagementRepository } from './phase6RepositoryManagement';
import { breadcrumb, nowIso, schedulerRecord } from './phase6RepositoryCore';

export class Phase6AnnotationsRepository extends Phase6ManagementRepository {
  public updateContextMetadata(
    contextId: string,
    patch: { note?: string; tags: readonly string[] },
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      await this.assertMutationUnlocked([context.repertoireId]);
      const note = boundedText(patch.note ?? '', 'Context note', 4_000, true);
      const tags = validateTags(patch.tags);
      await this.database.repertoireContexts.put({ ...context, ...(note ? { note } : { note: undefined }), tags });
      const graph = await this.base.loadCompleteGraph();
      for (const playlist of graph.playlists.filter((row) => row.repertoireIds.includes(context.repertoireId))) {
        if (playlist.tags.length > 0) await this.materializePlaylistNormalItems(playlist.id, now);
      }
    });
  }
  public updateMoveMetadata(
    moveId: string,
    patch: { note?: string; purpose?: string },
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const move = await this.database.repertoireMoves.get(moveId);
      if (!move) throw new Error(`Missing repertoire move ${moveId}.`);
      const context = await this.database.repertoireContexts.get(move.contextId);
      if (!context) throw new Error(`Missing repertoire context ${move.contextId}.`);
      await this.assertMutationUnlocked([context.repertoireId]);
      const note = boundedText(patch.note ?? '', 'Move note', 4_000, true);
      const purpose = boundedText(patch.purpose ?? '', 'Move purpose', 1_000, true);
      await this.database.repertoireMoves.put({ ...move, ...(note ? { note } : { note: undefined }), ...(purpose ? { purpose } : { purpose: undefined }) });
    });
  }
  public async getContextEditorSnapshot(contextId: string) {
    await this.awaitPendingOperations();
    const graph = await this.base.loadCompleteGraph();
    const context = graph.contexts.find((row) => row.id === contextId);
    if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
    const edges = new Map(graph.edges.map((row) => [row.id, row]));
    const openingName = await this.database.managedOpeningNames.where('contextId').equals(contextId).first();
    return {
      context,
      breadcrumb: breadcrumb(graph, contextId),
      openingName: openingName && !openingName.archivedAt ? openingName : undefined,
      moves: graph.moves
        .filter((move) => move.contextId === contextId)
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
        .map((move) => ({ ...move, san: edges.get(move.edgeId)?.san ?? move.id })),
    };
  }
  public previewOpeningNameChange(
    contextId: string,
    primaryLabel: string,
    aliases: readonly string[],
  ): Promise<ManagementImpact> {
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      const validated = validateOpeningNameLabels(primaryLabel, aliases);
      let blockedReason: string | undefined;
      try { await this.assertMutationUnlocked([context.repertoireId]); } catch (error) { blockedReason = error instanceof Error ? error.message : String(error); }
      const existing = await this.database.managedOpeningNames.where('contextId').equals(contextId).first();
      const identityChanges = !existing || existing.answerSetKey !== validated.answerSetKey;
      return {
        title: identityChanges ? 'Change accepted opening-name answers?' : 'Update opening-name display text?',
        details: [identityChanges ? 'The prior name item will be superseded; its review history and scheduler audit remain immutable.' : 'The normalized accepted answer set is unchanged, so the existing name item identity is retained.'],
        ...(blockedReason ? { blockedReason } : {}),
      };
    });
  }
  public saveOpeningName(
    contextId: string,
    primaryLabel: string,
    aliases: readonly string[],
    now = nowIso(),
  ): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      await this.assertMutationUnlocked([context.repertoireId]);
      await this.saveOpeningNameUnsafe(contextId, primaryLabel, aliases, now);
    });
  }
  protected async saveOpeningNameUnsafe(
    contextId: string,
    primaryLabel: string,
    aliases: readonly string[],
    now: string,
  ): Promise<void> {
    const context = await this.database.repertoireContexts.get(contextId);
    if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
    const position = await this.database.positions.get(context.entryPositionId);
    if (!position) throw new Error(`Missing position ${context.entryPositionId}.`);
    const validated = validateOpeningNameLabels(primaryLabel, aliases);
    const existingName = await this.database.managedOpeningNames.where('contextId').equals(contextId).first();
    const nameId = existingName?.id ?? `opening-name:${contextId}`;
    const record: ManagedOpeningNameRecord = {
      id: nameId,
      repertoireId: context.repertoireId,
      contextId,
      primaryLabel: validated.primaryLabel,
      aliases: validated.aliases,
      answerSetKey: validated.answerSetKey,
      createdAt: existingName?.createdAt ?? now,
      updatedAt: now,
    };
    const itemId = nameTrainingItemId(context.repertoireId, contextId, validated.answerSetKey);
    const oldItems = await this.database.nameTrainingItems.where('contextId').equals(contextId).toArray();
    const nextItems = oldItems.map((row) => row.id === itemId ? { ...row, primaryLabel: validated.primaryLabel, aliases: validated.aliases, status: 'active' as const, updatedAt: now } : { ...row, status: 'superseded' as const, updatedAt: now });
    if (!nextItems.some((row) => row.id === itemId)) {
      nextItems.push({
        id: itemId,
        repertoireId: context.repertoireId,
        contextId,
        positionKey: position.key,
        primaryLabel: validated.primaryLabel,
        aliases: validated.aliases,
        answerSetKey: validated.answerSetKey,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
    await this.database.transaction('rw', [this.database.managedOpeningNames, this.database.nameTrainingItems, this.database.nameSchedulerStates], async () => {
      await this.database.managedOpeningNames.put(record);
      await this.database.nameTrainingItems.bulkPut(nextItems);
      if (!(await this.database.nameSchedulerStates.get(itemId))) {
        await this.database.nameSchedulerStates.put(schedulerRecord(this.scheduler, itemId, OPENING_NAME_MAPPING_POLICY_VERSION, now));
      }
    });
  }
  public archiveOpeningName(contextId: string, now = nowIso()): Promise<void> {
    this.assertWritable();
    return this.enqueue(async () => {
      const context = await this.database.repertoireContexts.get(contextId);
      if (!context) throw new Error(`Missing repertoire context ${contextId}.`);
      await this.assertMutationUnlocked([context.repertoireId]);
      const name = await this.database.managedOpeningNames.where('contextId').equals(contextId).first();
      if (!name) return;
      const items = await this.database.nameTrainingItems.where('contextId').equals(contextId).toArray();
      await this.database.transaction('rw', [this.database.managedOpeningNames, this.database.nameTrainingItems], async () => {
        await this.database.managedOpeningNames.put({ ...name, archivedAt: now, updatedAt: now });
        if (items.length > 0) await this.database.nameTrainingItems.bulkPut(items.map((row) => ({ ...row, status: 'superseded' as const, updatedAt: now })));
      });
    });
  }
  protected async migrateLegacyOpeningNames(now: string): Promise<void> {
    const legacy = await this.database.openingNames.toArray();
    for (const row of legacy) {
      if (await this.database.managedOpeningNames.where('contextId').equals(row.contextId).first()) continue;
      const [primaryLabel, ...aliases] = row.labels;
      if (!primaryLabel) continue;
      await this.saveOpeningNameUnsafe(row.contextId, primaryLabel, aliases, now);
    }
  }
}
