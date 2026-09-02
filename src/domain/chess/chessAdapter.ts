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

export interface StructuralMoveHint {
  piece: string;
  candidateDestinations: readonly string[];
  purpose: string;
}

export type ApplyMoveResult =
  | { kind: 'applied'; move: AppliedChessMove }
  | { kind: 'illegal-move' }
  | { kind: 'invalid-position'; message: string };

const SQUARE_PATTERN = /^[a-h][1-8]$/u;

function pieceName(type: string): string {
  switch (type) {
    case 'k':
      return 'king';
    case 'q':
      return 'queen';
    case 'r':
      return 'rook';
    case 'b':
      return 'bishop';
    case 'n':
      return 'knight';
    default:
      return 'pawn';
  }
}

function destinationRegion(square: string): 'queenside' | 'centre' | 'kingside' {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  if (file <= 2) return 'queenside';
  if (file >= 5) return 'kingside';
  return 'centre';
}

export function moveToUci(move: ChessMoveInput): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function moveFromUci(uci: string): ChessMoveInput | null {
  const normalized = uci.trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/u.test(normalized)) return null;
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    ...(normalized.length === 5 ? { promotion: normalized[4] as PromotionPiece } : {}),
  };
}

export function structuralMoveHint(
  fen: string,
  input: ChessMoveInput,
): StructuralMoveHint | null {
  if (!SQUARE_PATTERN.test(input.from) || !SQUARE_PATTERN.test(input.to)) return null;

  try {
    const game = new Chess(fen);
    const piece = game.get(input.from as Square);
    if (!piece) return null;
    const candidateDestinations = [
      ...new Set(
        game
          .moves({ square: input.from as Square, verbose: true })
          .map((move) => move.to),
      ),
    ].sort();
    if (candidateDestinations.length === 0) return null;
    return {
      piece: `${pieceName(piece.type)} on ${input.from}`,
      candidateDestinations,
      purpose: `The repertoire move heads toward the ${destinationRegion(input.to)}.`,
    };
  } catch {
    return null;
  }
}

export function tryApplyMove(fen: string, input: ChessMoveInput): ApplyMoveResult {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch (error) {
    return {
      kind: 'invalid-position',
      message: error instanceof Error ? error.message : 'Invalid chess position.',
    };
  }

  if (!SQUARE_PATTERN.test(input.from) || !SQUARE_PATTERN.test(input.to)) {
    return { kind: 'illegal-move' };
  }

  try {
    const move = game.move({
      from: input.from,
      to: input.to,
      ...(input.promotion ? { promotion: input.promotion } : {}),
    });
    const resultingFen = game.fen();
    return {
      kind: 'applied',
      move: {
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion as PromotionPiece } : {}),
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        san: move.san,
        fen: resultingFen,
        positionKey: canonicalPositionKey(resultingFen),
      },
    };
  } catch {
    return { kind: 'illegal-move' };
  }
}

export function applyMove(fen: string, input: ChessMoveInput): AppliedChessMove | null {
  const result = tryApplyMove(fen, input);
  return result.kind === 'applied' ? result.move : null;
}

export function requiresPromotion(fen: string, from: string, to: string): boolean {
  try {
    const game = new Chess(fen);
    return game
      .moves({ square: from as Square, verbose: true })
      .some((move) => move.to === to && Boolean(move.promotion));
  } catch {
    return false;
  }
}

export function applyInitialPositionMove(
  from: string,
  to: string,
): LegalMoveResult | null {
  const result = applyMove(new Chess().fen(), { from, to, promotion: 'q' });
  return result ? { san: result.san, fen: result.fen } : null;
}
