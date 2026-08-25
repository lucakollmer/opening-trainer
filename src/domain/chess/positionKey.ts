import { Chess } from 'chess.js';

const FEN_FIELD_COUNT = 6;
const CASTLING_ORDER = ['K', 'Q', 'k', 'q'] as const;

function normalizeCastling(raw: string): string {
  if (raw === '-') return '-';
  const chars = [...raw];
  if (
    chars.some(
      (char) => !CASTLING_ORDER.includes(char as (typeof CASTLING_ORDER)[number]),
    )
  ) {
    throw new Error('FEN contains invalid castling rights.');
  }
  if (new Set(chars).size !== chars.length) {
    throw new Error('FEN contains duplicate castling rights.');
  }
  const normalized = CASTLING_ORDER.filter((right) => raw.includes(right)).join('');
  return normalized || '-';
}

function hasLegalEnPassantCapture(fen: string): boolean {
  if (fen.trim().split(/\s+/u)[3] === '-') return false;
  const game = new Chess(fen);
  return game.moves({ verbose: true }).some((move) => move.flags.includes('e'));
}

export function canonicalPositionKey(fen: string): string {
  const fields = fen.trim().split(/\s+/u);
  if (fields.length !== FEN_FIELD_COUNT) {
    throw new Error('A complete six-field FEN is required.');
  }

  const [placement, turn, castling, enPassant, halfmove, fullmove] = fields;
  if (!placement || !turn || !castling || !enPassant || !halfmove || !fullmove) {
    throw new Error('A complete six-field FEN is required.');
  }

  const normalizedCastling = normalizeCastling(castling);
  const normalizedFen = `${placement} ${turn} ${normalizedCastling} ${enPassant} ${halfmove} ${fullmove}`;
  const game = new Chess(normalizedFen);
  const validated = game.fen().split(/\s+/u);
  const validatedPlacement = validated[0];
  const validatedTurn = validated[1];
  if (!validatedPlacement || !validatedTurn) {
    throw new Error('FEN could not be normalized.');
  }

  const canonicalEnPassant =
    enPassant !== '-' && hasLegalEnPassantCapture(normalizedFen) ? enPassant : '-';

  return `${validatedPlacement} ${validatedTurn} ${normalizedCastling} ${canonicalEnPassant}`;
}
