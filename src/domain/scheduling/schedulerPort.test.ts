import { FsrsSchedulingFoundationAdapter } from './schedulerPort';

describe('FSRS scheduling foundation adapter', () => {
  it('constructs behind the project port and serializes its configuration', () => {
    const adapter = new FsrsSchedulingFoundationAdapter();
    const card = adapter.createCard();
    const configuration = JSON.parse(adapter.serializeConfiguration()) as Record<
      string,
      unknown
    >;

    expect(card).toBeDefined();
    expect(configuration.enable_fuzz).toBe(false);
  });
});
