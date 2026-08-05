import { Chess } from 'chess.js';

export interface LegalMoveResult {
  san: string;
  fen: string;
}

export function applyInitialPositionMove(
  from: string,
  to: string,
): LegalMoveResult | null {
  const game = new Chess();
  try {
    const move = game.move({ from, to, promotion: 'q' });

    return {
      san: move.san,
      fen: game.fen(),
    };
  } catch {
    return null;
  }
}
