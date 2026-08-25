import { Chess } from 'chess.js';
import { tryApplyMove } from './chessAdapter';
import { canonicalPositionKey } from './positionKey';

function play(uciMoves: readonly string[]): string {
  let fen = new Chess().fen();
  for (const uci of uciMoves) {
    const result = tryApplyMove(fen, {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
    });
    if (!result.ok) throw new Error(`Failed fixture move ${uci}`);
    fen = result.move.fen;
  }
  return fen;
}

describe('canonicalPositionKey', () => {
  it('ignores clocks but preserves turn and castling state', () => {
    const first =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const later =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 17 42';
    expect(canonicalPositionKey(first)).toBe(canonicalPositionKey(later));
    expect(canonicalPositionKey('8/8/8/8/8/8/4K3/7k w - - 0 1')).not.toBe(
      canonicalPositionKey('8/8/8/8/8/8/4K3/7k b - - 0 1'),
    );
    expect(
      canonicalPositionKey('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'),
    ).not.toBe(canonicalPositionKey('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1'));
  });

  it('canonicalises castling order and rejects malformed positions', () => {
    expect(
      canonicalPositionKey('r3k2r/8/8/8/8/8/8/R3K2R w qKQk - 0 1'),
    ).toContain(' KQkq ');
    expect(() => canonicalPositionKey('not a fen')).toThrow();
  });

  it('normalises en-passant only when a legal capture exists', () => {
    const nominal =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const none =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(canonicalPositionKey(nominal)).toBe(canonicalPositionKey(none));
    const legal = '8/8/8/3pP3/8/8/4K3/7k w - d6 0 1';
    expect(canonicalPositionKey(legal)).toContain(' d6');
  });

  it('gives the same key to an exact transposition reached by different move orders', () => {
    const first = play(['g1f3', 'd7d5', 'g2g3', 'g8f6']);
    const second = play(['g2g3', 'd7d5', 'g1f3', 'g8f6']);
    expect(canonicalPositionKey(first)).toBe(canonicalPositionKey(second));
  });
});
