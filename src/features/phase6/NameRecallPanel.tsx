import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type {
  NamePrompt,
  NameReviewResult,
} from '../../domain/phase6/types';
import { ChessboardPreview } from '../board/ChessboardPreview';

interface NameRecallPanelProps {
  prompt: NamePrompt;
  busy?: boolean;
  onReview: (
    answer: string,
    responseTimeMs: number,
    reveal: boolean,
  ) => Promise<NameReviewResult>;
  onNext: () => Promise<void>;
  onEnd: () => Promise<void>;
}

function monotonicNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function NameRecallPanel({
  prompt,
  busy = false,
  onReview,
  onNext,
  onEnd,
}: NameRecallPanelProps) {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<NameReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef(monotonicNow());

  useEffect(() => {
    setAnswer('');
    setResult(null);
    setError(null);
    startedAtRef.current = monotonicNow();
  }, [prompt.itemId, prompt.itemIndex]);

  const review = async (reveal: boolean) => {
    if (result || busy) return;
    setError(null);
    try {
      setResult(
        await onReview(
          answer,
          Math.max(0, monotonicNow() - startedAtRef.current),
          reveal,
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Name review failed.');
    }
  };

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Typography component="h2" variant="h5">
        Opening-name recall
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {prompt.breadcrumb}
      </Typography>
      <Paper variant="outlined" sx={{ p: 1.5, maxWidth: 680, width: '100%', mx: 'auto' }}>
        <ChessboardPreview
          position={prompt.fen}
          orientation={prompt.orientation}
          userTurn={false}
          disabled
          onMove={() => false}
        />
      </Paper>
      {!result ? (
        <Stack spacing={1.5} sx={{ maxWidth: 680, width: '100%', mx: 'auto' }}>
          <TextField
            label="What opening is this?"
            value={answer}
            disabled={busy}
            autoFocus
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAnswer(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' && answer.trim()) void review(false);
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              disabled={busy || !answer.trim()}
              onClick={() => void review(false)}
            >
              Check answer
            </Button>
            <Button disabled={busy} onClick={() => void review(true)}>
              Reveal name
            </Button>
            <Button disabled={busy} onClick={() => void onEnd()}>
              End session
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={1.5} sx={{ maxWidth: 680, width: '100%', mx: 'auto' }}>
          <Alert severity={result.accepted ? 'success' : 'warning'}>
            {result.accepted ? 'Accepted.' : 'Review the expected name.'}
          </Alert>
          <Typography variant="h6">{result.expectedPrimaryLabel}</Typography>
          {result.expectedAliases.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              Accepted aliases: {result.expectedAliases.join(' · ')}
            </Typography>
          ) : null}
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => void (result.complete ? onEnd() : onNext())}
          >
            {result.complete ? 'Return to Browse' : 'Next name'}
          </Button>
        </Stack>
      )}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
