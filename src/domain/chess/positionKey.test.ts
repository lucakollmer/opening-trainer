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

  it('retains castling rights as part of position identity', () => {
    const withRights = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const withoutRights = 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1';

    expect(canonicalPositionKey(withRights)).not.toBe(
      canonicalPositionKey(withoutRights),
    );
  });

  it('drops a nominal en-passant square when no legal capture exists', () => {
    const nominal =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const none = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

    expect(canonicalPositionKey(nominal)).toBe(canonicalPositionKey(none));
  });

  it('retains an en-passant square when a legal capture exists', () => {
    const legal = '8/8/8/3pP3/8/8/4K3/7k w - d6 0 1';
    const none = '8/8/8/3pP3/8/8/4K3/7k w - - 0 1';

    expect(canonicalPositionKey(legal)).not.toBe(canonicalPositionKey(none));
    expect(canonicalPositionKey(legal)).toContain(' d6');
  });
});
