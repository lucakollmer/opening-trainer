import { Chess } from 'chess.js';
import { foundationFixture } from './foundationFixture';

describe('foundation fixture', () => {
  it('provides a valid full FEN to the board adapter', () => {
    const chess = new Chess(foundationFixture.position);

    expect(chess.fen()).toBe(foundationFixture.position);
    expect(chess.board().flat().filter(Boolean)).toHaveLength(32);
  });
});
