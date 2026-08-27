import { Chess } from 'chess.js';

const FEN_FIELD_COUNT = 6;
const CASTLING_ORDER = ['K', 'Q', 'k', 'q'] as const;

function canonicalCastling(castling: string): string {
  if (castling === '-') return '-';
  if (!/^[KQkq]+$/u.test(castling) || new Set(castling).size !== castling.length) {
    throw new Error('Invalid castling rights in FEN.');
  }
  const available = new Set(castling.split(''));
  const normalized = CASTLING_ORDER.filter((right) => available.has(right)).join('');
  return normalized || '-';
}

function hasLegalEnPassantCapture(game: Chess, enPassant: string): boolean {
  if (enPassant === '-') return false;
  return game.moves({ verbose: true }).some((move) => move.flags.includes('e'));
}

export function canonicalPositionKey(fen: string): string {
  const fields = fen.trim().split(/\s+/u);
  if (fields.length !== FEN_FIELD_COUNT) {
    throw new Error('A complete six-field FEN is required.');
  }

  const [placement, turn, castling, enPassant, halfmove, fullmove] = fields;
  if (!placement || !turn || !castling || !enPassant) {
    throw new Error('A complete six-field FEN is required.');
  }

  const normalizedCastling = canonicalCastling(castling);
  const normalizedFen = [
    placement,
    turn,
    normalizedCastling,
    enPassant,
    halfmove,
    fullmove,
  ].join(' ');
  let game: Chess;
  try {
    game = new Chess(normalizedFen);
  } catch (error) {
    throw new Error(
      `Invalid chess position: ${error instanceof Error ? error.message : 'invalid FEN'}`,
    );
  }

  const canonicalEnPassant = hasLegalEnPassantCapture(game, enPassant)
    ? enPassant
    : '-';

  return `${placement} ${turn} ${normalizedCastling} ${canonicalEnPassant}`;
}
