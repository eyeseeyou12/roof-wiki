// Isomorphic query layer: no Node-only APIs, so this same module runs
// both in a build-time/CLI context and, unmodified, in the browser once
// dist/data/*.json is fetched there. Everything here operates on
// already-loaded JS objects (the shape scripts/build.mjs writes) rather
// than reading files itself.
import MiniSearch from 'minisearch';

const STOP_WORDS = new Set('a an the is it its this that what where on in at of for to with and or my i have need looking like looks roof roofing'.split(' '));
function tokens(text) {
  // Keep model suffixes attached: 750-G, 750 G, and 750G share one token.
  // A different suffix must not match an unrelated word in the description.
  return normalizeQuery(text)
    .replace(/\b(\d+)\s+([a-z])\b/g, '$1$2')
    .split(' ').filter(term => term && !STOP_WORDS.has(term));
}

export function createSearchIndex(searchIndexRows) {
  const mini = new MiniSearch({
    idField: 'id',
    fields: ['text', 'aliases', 'description', 'products'],
    storeFields: ['componentSlug', 'text', 'aliases', 'description', 'products'],
    tokenize: tokens,
  });
  mini.addAll(searchIndexRows);
  return mini;
}

// All significant words must match, but may occur in different fields.
// Descriptions only use existing content; search never synthesizes facts.
export function search(miniIndex, componentsBySlug, queryText, { limit = 5, scoreCutoffRatio = 0.25 } = {}) {
  const query = tokens(queryText).join(' ');
  if (!query) return [];
  const hits = miniIndex.search(query, {
    fuzzy: term => term.length >= 5 ? 0.34 : false,
    prefix: true,
    combineWith: 'AND',
    boost: { text: 6, aliases: 4, products: 3, description: 1 },
  });
  const bySlug = new Map();
  for (const hit of hits) {
    const c = componentsBySlug[hit.componentSlug];
    if (!c) continue;
    const exact = [c.displayName, ...c.aliases.map(a => a.name)].some(t => normalizeQuery(t) === normalizeQuery(queryText));
    const matchedFields = [...new Set(Object.values(hit.match || {}).flat())];
    const labels = { text: 'Name', aliases: 'Also known as', description: 'Description / purpose', products: 'Product / specification' };
    const result = {
      slug: c.slug, displayName: c.displayName, summary: c.summary,
      entryType: c.entryType, disambiguation: c.disambiguation,
      score: hit.score * (exact ? 3 : 1),
      matches: matchedFields.map(field => ({ kind: field, text: labels[field] || field })),
    };
    if (!bySlug.has(c.slug) || bySlug.get(c.slug).score < result.score) bySlug.set(c.slug, result);
  }
  const ranked = [...bySlug.values()].sort((a,b) => b.score - a.score);
  return ranked.filter(r => r.score >= (ranked[0]?.score || 0) * scoreCutoffRatio).slice(0, limit);
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
