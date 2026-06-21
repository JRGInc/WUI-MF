import { describe, it, expect } from 'vitest';
import type { Table } from 'dexie';
import { upsertByDomainId } from './syncUpsert';

// Minimal stand-in for the slice of the Dexie Table API upsertByDomainId uses:
// where('id').equals(v).first() and put(). Keeps the test free of IndexedDB.
interface Row {
  id: string;
  localId?: string;
  value?: string;
}

class FakeTable {
  records: Row[] = [];

  where(field: keyof Row) {
    return {
      equals: (val: unknown) => ({
        first: async () => this.records.find((r) => r[field] === val),
      }),
    };
  }

  async put(obj: Row) {
    const idx = this.records.findIndex((r) => r.localId === obj.localId);
    if (idx >= 0) this.records[idx] = obj;
    else this.records.push(obj);
    return obj.localId;
  }
}

function asTable(t: FakeTable): Table<Row & { localId?: string }> {
  return t as unknown as Table<Row & { localId?: string }>;
}

describe('upsertByDomainId', () => {
  it('inserts new rows and assigns a localId', async () => {
    const t = new FakeTable();
    await upsertByDomainId(
      asTable(t),
      [
        { id: 'a', value: '1' },
        { id: 'b', value: '2' },
      ],
      new Set()
    );
    expect(t.records).toHaveLength(2);
    expect(t.records.every((r) => typeof r.localId === 'string' && r.localId.length > 0)).toBe(true);
  });

  it('updates an existing row in place, preserving its localId (no duplicate)', async () => {
    const t = new FakeTable();
    await upsertByDomainId(asTable(t), [{ id: 'a', value: 'original' }], new Set());
    const originalLocalId = t.records[0].localId;

    await upsertByDomainId(asTable(t), [{ id: 'a', value: 'updated' }], new Set());

    expect(t.records).toHaveLength(1);
    expect(t.records[0].value).toBe('updated');
    expect(t.records[0].localId).toBe(originalLocalId);
  });

  it('skips an existing row whose id has an unpushed local change', async () => {
    const t = new FakeTable();
    await upsertByDomainId(asTable(t), [{ id: 'a', value: 'local-edit' }], new Set());

    // Pull brings a remote version, but 'a' is dirty → must not clobber.
    await upsertByDomainId(asTable(t), [{ id: 'a', value: 'remote' }], new Set(['a']));

    expect(t.records).toHaveLength(1);
    expect(t.records[0].value).toBe('local-edit');
  });

  it('does not insert a brand-new row whose id is dirty', async () => {
    const t = new FakeTable();
    await upsertByDomainId(asTable(t), [{ id: 'c', value: 'x' }], new Set(['c']));
    expect(t.records).toHaveLength(0);
  });

  it('handles a mixed batch: insert, update, and skip together', async () => {
    const t = new FakeTable();
    await upsertByDomainId(asTable(t), [{ id: 'a', value: 'a0' }], new Set());
    const aLocalId = t.records[0].localId;

    await upsertByDomainId(
      asTable(t),
      [
        { id: 'a', value: 'a1' }, // update
        { id: 'b', value: 'b0' }, // insert
        { id: 'd', value: 'd0' }, // skipped (dirty)
      ],
      new Set(['d'])
    );

    expect(t.records.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(t.records.find((r) => r.id === 'a')?.value).toBe('a1');
    expect(t.records.find((r) => r.id === 'a')?.localId).toBe(aLocalId);
  });
});
