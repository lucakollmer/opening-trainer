import type { PromotionPiece } from '../domain/chess/chessAdapter';

export type TrainingMode = 'train' | 'browse';
export type TrainingColour = 'white' | 'black';
export type FixtureActor = 'user' | 'opponent';

export interface TrainingHint {
  piece: string;
  candidateDestinations: readonly string[];
  purpose: string;
}

export interface TrainingFixtureMove {
  id: string;
  actor: FixtureActor;
  from: string;
  to: string;
  promotion?: PromotionPiece;
  san: string;
  treeItemId: string;
  acceptedUci: readonly string[];
  wrongSiblingUci?: readonly string[];
  hint?: TrainingHint;
}

export interface TrainingTreeItem {
  id: string;
  ply: number;
  visibleLabel: string;
  maskedLabel: string;
  status: 'reviewed' | 'current' | 'due' | 'new';
  transposition?: boolean;
  children?: readonly TrainingTreeItem[];
}

export interface TrainingFixture {
  id: string;
  label: string;
  description: string;
  orientation: TrainingColour;
  userColour: TrainingColour;
  initialFen: string;
  targetPly: number;
  route: readonly TrainingFixtureMove[];
  tree: readonly TrainingTreeItem[];
}

const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const fix01White: TrainingFixture = {
  id: 'fix-01-white',
  label: 'FIX-01 · White branching line',
  description: 'Synthetic e4 line with a deterministic e5 reply and a sibling knight branch.',
  orientation: 'white',
  userColour: 'white',
  initialFen,
  targetPly: 2,
  route: [
    {
      id: 'fix01-step-01',
      actor: 'user',
      from: 'e2',
      to: 'e4',
      san: 'e4',
      treeItemId: 'fix01-node-01',
      acceptedUci: ['e2e4'],
      hint: {
        piece: 'king pawn',
        candidateDestinations: ['e3', 'e4'],
        purpose: 'Claim central space and open the queen and bishop.',
      },
    },
    {
      id: 'fix01-step-02',
      actor: 'opponent',
      from: 'e7',
      to: 'e5',
      san: 'e5',
      treeItemId: 'fix01-node-02',
      acceptedUci: ['e7e5'],
    },
    {
      id: 'fix01-step-03',
      actor: 'user',
      from: 'g1',
      to: 'f3',
      san: 'Nf3',
      treeItemId: 'fix01-node-03',
      acceptedUci: ['g1f3'],
      wrongSiblingUci: ['b1c3'],
      hint: {
        piece: 'kingside knight',
        candidateDestinations: ['f3', 'h3'],
        purpose: 'Develop while increasing pressure on the e5 pawn.',
      },
    },
    {
      id: 'fix01-step-04',
      actor: 'opponent',
      from: 'b8',
      to: 'c6',
      san: 'Nc6',
      treeItemId: 'fix01-node-04',
      acceptedUci: ['b8c6'],
    },
    {
      id: 'fix01-step-05',
      actor: 'user',
      from: 'f1',
      to: 'b5',
      san: 'Bb5',
      treeItemId: 'fix01-node-05',
      acceptedUci: ['f1b5'],
      hint: {
        piece: 'light-squared bishop',
        candidateDestinations: ['b5', 'c4', 'e2'],
        purpose: 'Develop with pressure on the knight that supports e5.',
      },
    },
    {
      id: 'fix01-step-06',
      actor: 'opponent',
      from: 'a7',
      to: 'a6',
      san: 'a6',
      treeItemId: 'fix01-node-06',
      acceptedUci: ['a7a6'],
    },
    {
      id: 'fix01-step-07',
      actor: 'user',
      from: 'b5',
      to: 'a4',
      san: 'Ba4',
      treeItemId: 'fix01-node-07',
      acceptedUci: ['b5a4'],
      hint: {
        piece: 'the attacked bishop',
        candidateDestinations: ['a4', 'c4', 'd3'],
        purpose: 'Keep the bishop while preserving pressure on the c6 knight.',
      },
    },
    {
      id: 'fix01-step-08',
      actor: 'opponent',
      from: 'g8',
      to: 'f6',
      san: 'Nf6',
      treeItemId: 'fix01-node-08',
      acceptedUci: ['g8f6'],
    },
  ],
  tree: [
    {
      id: 'fix01-node-01',
      ply: 1,
      visibleLabel: '1. e4',
      maskedLabel: 'Hidden user move',
      status: 'reviewed',
      children: [
        {
          id: 'fix01-node-02',
          ply: 2,
          visibleLabel: '1... e5',
          maskedLabel: 'Hidden opponent reply',
          status: 'reviewed',
          children: [
            {
              id: 'fix01-node-03',
              ply: 3,
              visibleLabel: '2. Nf3',
              maskedLabel: 'Hidden continuation',
              status: 'current',
              children: [
                {
                  id: 'fix01-node-04',
                  ply: 4,
                  visibleLabel: '2... Nc6',
                  maskedLabel: 'Hidden reply',
                  status: 'due',
                  children: [
                    {
                      id: 'fix01-node-05',
                      ply: 5,
                      visibleLabel: '3. Bb5',
                      maskedLabel: 'Hidden continuation',
                      status: 'new',
                      children: [
                        {
                          id: 'fix01-node-06',
                          ply: 6,
                          visibleLabel: '3... a6',
                          maskedLabel: 'Hidden reply',
                          status: 'new',
                          children: [
                            {
                              id: 'fix01-node-07',
                              ply: 7,
                              visibleLabel: '4. Ba4',
                              maskedLabel: 'Hidden continuation',
                              status: 'new',
                              children: [
                                {
                                  id: 'fix01-node-08',
                                  ply: 8,
                                  visibleLabel: '4... Nf6',
                                  maskedLabel: 'Hidden reply',
                                  status: 'new',
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'fix01-sibling-01',
              ply: 3,
              visibleLabel: '2. Nc3',
              maskedLabel: 'Alternative branch',
              status: 'new',
            },
          ],
        },
        {
          id: 'fix01-reply-02',
          ply: 2,
          visibleLabel: '1... c5',
          maskedLabel: 'Alternative reply',
          status: 'new',
          children: [
            {
              id: 'fix01-reply-02-user-01',
              ply: 3,
              visibleLabel: '2. Nf3',
              maskedLabel: 'Hidden continuation',
              status: 'new',
            },
            {
              id: 'fix01-reply-02-user-02',
              ply: 3,
              visibleLabel: '2. Nc3',
              maskedLabel: 'Hidden continuation',
              status: 'new',
            },
          ],
        },
      ],
    },
  ],
};

export const fix02Black: TrainingFixture = {
  id: 'fix-02-black',
  label: 'FIX-02 · Black line',
  description: 'Synthetic black repertoire line proving actor assignment and black orientation.',
  orientation: 'black',
  userColour: 'black',
  initialFen,
  targetPly: 1,
  route: [
    {
      id: 'fix02-step-01',
      actor: 'opponent',
      from: 'e2',
      to: 'e4',
      san: 'e4',
      treeItemId: 'fix02-node-01',
      acceptedUci: ['e2e4'],
    },
    {
      id: 'fix02-step-02',
      actor: 'user',
      from: 'c7',
      to: 'c5',
      san: 'c5',
      treeItemId: 'fix02-node-02',
      acceptedUci: ['c7c5'],
      hint: {
        piece: 'c-pawn',
        candidateDestinations: ['c5', 'c6'],
        purpose: 'Challenge the centre from the flank.',
      },
    },
    {
      id: 'fix02-step-03',
      actor: 'opponent',
      from: 'g1',
      to: 'f3',
      san: 'Nf3',
      treeItemId: 'fix02-node-03',
      acceptedUci: ['g1f3'],
    },
    {
      id: 'fix02-step-04',
      actor: 'user',
      from: 'd7',
      to: 'd6',
      san: 'd6',
      treeItemId: 'fix02-node-04',
      acceptedUci: ['d7d6'],
      wrongSiblingUci: ['b8c6'],
      hint: {
        piece: 'd-pawn',
        candidateDestinations: ['d6', 'd5'],
        purpose: 'Support the centre and prepare controlled development.',
      },
    },
    {
      id: 'fix02-step-05',
      actor: 'opponent',
      from: 'd2',
      to: 'd4',
      san: 'd4',
      treeItemId: 'fix02-node-05',
      acceptedUci: ['d2d4'],
    },
    {
      id: 'fix02-step-06',
      actor: 'user',
      from: 'c5',
      to: 'd4',
      san: 'cxd4',
      treeItemId: 'fix02-node-06',
      acceptedUci: ['c5d4'],
      hint: {
        piece: 'c-pawn',
        candidateDestinations: ['d4'],
        purpose: 'Exchange the central pawn before completing development.',
      },
    },
  ],
  tree: [
    {
      id: 'fix02-node-01',
      ply: 1,
      visibleLabel: '1. e4',
      maskedLabel: 'Hidden opponent move',
      status: 'reviewed',
      children: [
        {
          id: 'fix02-node-02',
          ply: 2,
          visibleLabel: '1... c5',
          maskedLabel: 'Hidden continuation',
          status: 'current',
          children: [
            {
              id: 'fix02-node-03',
              ply: 3,
              visibleLabel: '2. Nf3',
              maskedLabel: 'Hidden opponent move',
              status: 'due',
              children: [
                {
                  id: 'fix02-node-04',
                  ply: 4,
                  visibleLabel: '2... d6',
                  maskedLabel: 'Hidden continuation',
                  status: 'new',
                  children: [
                    {
                      id: 'fix02-node-05',
                      ply: 5,
                      visibleLabel: '3. d4',
                      maskedLabel: 'Hidden opponent move',
                      status: 'new',
                      children: [
                        {
                          id: 'fix02-node-06',
                          ply: 6,
                          visibleLabel: '3... cxd4',
                          maskedLabel: 'Hidden continuation',
                          status: 'new',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const phase2TrainingFixtures = [fix01White, fix02Black] as const;
