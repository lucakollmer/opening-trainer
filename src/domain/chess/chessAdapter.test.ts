import { applyInitialPositionMove } from './chessAdapter';

describe('chess adapter', () => {
  it('accepts a legal initial move and exposes the resulting position', () => {
    const result = applyInitialPositionMove('e2', 'e4');

    expect(result?.san).toBe('e4');
    expect(result?.fen).toContain(' b ');
  });

  it('rejects an illegal initial move', () => {
    expect(applyInitialPositionMove('e2', 'e5')).toBeNull();
  });
});
