import type { TrainingMode, TrainingTreeItem } from '../../fixtures/trainingFixtures';

export interface ProjectedTrainingTreeItem {
  id: string;
  label: { kind: 'visible'; text: string } | { kind: 'masked'; text: string };
  status: TrainingTreeItem['status'];
  transposition?: boolean;
  current: boolean;
  children: readonly ProjectedTrainingTreeItem[];
}

export function projectTrainingTree(
  items: readonly TrainingTreeItem[],
  mode: TrainingMode,
  revealedItemIds: readonly string[],
  currentItemId?: string,
): readonly ProjectedTrainingTreeItem[] {
  return items.map((item) => {
    const visible = mode === 'browse' || revealedItemIds.includes(item.id);
    return {
      id: item.id,
      label: visible
        ? { kind: 'visible' as const, text: item.visibleLabel }
        : { kind: 'masked' as const, text: item.maskedLabel },
      status: item.status,
      ...(item.transposition ? { transposition: true } : {}),
      current: item.id === currentItemId,
      children: projectTrainingTree(
        item.children ?? [],
        mode,
        revealedItemIds,
        currentItemId,
      ),
    };
  });
}
