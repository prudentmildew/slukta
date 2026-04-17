export type Sex = 'male' | 'female' | null;

export type Person = {
  id: string;
  first_name: string;
  last_name: string;
  sex: Sex;
  birth_year: number | null;
  death_year: number | null;
};

export type AncestorRecord = Person & {
  depth: number;
  parents: string[];
};

export type PositionedNode = {
  id: string;
  x: number;
  y: number;
};

export type Edge = {
  parentId: string;
  childId: string;
};

export type PedigreeLayout = {
  nodes: PositionedNode[];
  edges: Edge[];
};
