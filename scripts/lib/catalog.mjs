// Shared catalog contract for validation and builds.
export function validateCatalog(catalog, slugs) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new Error('catalog must be an object');
  const ids = new Set();
  for (const kind of ['products', 'xactimate']) {
    if (!Array.isArray(catalog[kind])) throw new Error(`catalog.${kind} must be an array`);
    for (const item of catalog[kind]) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`catalog.${kind} entries must be objects`);
      const required = kind === 'products'
        ? ['id', 'component', 'brand', 'model', 'description', 'sourceUrl', 'verifiedOn']
        : ['id', 'component', 'category', 'selector', 'description', 'unit', 'priceList', 'source', 'verifiedOn'];
      for (const field of required) if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`catalog ${kind}: missing ${field}`);
      if (ids.has(item.id)) throw new Error(`duplicate catalog id: ${item.id}`);
      ids.add(item.id);
      if (!slugs.has(item.component)) throw new Error(`unknown catalog component: ${item.component}`);
      const date = new Date(item.verifiedOn);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.verifiedOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.verifiedOn) {
        throw new Error(`catalog ${item.id}: invalid verification date ${item.verifiedOn}`);
      }
      if (kind === 'products') {
        if (new URL(item.sourceUrl).protocol !== 'https:') throw new Error('product sources must use HTTPS');
        if (!item.specs || Array.isArray(item.specs) || typeof item.specs !== 'object' || Object.values(item.specs).some(v => typeof v !== 'string')) throw new Error('product specs must be text key/value pairs');
      }
    }
  }
}
