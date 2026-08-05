const POSITION_IDENTITY_FIELD_COUNT = 4;

export function canonicalPositionKey(fen: string): string {
  const fields = fen.trim().split(/\s+/u);

  if (fields.length !== 6) {
    throw new Error('A complete six-field FEN is required.');
  }

  return fields.slice(0, POSITION_IDENTITY_FIELD_COUNT).join(' ');
}
