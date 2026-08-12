import { Chess } from 'chess.js';
import { canonicalPositionKey } from './positionKey';

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface ChessMoveInput {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

export interface AppliedChessMove {
  from: string;
  to: string;
  promotion?: PromotionPiece;
  uci: string;
  san: string;
  fen: string;
  positionKey: string;
}

export interface LegalMoveResult {
  san: string;
  fen: string;
}

export function moveToUci(move: ChessMoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function applyMove(fen: string, input: ChessMoveInput): AppliedChessMove | null {
  const game = new Chess(fen);

  try {
    const move = game.move({
      from: input.from,
      to: input.to,
      ...(input.promotion ? { promotion: input.promotion } : {}),
    });
    const resultingFen = game.fen();

    return {
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
      uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      san: move.san,
      fen: resultingFen,
      positionKey: canonicalPositionKey(resultingFen),
    };
  } catch {
    return null;
  }
}

export function applyInitialPositionMove(
  from: string,
  to: string,
): LegalMoveResult | null {
  const result = applyMove(new Chess().fen(), { from, to, promotion: 'q' });

  return result ? { san: result.san, fen: result.fen } : null;
}
