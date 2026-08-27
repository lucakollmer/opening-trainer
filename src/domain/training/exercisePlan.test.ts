import { fix01White } from '../../fixtures/trainingFixtures';
import { compileTrainingFixture } from './exercisePlan';

describe('training exercise-plan compiler', () => {
  it('compiles the accepted PHASE-2 fixture into stable decision identities', () => {
    const plan = compileTrainingFixture(fix01White);
    expect(plan.steps).toHaveLength(fix01White.route.length);
    expect(plan.startStepId).toBe('fix01-step-01');
    expect(plan.targetStepId).toBe('fix01-step-03');
    expect(plan.steps[2]?.acceptedMoveSetKey).toBe('g1f3');
    expect(plan.steps[2]?.acceptedSan).toEqual(['Nf3']);
    expect(plan.steps[2]?.trainingItemId).toContain(':decision:');
  });

  it('keeps future SAN out of the Train tree while retaining the full Browse projection', () => {
    const plan = compileTrainingFixture(fix01White);
    expect(JSON.stringify(plan.tree)).not.toContain('1. e4');
    expect(JSON.stringify(plan.tree)).not.toContain('2. Nf3');
    expect(JSON.stringify(plan.browseTree)).toContain('1. e4');
    expect(JSON.stringify(plan.browseTree)).toContain('2. Nf3');
  });

  it('fails closed when fixture notation or tree identity is inconsistent', () => {
    expect(() =>
      compileTrainingFixture({
        ...fix01White,
        route: fix01White.route.map((step, index) =>
          index === 0 ? { ...step, san: 'd4' } : step,
        ),
      }),
    ).toThrow(/notation mismatch/u);

    expect(() =>
      compileTrainingFixture({
        ...fix01White,
        route: fix01White.route.map((step, index) =>
          index === 0 ? { ...step, treeItemId: 'missing-tree-item' } : step,
        ),
      }),
    ).toThrow(/Missing tree item/u);
  });
});
