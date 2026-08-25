import { fix01White } from '../../fixtures/trainingFixtures';
import { projectTrainingTree } from './treeProjection';

describe('safe tree projection', () => {
  it('does not carry the hidden visible answer into Train-mode projection objects', () => {
    const projected = projectTrainingTree(fix01White.tree, 'train', []);
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain('1. e4');
    expect(serialized).not.toContain('2. Nf3');
    expect(serialized).toContain('Hidden user move');
  });

  it('reveals only explicitly revealed answers', () => {
    const projected = projectTrainingTree(fix01White.tree, 'train', [
      'fix01-node-01',
    ]);
    const serialized = JSON.stringify(projected);
    expect(serialized).toContain('1. e4');
    expect(serialized).not.toContain('1... e5');
  });
});
