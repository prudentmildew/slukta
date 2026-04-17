import type { AncestorRecord, PedigreeLayout } from './types.js';

export const ROW_HEIGHT = 100;
export const COLUMN_WIDTH = 200;

export function computePedigreeLayout(
  persons: AncestorRecord[],
): PedigreeLayout {
  const slotsByDepth = new Map<number, number>();
  const nodes = persons.map((p) => {
    const slot = slotsByDepth.get(p.depth) ?? 0;
    slotsByDepth.set(p.depth, slot + 1);
    return {
      id: p.id,
      x: slot * COLUMN_WIDTH,
      y: p.depth === 0 ? 0 : -p.depth * ROW_HEIGHT,
    };
  });

  const edges = persons.flatMap((child) =>
    child.parents.map((parentId) => ({ parentId, childId: child.id })),
  );

  return { nodes, edges };
}
