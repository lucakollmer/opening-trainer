import { TsFsrsSchedulerAdapter } from './tsFsrsAdapter';

const now = new Date('2026-08-28T10:00:00.000Z');

describe('ts-fsrs infrastructure adapter', () => {
  it('keeps ts-fsrs behind project-owned portable state and deterministic parameters', () => {
    const adapter = new TsFsrsSchedulerAdapter();
    const state = adapter.createNew(now);
    const configuration = JSON.parse(adapter.serializeConfiguration()) as Record<
      string,
      unknown
    >;

    expect(state.stage).toBe('new');
    expect(configuration.enable_fuzz).toBe(false);
    expect(adapter.adapterVersion).toBe('ts-fsrs@5.4.1');
    expect(adapter.parametersVersion).toBe('phase5-default-v1');
  });

  it('rejects unnamed parameter configurations instead of mislabelling them', () => {
    expect(
      () => new TsFsrsSchedulerAdapter('phase5-unknown-v1' as never),
    ).toThrow(/Unsupported FSRS parameter profile/u);
  });

  it('round-trips a review without exposing a ts-fsrs Card', () => {
    const adapter = new TsFsrsSchedulerAdapter();
    const result = adapter.review(adapter.createNew(now), 'Good', now);
    expect(result.state.reps).toBe(1);
    expect(new Date(result.state.dueAt).getTime()).toBeGreaterThan(now.getTime());
    expect(result.retrievability).toBeGreaterThanOrEqual(0);
    expect(result.retrievability).toBeLessThanOrEqual(1);
  });
});
