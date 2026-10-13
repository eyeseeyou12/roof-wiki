const positive = value => Number.isFinite(value) && value > 0;

function validDate(value) {
  const parsed = new Date(value);
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function httpsSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function validateVentilationCatalog(catalog, componentSlugs) {
  if (!catalog || !Array.isArray(catalog.products) || !catalog.products.length) throw new Error('Ventilation catalog needs products.');
  if (typeof catalog.region !== 'string' || !catalog.region.trim()) throw new Error('Ventilation catalog needs a region.');
  if (!validDate(catalog.verifiedOn)) throw new Error('Ventilation catalog has an invalid verification date.');
  const ids = new Set();
  for (const p of catalog.products) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Ventilation product entries must be objects.');
    if (typeof p.id !== 'string' || !p.id.trim() || ids.has(p.id)) throw new Error('Duplicate or missing ventilation product ID.');
    ids.add(p.id);
    for (const key of ['brand','name','component','source','verifiedOn','notes','availability']) if (typeof p[key] !== 'string' || !p[key].trim()) throw new Error(`${p.id}: missing ${key}`);
    if (componentSlugs && !componentSlugs.has(p.component)) throw new Error(`${p.id}: unknown component`);
    if (!['ridge','static','intake','solar'].includes(p.kind)) throw new Error(`${p.id}: invalid kind`);
    for (const key of ['source', 'availabilitySource', 'sizingSource']) if (p[key] != null && !httpsSource(p[key])) throw new Error(`${p.id}: HTTPS ${key} required`);
    if (p.additionalSources != null && (!Array.isArray(p.additionalSources) || p.additionalSources.some(url => !httpsSource(url)))) throw new Error(`${p.id}: invalid additional sources`);
    if (!validDate(p.verifiedOn)) throw new Error(`${p.id}: invalid verification date`);
    if (p.kind !== 'solar' && (!positive(p.nfa) || !['linear ft','vents'].includes(p.unit))) throw new Error(`${p.id}: invalid NFA/unit`);
    if (p.kind === 'ridge' && p.unit !== 'linear ft') throw new Error(`${p.id}: ridge NFA must be per linear ft`);
    if (p.kind === 'static' && p.unit !== 'vents') throw new Error(`${p.id}: static NFA must be per vent`);
    if (p.kind === 'solar' && p.nfa != null) throw new Error(`${p.id}: solar airflow must not be recorded as passive NFA`);
    for (const key of ['pieceLength','cfm','watts','minIntakePerFan','maxCoverage']) if (p[key] != null && !positive(p[key])) throw new Error(`${p.id}: invalid ${key}`);
    for (const key of ['minPitch', 'maxPitch']) if (p[key] != null && (!Number.isFinite(p[key]) || p[key] < 0)) throw new Error(`${p.id}: invalid ${key}`);
    if (p.minPitch != null && p.maxPitch != null && p.minPitch > p.maxPitch) throw new Error(`${p.id}: inverted pitch range`);
    if (p.sizingRows != null) {
      if (p.kind !== 'solar' || !Array.isArray(p.sizingRows) || !p.sizingRows.length) throw new Error(`${p.id}: invalid solar sizing rows`);
      const areas = new Set();
      for (const row of p.sizingRows) {
        if (!row || !positive(row.area) || !Number.isSafeInteger(row.count) || row.count <= 0 || !positive(row.intake) || areas.has(row.area)) throw new Error(`${p.id}: invalid or duplicate solar sizing row`);
        areas.add(row.area);
      }
    }
  }
  return catalog;
}
