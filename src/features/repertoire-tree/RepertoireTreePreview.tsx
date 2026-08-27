import { Chip, Paper, Stack, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import type { TrainingMode, TrainingTreeItem } from '../../fixtures/trainingFixtures';

interface RepertoireTreePreviewProps {
  mode: TrainingMode;
  items: readonly TrainingTreeItem[];
  revealedItemIds: readonly string[];
  currentItemId?: string;
}

const statusLabels: Record<TrainingTreeItem['status'], string> = {
  reviewed: 'Reviewed',
  current: 'Current',
  due: 'Due',
  new: 'New',
};

function collectExpandedItemIds(items: readonly TrainingTreeItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.children?.length ? [item.id] : []),
    ...collectExpandedItemIds(item.children ?? []),
  ]);
}

function TreeLabel({
  item,
  mode,
  revealedItemIds,
  currentItemId,
}: {
  item: TrainingTreeItem;
  mode: TrainingMode;
  revealedItemIds: readonly string[];
  currentItemId?: string;
}) {
  const visible = mode === 'browse' || revealedItemIds.includes(item.id);
  const label = visible ? item.visibleLabel : item.maskedLabel;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.25 }}>
      <Typography component="span" variant="body2">
        {label}
      </Typography>
      <Chip size="small" variant="outlined" label={statusLabels[item.status]} />
      {item.transposition ? <Chip size="small" label="Transposition" /> : null}
      {item.id === currentItemId ? (
        <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
          Current decision
        </Typography>
      ) : null}
    </Stack>
  );
}

function renderItem(
  item: TrainingTreeItem,
  mode: TrainingMode,
  revealedItemIds: readonly string[],
  currentItemId: string | undefined,
) {
  return (
    <TreeItem
      key={item.id}
      itemId={item.id}
      label={
        <TreeLabel
          item={item}
          mode={mode}
          revealedItemIds={revealedItemIds}
          currentItemId={currentItemId}
        />
      }
    >
      {item.children?.map((child) =>
        renderItem(child, mode, revealedItemIds, currentItemId),
      )}
    </TreeItem>
  );
}

export function RepertoireTreePreview({
  mode,
  items,
  revealedItemIds,
  currentItemId,
}: RepertoireTreePreviewProps) {
  return (
    <Paper
      component="section"
      aria-labelledby="tree-heading"
      sx={{ p: 2, minWidth: 0 }}
    >
      <Stack spacing={1}>
        <div>
          <Typography id="tree-heading" component="h2" variant="h6">
            Repertoire tree
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {mode === 'train'
              ? 'Played or explicitly revealed moves are shown; unrelated future answers remain withheld.'
              : 'Browse mode shows the complete repertoire projection, including transposition markers.'}
          </Typography>
        </div>
        <SimpleTreeView
          defaultExpandedItems={collectExpandedItemIds(items)}
          aria-label="Repertoire tree"
        >
          {items.map((item) => renderItem(item, mode, revealedItemIds, currentItemId))}
        </SimpleTreeView>
      </Stack>
    </Paper>
  );
}
