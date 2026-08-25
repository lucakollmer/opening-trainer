import { Chess, type Square } from 'chess.js';
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

export type ApplyMoveResult =
  | { ok: true; move: AppliedChessMove }
  | { ok: false; code: 'CHESS_ILLEGAL_MOVE'; message: string }
  | { ok: false; code: 'CHESS_INVALID_POSITION'; message: string }
  | { ok: false; code: 'CHESS_ADAPTER_ERROR'; message: string };

export function moveToUci(move: ChessMoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function tryApplyMove(fen: string, input: ChessMoveInput): ApplyMoveResult {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return {
      ok: false,
      code: 'CHESS_INVALID_POSITION',
      message: 'The source chess position is invalid.',
    };
  }

  try {
    const move = game.move({
      from: input.from,
      to: input.to,
      ...(input.promotion ? { promotion: input.promotion } : {}),
    });
    const resultingFen = game.fen();
    let positionKey: string;
    try {
      positionKey = canonicalPositionKey(resultingFen);
    } catch {
      return {
        ok: false,
        code: 'CHESS_ADAPTER_ERROR',
        message: 'The resulting chess position could not be normalized.',
      };
    }

    return {
      ok: true,
      move: {
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        san: move.san,
        fen: resultingFen,
        positionKey,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'CHESS_ILLEGAL_MOVE',
      message: 'The requested move is illegal in the source position.',
    };
  }
}

export function requiresPromotion(fen: string, from: string, to: string): boolean {
  try {
    const game = new Chess(fen);
    const piece = game.get(from as Square);
    if (!piece || piece.type !== 'p') return false;
    const destinationRank = to[1];
    return (
      (piece.color === 'w' && destinationRank === '8') ||
      (piece.color === 'b' && destinationRank === '1')
    );
  } catch {
    return false;
  }
}

export function applyInitialPositionMove(
  from: string,
  to: string,
): LegalMoveResult | null {
  const result = tryApplyMove(new Chess().fen(), { from, to, promotion: 'q' });
  return result.ok ? { san: result.move.san, fen: result.move.fen } : null;
}
