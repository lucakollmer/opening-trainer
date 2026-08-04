import { Alert, Box, Typography } from '@mui/material';
import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

interface ErrorBoundaryState {
  failed: boolean;
}

export class GlobalErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  public override state: ErrorBoundaryState = { failed: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Opening Trainer failed to render.', error, errorInfo);
  }

  public override render() {
    if (this.state.failed) {
      return (
        <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
          <Alert severity="error">
            <Typography component="p" sx={{ fontWeight: 700 }}>
              Opening Trainer could not start.
            </Typography>
            Reload the page. Return the browser console output if the problem continues.
          </Alert>
        </Box>
      );
    }

    return this.props.children;
  }
}
