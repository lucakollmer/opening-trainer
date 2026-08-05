export type TrainingMode = 'train' | 'browse';

export type TaskFixtureState =
  | 'awaiting-user-move'
  | 'correct-feedback'
  | 'hint-offered'
  | 'line-complete';

export interface RepertoireTreeFixtureItem {
  id: string;
  visibleLabel: string;
  maskedLabel: string;
  status: 'reviewed' | 'current' | 'due' | 'new';
  current?: boolean;
  transposition?: boolean;
  children?: RepertoireTreeFixtureItem[];
}

export const foundationFixture = {
  id: 'foundation-fixture',
  label: 'Synthetic e4 repertoire',
  dueCount: 7,
  sessionProgress: '1 of 12',
  position: 'start',
  orientation: 'white' as const,
  tree: [
    {
      id: 'root-e4',
      visibleLabel: '1. e4',
      maskedLabel: 'Played move',
      status: 'reviewed',
      children: [
        {
          id: 'reply-e5',
          visibleLabel: '1... e5',
          maskedLabel: 'Played reply',
          status: 'reviewed',
          children: [
            {
              id: 'future-nf3',
              visibleLabel: '2. Nf3',
              maskedLabel: 'Hidden continuation',
              status: 'current',
              current: true,
              children: [
                {
                  id: 'future-nc6',
                  visibleLabel: '2... Nc6',
                  maskedLabel: 'Hidden branch',
                  status: 'due',
                  transposition: true,
                },
              ],
            },
          ],
        },
        {
          id: 'reply-c5',
          visibleLabel: '1... c5',
          maskedLabel: 'Alternative reply',
          status: 'new',
        },
      ],
    },
  ] satisfies RepertoireTreeFixtureItem[],
} as const;
