import Dexie, { type EntityTable } from 'dexie';

export interface FoundationRecord {
  id: string;
  label: string;
}

export class FoundationDemoDatabase extends Dexie {
  public records!: EntityTable<FoundationRecord, 'id'>;

  public constructor(name: string) {
    super(name);
    this.version(1).stores({
      records: 'id',
    });
  }
}
