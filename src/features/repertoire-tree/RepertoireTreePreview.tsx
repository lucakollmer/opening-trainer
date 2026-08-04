import { Paper, Stack, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

export function RepertoireTreePreview() {
  return (
    <Paper component="section" aria-labelledby="tree-heading" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <div>
          <Typography id="tree-heading" component="h2" variant="h6">
            Repertoire tree adapter
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Synthetic labels prove the community Tree View boundary without revealing
            training answers.
          </Typography>
        </div>
        <SimpleTreeView defaultExpandedItems={['fixture-root']}>
          <TreeItem itemId="fixture-root" label="Fixture repertoire">
            <TreeItem itemId="fixture-known" label="Reviewed branch" />
            <TreeItem itemId="fixture-masked" label="Future move masked" />
          </TreeItem>
        </SimpleTreeView>
      </Stack>
    </Paper>
  );
}
