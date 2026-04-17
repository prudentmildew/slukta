CREATE TABLE IF NOT EXISTS person (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  sex TEXT,
  birth_year INTEGER,
  death_year INTEGER
);

CREATE TABLE IF NOT EXISTS parent_child (
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  PRIMARY KEY (parent_id, child_id),
  FOREIGN KEY (parent_id) REFERENCES person(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES person(id) ON DELETE CASCADE
);
