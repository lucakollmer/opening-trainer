import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type {
  ContrastPrompt,
  ContrastReviewResult,
} from '../../domain/phase6/types';
import {
  ChessboardPreview,
  type BoardMoveCommand,
} from '../board/ChessboardPreview';

interface ContrastRecallPanelProps {
  prompt: ContrastPrompt;
  busy?: boolean;
  onReview: (
    playedUci: string | undefined,
    responseTimeMs: number,
    reveal: boolean,
  ) => Promise<ContrastReviewResult>;
  onNext: () => Promise<void>;
  onEnd: () => Promise<void>;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function ContrastRecallPanel({
  prompt,
  busy = false,
  onReview,
  onNext,
  onEnd,
}: ContrastRecallPanelProps) {
  const [result, setResult] = useState<ContrastReviewResult | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef(monotonicNow());

  useEffect(() => {
    setResult(null);
    setError(null);
    setLocalBusy(false);
    startedAtRef.current = monotonicNow();
  }, [prompt.itemId, prompt.itemIndex]);

  const review = async (playedUci: string | undefined, reveal: boolean) => {
    if (result || busy || localBusy) return;
    setLocalBusy(true);
    setError(null);
    try {
      setResult(
        await onReview(
          playedUci,
          Math.max(0, monotonicNow() - startedAtRef.current),
          reveal,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Contrast review failed.');
    } finally {
      setLocalBusy(false);
    }
  };

  const handleMove = (command: BoardMoveCommand): boolean => {
    if (result || busy || localBusy) return false;
    const uci = `${command.from}${command.to}${command.promotion ?? ''}`.toLowerCase();
    void review(uci, false);
    return true;
  };

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Typography component="h2" variant="h5">
        Contrast drill
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Play the repertoire move for this position. The sibling you recently confused it
        with stays hidden until after your response.
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5, maxWidth: 680, width: '100%', mx: 'auto' }}>
        <ChessboardPreview
          position={prompt.fen}
          orientation={prompt.orientation}
          userTurn={!result && !busy && !localBusy}
          disabled={Boolean(result || busy || localBusy)}
          onMove={handleMove}
        />
      </Paper>
      {!result ? (
        <Stack direction="row" spacing={1} sx={{ maxWidth: 680, width: '100%', mx: 'auto' }}>
          <Button
            disabled={busy || localBusy}
            onClick={() => void review(undefined, true)}
          >
            Reveal comparison
          </Button>
          <Button disabled={busy || localBusy} onClick={() => void onEnd()}>
            End session
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ maxWidth: 680, width: '100%', mx: 'auto' }}>
          <Alert severity={result.accepted ? 'success' : 'warning'}>
            {result.accepted ? 'Correct distinction.' : 'Contrast this with the sibling branch.'}
          </Alert>
          <Typography variant="body1">
            Expected here: {result.expectedSan.join(' or ')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Confused sibling: {result.confusedBranchLabel}
          </Typography>
          <Button
            variant="contained"
            disabled={busy || localBusy}
            onClick={() => void (result.complete ? onEnd() : onNext())}
          >
            {result.complete ? 'Return to Browse' : 'Next contrast'}
          </Button>
        </Stack>
      )}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
