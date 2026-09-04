import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material';
import type { BrowseTreeNode } from '../../domain/phase6/types';

interface BrowseTreeProps {
  nodes: readonly BrowseTreeNode[];
  selectedContextId: string;
  onSelect: (contextId: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedContextId,
  onSelect,
}: {
  node: BrowseTreeNode;
  depth: number;
  selectedContextId: string;
  onSelect: (contextId: string) => void;
}) {
  const selected = node.contextId === selectedContextId;
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      <ButtonBase
        onClick={() => onSelect(node.contextId)}
        aria-current={selected ? 'true' : undefined}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          textAlign: 'left',
          borderRadius: 1,
          px: 1,
          py: 0.75,
          pl: 1 + depth * 2,
          bgcolor: selected ? 'action.selected' : 'transparent',
        }}
      >
        <Stack spacing={0.4} sx={{ minWidth: 0, width: '100%' }}>
          <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: selected ? 700 : 500 }}>
              {node.label}
            </Typography>
            {!node.effectiveIncluded ? <Chip size="small" label="Excluded" /> : null}
            {!node.playlistEligible ? (
              <Chip size="small" variant="outlined" label="Outside playlist" />
            ) : null}
            {node.transposition ? (
              <Chip size="small" variant="outlined" label="Transposition" />
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {node.progress.due} due · {node.progress.weak} weak ·{' '}
            {node.progress.neverTrained} never trained · {node.progress.mature} mature
          </Typography>
        </Stack>
      </ButtonBase>
      {node.children.length > 0 ? (
        <Box component="ul" sx={{ p: 0, m: 0 }}>
          {node.children.map((child) => (
            <TreeNode
              key={child.contextId}
              node={child}
              depth={depth + 1}
              selectedContextId={selectedContextId}
              onSelect={onSelect}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

export function BrowseTree({ nodes, selectedContextId, onSelect }: BrowseTreeProps) {
  return (
    <Box component="nav" aria-label="Repertoire tree">
      <Box component="ul" sx={{ p: 0, m: 0 }}>
        {nodes.map((node) => (
          <TreeNode
            key={node.contextId}
            node={node}
            depth={0}
            selectedContextId={selectedContextId}
            onSelect={onSelect}
          />
        ))}
      </Box>
    </Box>
  );
}
