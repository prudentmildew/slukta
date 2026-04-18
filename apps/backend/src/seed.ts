import { openDatabase } from './database.js';
import type { Person } from './types.js';

type PersonRow = readonly [
  id: string,
  first_name: string,
  last_name: string,
  sex: Person['sex'],
  birth_year: number | null,
  death_year: number | null,
];

const persons: readonly PersonRow[] = [
  // Generation 0 — focus
  ['focus', 'Liv', 'Solberg', 'female', 2000, null],

  // Generation 1 — parents
  ['mom', 'Ingrid', 'Haugen', 'female', 1972, null],
  ['dad', 'Erik', 'Solberg', 'male', 1970, null],

  // Generation 2 — grandparents (maternal)
  ['gmom-m', 'Astrid', 'Haugen', 'female', 1945, 2018],
  ['gdad-m', 'Harald', 'Haugen', 'male', 1943, 2020],
  // Generation 2 — grandparents (paternal)
  ['gmom-d', 'Sigrid', 'Solberg', 'female', 1942, null],
  ['gdad-d', 'Torbjorn', 'Solberg', 'male', 1940, 2019],

  // Generation 3 — maternal-maternal great-grandparents
  ['ggmom-mm', 'Ragnhild', 'Dahl', 'female', 1920, 1995],
  ['ggdad-mm', 'Olav', 'Dahl', 'male', 1918, 1990],
];

const relationships: ReadonlyArray<readonly [string, string]> = [
  ['mom', 'focus'],
  ['dad', 'focus'],
  ['gmom-m', 'mom'],
  ['gdad-m', 'mom'],
  ['gmom-d', 'dad'],
  ['gdad-d', 'dad'],
  ['ggmom-mm', 'gmom-m'],
  ['ggdad-mm', 'gmom-m'],
];

const dbPath = process.env.SLUKTA_DB_PATH ?? 'data/poc.sqlite';
const db = openDatabase(dbPath);

const insertPerson = db.prepare(`
  INSERT OR REPLACE INTO person (id, first_name, last_name, sex, birth_year, death_year)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const insertParentChild = db.prepare(`
  INSERT OR REPLACE INTO parent_child (parent_id, child_id)
  VALUES (?, ?)
`);

for (const p of persons) {
  insertPerson.run(...p);
}
for (const [parentId, childId] of relationships) {
  insertParentChild.run(parentId, childId);
}

db.close();
console.log(
  `Seeded ${persons.length} persons and ${relationships.length} parent-child relationships into ${dbPath}`,
);
