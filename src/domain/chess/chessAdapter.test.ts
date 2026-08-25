import { Chess } from 'chess.js';
import {
  applyInitialPositionMove,
  moveToUci,
  requiresPromotion,
  tryApplyMove,
} from './chessAdapter';

describe('chess adapter', () => {
  it('accepts a legal move with stable SAN, UCI and position identity', () => {
    const result = tryApplyMove(new Chess().fen(), { from: 'e2', to: 'e4' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.move.san).toBe('e4');
    expect(result.move.uci).toBe('e2e4');
    expect(result.move.positionKey).toContain(' b ');
  });

  it('distinguishes illegal moves from invalid source positions', () => {
    const illegal = tryApplyMove(new Chess().fen(), { from: 'e2', to: 'e5' });
    const invalid = tryApplyMove('not a fen', { from: 'e2', to: 'e4' });
    expect(illegal).toMatchObject({ ok: false, code: 'CHESS_ILLEGAL_MOVE' });
    expect(invalid).toMatchObject({ ok: false, code: 'CHESS_INVALID_POSITION' });
  });

  it('preserves the initial-position helper', () => {
    expect(applyInitialPositionMove('e2', 'e4')?.san).toBe('e4');
  });

  it('handles promotion, castling and legal en-passant', () => {
    const promotionFen = '8/P7/8/8/8/8/4K3/7k w - - 0 1';
    const promoted = tryApplyMove(promotionFen, {
      from: 'a7',
      to: 'a8',
      promotion: 'n',
    });
    expect(promoted.ok && promoted.move.uci).toBe('a7a8n');
    expect(moveToUci({ from: 'a7', to: 'a8', promotion: 'q' })).toBe('a7a8q');
    expect(requiresPromotion(promotionFen, 'a7', 'a8')).toBe(true);

    const castled = tryApplyMove(
      'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
      { from: 'e1', to: 'g1' },
    );
    expect(castled.ok && castled.move.san).toBe('O-O');

    const ep = tryApplyMove('8/8/8/3pP3/8/8/4K3/7k w - d6 0 1', {
      from: 'e5',
      to: 'd6',
    });
    expect(ep.ok && ep.move.uci).toBe('e5d6');
  });
});
