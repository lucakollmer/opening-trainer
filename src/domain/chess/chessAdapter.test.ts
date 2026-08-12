import { Chess } from 'chess.js';
import { applyInitialPositionMove, applyMove, moveToUci } from './chessAdapter';

describe('chess adapter', () => {
  it('accepts a legal initial move and exposes SAN, UCI, and resulting position', () => {
    const result = applyMove(new Chess().fen(), { from: 'e2', to: 'e4' });

    expect(result?.san).toBe('e4');
    expect(result?.uci).toBe('e2e4');
    expect(result?.fen).toContain(' b ');
    expect(result?.positionKey).toContain(' b ');
  });

  it('rejects an illegal move without advancing state', () => {
    expect(applyMove(new Chess().fen(), { from: 'e2', to: 'e5' })).toBeNull();
  });

  it('preserves the PHASE-0 initial-position helper', () => {
    const result = applyInitialPositionMove('e2', 'e4');

    expect(result?.san).toBe('e4');
    expect(result?.fen).toContain(' b ');
  });

  it('applies a promotion and includes it in stable UCI identity', () => {
    const fen = '8/P7/8/8/8/8/4K3/7k w - - 0 1';
    const result = applyMove(fen, { from: 'a7', to: 'a8', promotion: 'n' });

    expect(result?.uci).toBe('a7a8n');
    expect(result?.san).toContain('N');
    expect(moveToUci({ from: 'a7', to: 'a8', promotion: 'q' })).toBe('a7a8q');
  });

  it('handles castling through the same legal-move boundary', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const result = applyMove(fen, { from: 'e1', to: 'g1' });

    expect(result?.san).toBe('O-O');
    expect(result?.uci).toBe('e1g1');
  });

  it('handles legal en-passant captures through the same boundary', () => {
    const fen = '8/8/8/3pP3/8/8/4K3/7k w - d6 0 1';
    const result = applyMove(fen, { from: 'e5', to: 'd6' });

    expect(result?.uci).toBe('e5d6');
    expect(result?.san).toContain('exd6');
  });
});
