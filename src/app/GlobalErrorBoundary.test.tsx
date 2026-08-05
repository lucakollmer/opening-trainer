import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

function BrokenChild(): never {
  throw new Error('expected test failure');
}

describe('GlobalErrorBoundary', () => {
  it('renders a bounded boot failure state', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <GlobalErrorBoundary>
        <BrokenChild />
      </GlobalErrorBoundary>,
    );

    expect(screen.getByText('Opening Trainer could not start.')).toBeVisible();
    consoleError.mockRestore();
  });
});
