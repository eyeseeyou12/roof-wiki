// Isomorphic query layer: no Node-only APIs, so this same module runs
// both in a build-time/CLI context and, unmodified, in the browser once
// dist/data/*.json is fetched there. Everything here operates on
// already-loaded JS objects (the shape scripts/build.mjs writes) rather
// than reading files itself.
import MiniSearch from 'minisearch';

export function createSearchIndex(searchIndexRows) {
  const mini = new MiniSearch({
    idField: 'id',
    fields: ['text'],
    storeFields: ['componentSlug', 'componentName', 'text', 'dialect', 'kind', 'notes'],
  });
  mini.addAll(searchIndexRows);
  return mini;
}

// Fuzzy + prefix search over names and aliases. Never collapses a
// shared alias down to one component — every component with a matching
// alias is returned, each labeled with the specific alias and dialect
// that matched, so a "louver vent" search surfaces both gable vent and
// box vent rather than guessing.
export function search(miniIndex, componentsBySlug, queryText, { limit = 5, scoreCutoffRatio = 0.4 } = {}) {
  const trimmed = queryText.trim();
  if (!trimmed) return [];

  // AND-combine query terms: a multi-word query like "louver vent" only
  // matches documents containing both words. Without this, "vent" alone
  // — a substring of nearly every alias in this domain — lights up
  // almost the whole index at a low score, burying the real matches in
  // noise. combineWith: 'AND' plus the score-relative cutoff below are
  // both there for the same reason: a confident-looking wrong answer is
  // worse than an empty result.
  const hits = miniIndex.search(trimmed, {
    fuzzy: 0.2,
    prefix: true,
    combineWith: 'AND',
    boost: { text: 1 },
  });

  const bySlug = new Map();
  for (const hit of hits) {
    const component = componentsBySlug[hit.componentSlug];
    if (!component) continue;
    if (!bySlug.has(hit.componentSlug)) {
      bySlug.set(hit.componentSlug, {
        slug: hit.componentSlug,
        displayName: component.displayName,
        summary: component.summary,
        entryType: component.entryType,
        disambiguation: component.disambiguation,
        score: hit.score,
        matches: [],
      });
    }
    const entry = bySlug.get(hit.componentSlug);
    entry.score = Math.max(entry.score, hit.score);
    entry.matches.push({ text: hit.text, dialect: hit.dialect, kind: hit.kind });
  }

  const ranked = [...bySlug.values()].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;
  return ranked
    .filter((r) => r.score >= topScore * scoreCutoffRatio)
    .slice(0, limit);
}

export function browseCategory(categories, componentsBySlug, categorySlug) {
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) return null;
  return {
    ...category,
    components: category.componentSlugs
      .map((slug) => componentsBySlug[slug])
      .filter(Boolean)
      .map((c) => ({ slug: c.slug, displayName: c.displayName, summary: c.summary, entryType: c.entryType })),
  };
}

export function listCategories(categories) {
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    parentSlug: c.parentSlug,
    sortOrder: c.sortOrder,
    componentCount: c.componentSlugs.length,
  }));
}

export function getComponent(componentsBySlug, slug) {
  return componentsBySlug[slug] || null;
}

export function normalizeQuery(queryText) {
  return queryText.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Fire-and-forget: a search_miss write should never block or fail the
// search UI. Swallows any network error (including "no signal," which
// is an expected, not exceptional, state for this app). The server
// recomputes the normalized form itself rather than trusting the
// client's copy — see functions/api/log-search.js.
export async function logSearchMiss(endpointUrl, { query, resultCount, clickedComponentSlug = null }) {
  try {
    await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, resultCount, clickedComponentSlug }),
    });
  } catch {
    // offline or endpoint unreachable — logging is best-effort only
  }
}
