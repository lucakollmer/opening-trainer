import { canonicalPositionKey } from './positionKey';

describe('canonicalPositionKey', () => {
  it('ignores halfmove and fullmove counters for the same chess position', () => {
    const first = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const later = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 17 42';

    expect(canonicalPositionKey(first)).toBe(canonicalPositionKey(later));
  });

  it('retains side-to-move as part of position identity', () => {
    const white = '8/8/8/8/8/8/4K3/7k w - - 0 1';
    const black = '8/8/8/8/8/8/4K3/7k b - - 0 1';

    expect(canonicalPositionKey(white)).not.toBe(canonicalPositionKey(black));
  });
});
