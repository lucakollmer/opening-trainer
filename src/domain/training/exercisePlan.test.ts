import { fix01White } from '../../fixtures/trainingFixtures';
import { compileTrainingFixture } from './exercisePlan';

describe('training exercise plan compiler', () => {
  it('validates and compiles the accepted Phase 2 fixture into stable decision identities', () => {
    const plan = compileTrainingFixture(fix01White);
    expect(plan.firstStepId).toBe('fix01-step-01');
    expect(plan.targetStepId).toBe('fix01-step-03');
    expect(plan.steps['fix01-step-03']?.trainingItemId).toBe(
      'fix-01-white:fix01-step-03',
    );
    expect(plan.steps['fix01-step-03']?.acceptedMoveSetKey).toBe('g1f3');
  });

  it('rejects a route whose expected move is absent from the accepted set', () => {
    const broken = {
      ...fix01White,
      route: fix01White.route.map((step, index) =>
        index === 0 ? { ...step, acceptedUci: ['d2d4'] as const } : step,
      ),
    };
    expect(() => compileTrainingFixture(broken)).toThrow(/absent from its accepted set/u);
  });

  it('rejects stale SAN and missing tree references before a session starts', () => {
    const badSan = {
      ...fix01White,
      route: fix01White.route.map((step, index) =>
        index === 0 ? { ...step, san: 'd4' } : step,
      ),
    };
    expect(() => compileTrainingFixture(badSan)).toThrow(/SAN mismatch/u);
    const badTree = {
      ...fix01White,
      route: fix01White.route.map((step, index) =>
        index === 0 ? { ...step, treeItemId: 'missing' } : step,
      ),
    };
    expect(() => compileTrainingFixture(badTree)).toThrow(/missing tree item/u);
  });
});
