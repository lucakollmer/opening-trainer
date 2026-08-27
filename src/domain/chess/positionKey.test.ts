import { Chess } from 'chess.js';
import { canonicalPositionKey } from './positionKey';

function play(moves: readonly string[]): string {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game.fen();
}

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

  it('retains castling rights and canonicalises their order', () => {
    const standard = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const reordered = 'r3k2r/8/8/8/8/8/8/R3K2R w qkQK - 0 1';
    const withoutRights = 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1';
    expect(canonicalPositionKey(reordered)).toBe(canonicalPositionKey(standard));
    expect(canonicalPositionKey(standard)).not.toBe(canonicalPositionKey(withoutRights));
  });

  it('rejects malformed castling rights instead of silently cleaning them', () => {
    expect(() =>
      canonicalPositionKey('r3k2r/8/8/8/8/8/8/R3K2R w KKKq - 0 1'),
    ).toThrow(/Invalid castling rights/u);
    expect(() =>
      canonicalPositionKey('r3k2r/8/8/8/8/8/8/R3K2R w KQx - 0 1'),
    ).toThrow(/Invalid castling rights/u);
  });

  it('drops a nominal en-passant square when no legal capture exists', () => {
    const nominal = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const none = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(canonicalPositionKey(nominal)).toBe(canonicalPositionKey(none));
  });

  it('retains an en-passant square when a legal capture exists', () => {
    const legal = '8/8/8/3pP3/8/8/4K3/7k w - d6 0 1';
    const none = '8/8/8/3pP3/8/8/4K3/7k w - - 0 1';
    expect(canonicalPositionKey(legal)).not.toBe(canonicalPositionKey(none));
    expect(canonicalPositionKey(legal)).toContain(' d6');
  });

  it('gives the same key to an exact transposition reached by different move orders', () => {
    const first = play(['Nf3', 'Nf6', 'g3', 'g6']);
    const second = play(['g3', 'g6', 'Nf3', 'Nf6']);
    expect(canonicalPositionKey(first)).toBe(canonicalPositionKey(second));
  });

  it('rejects malformed or illegal FEN instead of producing a key', () => {
    expect(() => canonicalPositionKey('not-a-fen')).toThrow(/six-field FEN/u);
    expect(() => canonicalPositionKey('8/8/8/8/8/8/8/8 w - - 0 1')).toThrow(
      /Invalid chess position/u,
    );
  });
});
