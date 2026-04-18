import type { DatabaseSync } from 'node:sqlite';
import type { AncestorRecord, Person } from './types.js';

export interface StreamAncestorsOptions {
  maxDepth?: number;
}

export function listPersons(db: DatabaseSync): Person[] {
  const rows = db.prepare('SELECT * FROM person').all();
  return rows.map(rowToPerson);
}

export function getPerson(db: DatabaseSync, id: string): Person | null {
  const row = db.prepare('SELECT * FROM person WHERE id = ?').get(id);
  return row ? rowToPerson(row) : null;
}

export async function* streamAncestors(
  db: DatabaseSync,
  id: string,
  options: StreamAncestorsOptions = {},
): AsyncIterable<AncestorRecord> {
  const maxDepth = options.maxDepth ?? 20;
  const personStmt = db.prepare('SELECT * FROM person WHERE id = ?');
  const parentsStmt = db.prepare(
    'SELECT parent_id FROM parent_child WHERE child_id = ?',
  );

  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id, depth: 0 }];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;
    if (visited.has(next.id)) continue;
    visited.add(next.id);

    const row = personStmt.get(next.id);
    if (!row) continue;

    const parentRows = parentsStmt.all(next.id) as Array<{ parent_id: string }>;
    const parents = parentRows.map((r) => r.parent_id);

    yield { ...rowToPerson(row), depth: next.depth, parents };

    if (next.depth < maxDepth) {
      for (const parentId of parents) {
        if (!visited.has(parentId)) {
          queue.push({ id: parentId, depth: next.depth + 1 });
        }
      }
    }
  }
}

function rowToPerson(row: unknown): Person {
  const r = row as Record<string, unknown>;
  return {
    id: r.id as string,
    first_name: r.first_name as string,
    last_name: r.last_name as string,
    sex: (r.sex ?? null) as Person['sex'],
    birth_year: (r.birth_year ?? null) as number | null,
    death_year: (r.death_year ?? null) as number | null,
  };
}
