import type { Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

// Upsert pulled rows into a Dexie table by domain id. Records with an unpushed
// local change (id in `dirty`) are skipped so a pull never clobbers a pending
// local edit — those resolve on the next push.
//
// Pure (type-only Dexie import) so it can be unit-tested without IndexedDB or
// the Supabase client.
export async function upsertByDomainId<T extends { id: string }>(
  table: Table<T & { localId?: string }>,
  rows: T[],
  dirty: Set<string>
): Promise<void> {
  for (const row of rows) {
    if (dirty.has(row.id)) continue;
    // Preserve the existing localId (the Dexie primary key) so put() replaces
    // the row in place rather than creating a duplicate.
    const existing = await table.where('id').equals(row.id).first();
    const localId = existing?.localId ?? uuidv4();
    await table.put({ ...row, localId } as T & { localId?: string });
  }
}
