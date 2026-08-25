import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ChessboardPreview } from './ChessboardPreview';

type DropHandler = (args: {
  sourceSquare: string;
  targetSquare?: string;
}) => boolean;
let drop: DropHandler | undefined;

vi.mock('react-chessboard', () => ({
  Chessboard: ({ options }: { options: { onPieceDrop?: DropHandler } }) => {
    drop = options.onPieceDrop;
    return <div data-testid="board" />;
  },
}));

describe('ChessboardPreview promotion boundary', () => {
  it('opens an accessible chooser before submitting a drag promotion', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn(() => true);
    render(
      <ChessboardPreview
        position="8/P7/8/8/8/8/4K3/7k w - - 0 1"
        orientation="white"
        userTurn
        onMove={onMove}
      />,
    );
    expect(drop?.({ sourceSquare: 'a7', targetSquare: 'a8' })).toBe(false);
    expect(
      await screen.findByRole('dialog', { name: 'Choose promotion piece' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Knight' }));
    expect(onMove).toHaveBeenCalledWith({
      type: 'board.move-requested',
      from: 'a7',
      to: 'a8',
      promotion: 'n',
    });
  });
});
