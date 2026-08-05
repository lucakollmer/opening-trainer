import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  AppBar,
  Box,
  Chip,
  Container,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRef, useState } from 'react';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../features/board/ChessboardPreview';
import { RepertoireTreePreview } from '../features/repertoire-tree/RepertoireTreePreview';
import { TaskPreviewCard } from '../features/task/TaskPreviewCard';
import {
  foundationFixture,
  type TaskFixtureState,
  type TrainingMode,
} from '../fixtures/foundationFixture';

const taskStateOrder: readonly TaskFixtureState[] = [
  'awaiting-user-move',
  'correct-feedback',
  'hint-offered',
  'line-complete',
];

export function App() {
  const [mode, setMode] = useState<TrainingMode>('train');
  const [treeOpen, setTreeOpen] = useState(false);
  const [taskState, setTaskState] = useState<TaskFixtureState>('awaiting-user-move');
  const [lastCommand, setLastCommand] = useState<BoardMoveCommand | null>(null);
  const treeButtonRef = useRef<HTMLButtonElement>(null);

  const handleMove = (command: BoardMoveCommand) => {
    setLastCommand(command);
    setTaskState('correct-feedback');
  };

  const advanceTaskState = () => {
    const currentIndex = taskStateOrder.indexOf(taskState);
    const nextState = taskStateOrder[(currentIndex + 1) % taskStateOrder.length];
    if (nextState) setTaskState(nextState);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 1 }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, mr: 'auto' }}>
            Opening Trainer
          </Typography>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="repertoire-label">Repertoire</InputLabel>
            <Select
              labelId="repertoire-label"
              label="Repertoire"
              value={foundationFixture.id}
              onChange={() => undefined}
            >
              <MenuItem value={foundationFixture.id}>
                {foundationFixture.label}
              </MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            aria-label="Training mode"
            onChange={(_, nextMode: TrainingMode | null) => {
              if (nextMode) setMode(nextMode);
            }}
          >
            <ToggleButton value="train">Train</ToggleButton>
            <ToggleButton value="browse">Browse</ToggleButton>
          </ToggleButtonGroup>

          <Chip size="small" label={`${foundationFixture.dueCount} due`} />
          <Chip
            size="small"
            variant="outlined"
            label={foundationFixture.sessionProgress}
          />

          <Tooltip title="Open repertoire tree">
            <IconButton
              ref={treeButtonRef}
              color="inherit"
              aria-label="Open repertoire tree"
              onClick={() => setTreeOpen(true)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <AccountTreeOutlinedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings placeholder">
            <IconButton color="inherit" aria-label="Settings placeholder">
              <SettingsOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container component="main" maxWidth="xl" sx={{ py: { xs: 1.5, md: 3 } }}>
        <Box
          className="training-workspace"
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateAreas: {
              xs: '"board" "task"',
              md: '"tree board" "tree task"',
              lg: '"tree board task"',
            },
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(240px, 300px) minmax(0, 1fr)',
              lg: 'minmax(250px, 300px) minmax(420px, 1fr) minmax(300px, 360px)',
            },
            alignItems: 'start',
          }}
        >
          <Box
            sx={{ gridArea: 'tree', display: { xs: 'none', md: 'block' }, minWidth: 0 }}
          >
            <RepertoireTreePreview mode={mode} items={foundationFixture.tree} />
          </Box>

          <Box sx={{ gridArea: 'board', minWidth: 0 }}>
            <ChessboardPreview
              position={foundationFixture.position}
              orientation={foundationFixture.orientation}
              userTurn
              lastMove={lastCommand ? [lastCommand.from, lastCommand.to] : undefined}
              hintSquares={taskState === 'hint-offered' ? ['g1', 'f3'] : []}
              onMove={handleMove}
            />
          </Box>

          <Box sx={{ gridArea: 'task', minWidth: 0 }}>
            <TaskPreviewCard
              state={taskState}
              onHint={() => setTaskState('hint-offered')}
              onContinue={advanceTaskState}
            />
          </Box>
        </Box>
      </Container>

      <Drawer
        open={treeOpen}
        onClose={() => setTreeOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{
          paper: { sx: { width: 'min(88vw, 360px)', p: 1 } },
          transition: { onExited: () => treeButtonRef.current?.focus() },
        }}
      >
        <RepertoireTreePreview mode={mode} items={foundationFixture.tree} />
      </Drawer>
    </Box>
  );
}
