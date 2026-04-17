import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COLUMN_WIDTH,
  computePedigreeLayout,
  ROW_HEIGHT,
} from './computePedigreeLayout.js';
import type { AncestorRecord } from './types.js';

function person(
  id: string,
  depth: number,
  parents: string[] = [],
): AncestorRecord {
  return {
    id,
    first_name: id,
    last_name: id,
    sex: null,
    birth_year: null,
    death_year: null,
    depth,
    parents,
  };
}

describe('computePedigreeLayout', () => {
  it('places a single focus person at the origin with no edges', () => {
    const { nodes, edges } = computePedigreeLayout([person('focus', 0)]);

    assert.deepEqual(nodes, [{ id: 'focus', x: 0, y: 0 }]);
    assert.deepEqual(edges, []);
  });

  it('places parents one row above the focus and emits parent→child edges', () => {
    const { nodes, edges } = computePedigreeLayout([
      person('focus', 0, ['father', 'mother']),
      person('father', 1),
      person('mother', 1),
    ]);

    const focus = nodes.find((n) => n.id === 'focus');
    const father = nodes.find((n) => n.id === 'father');
    const mother = nodes.find((n) => n.id === 'mother');

    assert.ok(focus && father && mother);
    assert.equal(focus.y, 0);
    assert.equal(father.y, -ROW_HEIGHT);
    assert.equal(mother.y, -ROW_HEIGHT);

    const sortedEdges = [...edges].sort((a, b) =>
      a.parentId.localeCompare(b.parentId),
    );
    assert.deepEqual(sortedEdges, [
      { parentId: 'father', childId: 'focus' },
      { parentId: 'mother', childId: 'focus' },
    ]);
  });

  it('lays out persons in the same generation in distinct x slots in input order', () => {
    const { nodes } = computePedigreeLayout([
      person('focus', 0, ['father', 'mother']),
      person('father', 1),
      person('mother', 1),
    ]);

    const father = nodes.find((n) => n.id === 'father');
    const mother = nodes.find((n) => n.id === 'mother');

    assert.ok(father && mother);
    assert.equal(father.x, 0);
    assert.equal(mother.x, COLUMN_WIDTH);
  });

  it('preserves earlier nodes positions when more persons are appended', () => {
    const initial = [
      person('focus', 0, ['father', 'mother']),
      person('father', 1, ['paternal_grandpa']),
      person('mother', 1),
    ];
    const initialLayout = computePedigreeLayout(initial);

    const extended = [
      ...initial,
      person('paternal_grandpa', 2),
      person('paternal_grandma', 2),
    ];
    const extendedLayout = computePedigreeLayout(extended);

    for (const earlier of initialLayout.nodes) {
      const later = extendedLayout.nodes.find((n) => n.id === earlier.id);
      assert.ok(later, `${earlier.id} missing from extended layout`);
      assert.equal(later.x, earlier.x, `${earlier.id} x shifted`);
      assert.equal(later.y, earlier.y, `${earlier.id} y shifted`);
    }

    // Sanity: the new generation lands one row above the previous top row.
    const grandpa = extendedLayout.nodes.find(
      (n) => n.id === 'paternal_grandpa',
    );
    assert.ok(grandpa);
    assert.equal(grandpa.y, -2 * ROW_HEIGHT);
  });
});
