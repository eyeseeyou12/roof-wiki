-- Production D1 migration. This is the one table that lives outside the
-- rebuilt-from-scratch content database, because it accumulates real
-- traffic that has to survive across deploys.
--
-- clicked_component_slug (not clicked_component_id): component data lives
-- in a different database (the static content DB, exported to JSON for
-- the client) so a real foreign key isn't possible here. Slugs are the
-- stable, unenforced reference — the same identifier the client already
-- has loaded and the same one used in URLs.

CREATE TABLE search_miss (
  id                      INTEGER PRIMARY KEY,
  query                   TEXT NOT NULL,
  normalized_query        TEXT NOT NULL,
  result_count            INTEGER NOT NULL,
  clicked_component_slug  TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_search_miss_normalized_query ON search_miss(normalized_query);
CREATE INDEX idx_search_miss_created_at ON search_miss(created_at);
