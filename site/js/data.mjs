// Fetches and caches dist/data/*.json (copied to /data/ at build time).
// Every page that needs content data goes through this module so the
// JSON is only fetched once per page load regardless of how many
// widgets on that page need it.

const cache = new Map();

function loadJson(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(path).then((res) => {
        if (!res.ok) throw new Error(`failed to load ${path}: ${res.status}`);
        return res.json();
      })
    );
  }
  return cache.get(path);
}

export const loadComponents = () => loadJson('/data/components.json');
export const loadCategories = () => loadJson('/data/categories.json');
export const loadSearchIndex = () => loadJson('/data/search-index.json');
export const loadProducts = () => loadJson('/data/products.json');
