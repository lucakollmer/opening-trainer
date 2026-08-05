import { FoundationDemoDatabase } from './demoDatabase';

describe('FoundationDemoDatabase', () => {
  it('creates, reads and deletes an isolated fake IndexedDB record', async () => {
    const database = new FoundationDemoDatabase(
      `opening-trainer-foundation-${crypto.randomUUID()}`,
    );

    try {
      await database.records.add({ id: 'record-1', label: 'Fixture record' });
      await expect(database.records.get('record-1')).resolves.toEqual({
        id: 'record-1',
        label: 'Fixture record',
      });
      await database.records.delete('record-1');
      await expect(database.records.get('record-1')).resolves.toBeUndefined();
    } finally {
      database.close();
      await database.delete();
    }
  });
});
