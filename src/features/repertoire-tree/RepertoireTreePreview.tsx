import { Chip, Paper, Stack, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import type {
  RepertoireTreeFixtureItem,
  TrainingMode,
} from '../../fixtures/foundationFixture';

interface RepertoireTreePreviewProps {
  mode: TrainingMode;
  items: readonly RepertoireTreeFixtureItem[];
}

const statusLabels: Record<RepertoireTreeFixtureItem['status'], string> = {
  reviewed: 'Reviewed',
  current: 'Current',
  due: 'Due',
  new: 'New',
};

function TreeLabel({
  item,
  mode,
}: {
  item: RepertoireTreeFixtureItem;
  mode: TrainingMode;
}) {
  const label =
    mode === 'browse' || item.status === 'reviewed'
      ? item.visibleLabel
      : item.maskedLabel;

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.25 }}>
      <Typography component="span" variant="body2">
        {label}
      </Typography>
      <Chip size="small" variant="outlined" label={statusLabels[item.status]} />
      {item.transposition ? <Chip size="small" label="Transposition" /> : null}
      {item.current ? (
        <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
          Current position
        </Typography>
      ) : null}
    </Stack>
  );
}

function renderItem(item: RepertoireTreeFixtureItem, mode: TrainingMode) {
  return (
    <TreeItem
      key={item.id}
      itemId={item.id}
      label={<TreeLabel item={item} mode={mode} />}
    >
      {item.children?.map((child) => renderItem(child, mode))}
    </TreeItem>
  );
}

export function RepertoireTreePreview({ mode, items }: RepertoireTreePreviewProps) {
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
              ? 'Future answer-bearing labels are withheld.'
              : 'Browse mode shows the complete synthetic fixture.'}
          </Typography>
        </div>
        <SimpleTreeView
          defaultExpandedItems={['root-e4', 'reply-e5', 'future-nf3']}
          aria-label="Synthetic repertoire tree"
        >
          {items.map((item) => renderItem(item, mode))}
        </SimpleTreeView>
      </Stack>
    </Paper>
  );
}
