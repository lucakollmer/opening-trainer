import { Chess } from 'chess.js';

const FEN_FIELD_COUNT = 6;

function hasLegalEnPassantCapture(fen: string): boolean {
  if (fen.trim().split(/\s+/u)[3] === '-') return false;

  try {
    const game = new Chess(fen);
    return game.moves({ verbose: true }).some((move) => move.flags.includes('e'));
  } catch {
    return false;
  }
}

export function canonicalPositionKey(fen: string): string {
  const fields = fen.trim().split(/\s+/u);

  if (fields.length !== FEN_FIELD_COUNT) {
    throw new Error('A complete six-field FEN is required.');
  }

  const [placement, turn, castling, enPassant] = fields;
  if (!placement || !turn || !castling || !enPassant) {
    throw new Error('A complete six-field FEN is required.');
  }

  const canonicalEnPassant =
    enPassant !== '-' && hasLegalEnPassantCapture(fen) ? enPassant : '-';

  return `${placement} ${turn} ${castling} ${canonicalEnPassant}`;
}
