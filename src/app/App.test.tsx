import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { App } from './App';
import { AppProviders } from './AppProviders';

vi.mock('react-chessboard', () => ({
  Chessboard: () => <div data-testid="chessboard-adapter">Chessboard</div>,
}));

describe('App foundation shell', () => {
  it('renders under the application theme with the three integration placeholders', () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByRole('heading', { name: 'Opening Trainer' })).toBeVisible();
    expect(screen.getByTestId('chessboard-adapter')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Repertoire tree adapter' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Current task adapter' })).toBeVisible();
  });
});
