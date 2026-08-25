import { Chip, Paper, Stack, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import type { TrainingMode } from '../../fixtures/trainingFixtures';
import type { ProjectedTrainingTreeItem } from '../../domain/training/treeProjection';

interface RepertoireTreePreviewProps {
  mode: TrainingMode;
  items: readonly ProjectedTrainingTreeItem[];
}

const statusLabels: Record<ProjectedTrainingTreeItem['status'], string> = {
  reviewed: 'Reviewed',
  current: 'Current',
  due: 'Due',
  new: 'New',
};

function collectExpandedItemIds(
  items: readonly ProjectedTrainingTreeItem[],
): string[] {
  return items.flatMap((item) => [
    ...(item.children.length ? [item.id] : []),
    ...collectExpandedItemIds(item.children),
  ]);
}

function renderItem(item: ProjectedTrainingTreeItem) {
  return (
    <TreeItem
      key={item.id}
      itemId={item.id}
      label={
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.25 }}>
          <Typography component="span" variant="body2">
            {item.label.text}
          </Typography>
          <Chip size="small" variant="outlined" label={statusLabels[item.status]} />
          {item.transposition ? <Chip size="small" label="Transposition" /> : null}
          {item.current ? (
            <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
              Current decision
            </Typography>
          ) : null}
        </Stack>
      }
    >
      {item.children.map(renderItem)}
    </TreeItem>
  );
}

export function RepertoireTreePreview({
  mode,
  items,
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
              : 'Browse mode shows the complete repertoire projection.'}
          </Typography>
        </div>
        <SimpleTreeView
          defaultExpandedItems={collectExpandedItemIds(items)}
          aria-label="Repertoire tree"
        >
          {items.map(renderItem)}
        </SimpleTreeView>
      </Stack>
    </Paper>
  );
}
