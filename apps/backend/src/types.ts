export type Sex = 'male' | 'female';

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  sex: Sex | null;
  birth_year: number | null;
  death_year: number | null;
}

export interface AncestorRecord extends Person {
  depth: number;
  parents: string[];
}
