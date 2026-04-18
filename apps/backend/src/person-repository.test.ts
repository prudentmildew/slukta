import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';
import { openDatabase } from './database.js';
import {
  getPerson,
  listPersons,
  streamAncestors,
} from './person-repository.js';
import type { AncestorRecord } from './types.js';

async function collect(
  iter: AsyncIterable<AncestorRecord>,
): Promise<AncestorRecord[]> {
  const out: AncestorRecord[] = [];
  for await (const r of iter) out.push(r);
  return out;
}

function insertFamily(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO person (id, first_name, last_name, sex, birth_year, death_year) VALUES
      ('child',  'Barn',   'Nordmann', 'male',   2000, NULL),
      ('mom',    'Kari',   'Nordmann', 'female', 1970, NULL),
      ('dad',    'Ola',    'Nordmann', 'male',   1968, NULL),
      ('gmom_m', 'Bestem', 'Hansen',   'female', 1940, 2020),
      ('gdad_m', 'Bested', 'Hansen',   'male',   1938, 2015),
      ('gmom_d', 'Oldem',  'Nordmann', 'female', 1942, NULL),
      ('gdad_d', 'Olded',  'Nordmann', 'male',   1940, NULL);

    INSERT INTO parent_child (parent_id, child_id) VALUES
      ('mom',    'child'),
      ('dad',    'child'),
      ('gmom_m', 'mom'),
      ('gdad_m', 'mom'),
      ('gmom_d', 'dad'),
      ('gdad_d', 'dad');
  `);
}

describe('PersonRepository', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  describe('listPersons', () => {
    it('returns an empty array when no persons exist', () => {
      assert.deepEqual(listPersons(db), []);
    });

    it('returns all persons in the table', () => {
      db.exec(`
        INSERT INTO person (id, first_name, last_name, sex, birth_year, death_year) VALUES
          ('p1', 'Ola', 'Nordmann', 'male', 1950, NULL),
          ('p2', 'Kari', 'Nordmann', 'female', 1952, 2024)
      `);
      const persons = listPersons(db);
      assert.equal(persons.length, 2);
      const byId = new Map(persons.map((p) => [p.id, p]));
      assert.deepEqual(byId.get('p1'), {
        id: 'p1',
        first_name: 'Ola',
        last_name: 'Nordmann',
        sex: 'male',
        birth_year: 1950,
        death_year: null,
      });
      assert.deepEqual(byId.get('p2'), {
        id: 'p2',
        first_name: 'Kari',
        last_name: 'Nordmann',
        sex: 'female',
        birth_year: 1952,
        death_year: 2024,
      });
    });
  });

  describe('getPerson', () => {
    it('returns the matching person', () => {
      db.exec(`
        INSERT INTO person (id, first_name, last_name, sex, birth_year, death_year)
        VALUES ('p1', 'Ola', 'Nordmann', 'male', 1950, NULL)
      `);
      assert.deepEqual(getPerson(db, 'p1'), {
        id: 'p1',
        first_name: 'Ola',
        last_name: 'Nordmann',
        sex: 'male',
        birth_year: 1950,
        death_year: null,
      });
    });

    it('returns null for a nonexistent id', () => {
      assert.equal(getPerson(db, 'ghost'), null);
    });
  });

  describe('streamAncestors', () => {
    it('yields the focus person first at depth 0 with parent IDs', async () => {
      insertFamily(db);
      const records = await collect(
        streamAncestors(db, 'child', { maxDepth: 0 }),
      );
      assert.equal(records.length, 1);
      assert.equal(records[0]?.id, 'child');
      assert.equal(records[0]?.depth, 0);
      assert.deepEqual([...(records[0]?.parents ?? [])].sort(), ['dad', 'mom']);
    });

    it('walks ancestors in BFS order across 3 generations', async () => {
      insertFamily(db);
      const records = await collect(
        streamAncestors(db, 'child', { maxDepth: 20 }),
      );
      assert.equal(records.length, 7);
      assert.equal(records[0]?.id, 'child');
      assert.equal(records[0]?.depth, 0);

      const depths = records.map((r) => r.depth);
      for (let i = 1; i < depths.length; i++) {
        assert.ok(
          (depths[i] ?? 0) >= (depths[i - 1] ?? 0),
          'depths must be non-decreasing (BFS)',
        );
      }

      assert.deepEqual(
        records
          .filter((r) => r.depth === 1)
          .map((r) => r.id)
          .sort(),
        ['dad', 'mom'],
      );
      assert.deepEqual(
        records
          .filter((r) => r.depth === 2)
          .map((r) => r.id)
          .sort(),
        ['gdad_d', 'gdad_m', 'gmom_d', 'gmom_m'],
      );
      for (const r of records.filter((r) => r.depth === 2)) {
        assert.deepEqual(r.parents, []);
      }
    });

    it('stops traversal at maxDepth', async () => {
      insertFamily(db);
      const records = await collect(
        streamAncestors(db, 'child', { maxDepth: 1 }),
      );
      assert.deepEqual(records.map((r) => r.id).sort(), [
        'child',
        'dad',
        'mom',
      ]);
      assert.ok(records.every((r) => r.depth <= 1));
    });

    it('does not loop on a synthetic cycle', async () => {
      db.exec(`
        INSERT INTO person (id, first_name, last_name) VALUES
          ('a', 'A', 'Cycle'),
          ('b', 'B', 'Cycle');
        INSERT INTO parent_child (parent_id, child_id) VALUES
          ('b', 'a'),
          ('a', 'b');
      `);
      const records = await collect(streamAncestors(db, 'a', { maxDepth: 20 }));
      assert.deepEqual(records.map((r) => r.id).sort(), ['a', 'b']);
    });

    it('skips parent IDs that do not resolve to a person', async () => {
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec(`
        INSERT INTO person (id, first_name, last_name) VALUES
          ('solo', 'Solo', 'Person');
        INSERT INTO parent_child (parent_id, child_id) VALUES
          ('ghost', 'solo');
      `);
      db.exec('PRAGMA foreign_keys = ON');

      const records = await collect(
        streamAncestors(db, 'solo', { maxDepth: 5 }),
      );
      assert.equal(records.length, 1);
      assert.equal(records[0]?.id, 'solo');
      assert.deepEqual(records[0]?.parents, ['ghost']);
    });
  });
});
