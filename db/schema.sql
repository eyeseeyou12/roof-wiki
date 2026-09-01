-- roof-wiki content database schema
--
-- This is the build-time database: the seed build script reads
-- content/components/*.md, loads them in against this schema, and the
-- static site + client search index are generated from the result. It is
-- rebuilt from scratch on every build, not migrated incrementally — this
-- file is the single source of truth for its shape.
--
-- The one table NOT built here is search_miss, which lives in production
-- (Cloudflare D1) since it accumulates real traffic. See
-- db/migrations/0001_search_miss.sql.

PRAGMA foreign_keys = ON;

-- Components and rules. entry_type distinguishes a physical thing
-- (pipe boot, ridge vent) from a governing rule (1/150 ratio, "don't mix
-- exhaust types") that applies across many components but belongs to none.
CREATE TABLE component (
  id                 INTEGER PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  display_name       TEXT NOT NULL,
  entry_type         TEXT NOT NULL CHECK (entry_type IN ('component', 'rule')),
  summary            TEXT NOT NULL,
  description        TEXT NOT NULL,
  function           TEXT NOT NULL,
  replacement_notes  TEXT,
  measurement_notes  TEXT,
  failure_modes      TEXT,
  disambiguation     TEXT,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed')),
  confidence         TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'thin')),
  sources            TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TRIGGER component_set_updated_at
AFTER UPDATE ON component
FOR EACH ROW
BEGIN
  UPDATE component SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
END;

-- The primary search path. One alias can point at more than one
-- component (e.g. "louver vent" -> gable_vent and box_vent) — that's
-- intentional, search must return both rather than pick one.
CREATE TABLE alias (
  id               INTEGER PRIMARY KEY,
  component_id     INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  normalized_name  TEXT NOT NULL,
  dialect          TEXT NOT NULL CHECK (dialect IN ('field', 'manufacturer', 'code', 'adjuster', 'brand', 'descriptive')),
  region           TEXT,
  notes            TEXT,
  -- Same alias twice for the same component is redundant, not ambiguous —
  -- that's what this guards against. Two different components sharing a
  -- normalized_name is fine and expected.
  UNIQUE (component_id, normalized_name)
);

CREATE INDEX idx_alias_normalized_name ON alias(normalized_name);
CREATE INDEX idx_alias_component_id ON alias(component_id);

CREATE TABLE category (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  parent_id   INTEGER REFERENCES category(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_category_parent_id ON category(parent_id);

-- A component can appear in more than one branch of the category tree.
CREATE TABLE component_category (
  component_id  INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
  category_id   INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
  PRIMARY KEY (component_id, category_id)
);

CREATE INDEX idx_component_category_category_id ON component_category(category_id);

-- governed_by / part_of are naturally one-directional (a rule governs a
-- component; a part belongs to an assembly). see_also and confused_with
-- are naturally symmetric — the seed build script is responsible for
-- inserting both directions for those two link_types so query code never
-- has to special-case direction per link_type.
CREATE TABLE component_link (
  from_component_id  INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
  to_component_id    INTEGER NOT NULL REFERENCES component(id) ON DELETE CASCADE,
  link_type           TEXT NOT NULL CHECK (link_type IN ('governed_by', 'see_also', 'part_of', 'confused_with')),
  note                TEXT,
  PRIMARY KEY (from_component_id, to_component_id, link_type),
  CHECK (from_component_id != to_component_id)
);

CREATE INDEX idx_component_link_to ON component_link(to_component_id);
