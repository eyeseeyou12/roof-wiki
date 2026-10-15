import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { validateVentilationCatalog } from '../scripts/lib/ventilation-catalog.mjs';

const source = JSON.parse(readFileSync(new URL('../content/ventilation-products.json', import.meta.url)));
const slugs = new Set(readdirSync(new URL('../content/components/', import.meta.url)).filter(name => name.endsWith('.md')).map(name => name.slice(0, -3)));
const fixture = () => structuredClone(source);
const product = (catalog, id) => catalog.products.find(item => item.id === id);

test('calculator catalog is valid and every recommendation has a searchable wiki record', () => {
  assert.doesNotThrow(() => validateVentilationCatalog(source, slugs));
  const wiki = JSON.parse(readFileSync(new URL('../content/catalog.json', import.meta.url)));
  for (const entry of source.products) {
    const match = wiki.products.find(item => item.brand === entry.brand && item.model === entry.name);
    assert.ok(match, entry.name);
    assert.equal(match.component, entry.component);
    assert.equal(match.sourceUrl, entry.source);
    assert.equal(match.verifiedOn, entry.verifiedOn);
  }
});

test('exact passive variants and per-section intake conversion retain the manufacturer ratings', () => {
  assert.equal(product(source, 'oc-strip12').nfa, 20);
  assert.equal(product(source, 'oc-strip10').nfa, 18);
  assert.equal(product(source, 'sv10').nfa * product(source, 'sv10').pieceLength, 63);
  assert.equal(product(source, 'hcd144').nfa, 144);
  assert.equal(product(source, 'intakepro').minPitch, 4);
});

test('solar catalog preserves exact sizing rows and keeps airflow separate from NFA', () => {
  assert.deepEqual(product(source, 'prsolar2').sizingRows.at(-1), {area: 3200, count: 5, intake: 1800});
  assert.equal(product(source, 'ab3523').minIntakePerFan, 6 * 144);
  assert.equal(product(source, 'ab3523').cfm, 1775);
  assert.equal(product(source, 'ab3523').maxCoverage, 2850);
  assert.equal(product(source, 'sr1810').minIntakePerFan, null);
  for (const entry of source.products.filter(item => item.kind === 'solar')) assert.equal(entry.nfa, undefined);
});

test('catalog rejects malformed records, invalid dates and sources with actionable errors', () => {
  const malformed = fixture();
  malformed.products.push(null);
  assert.throws(() => validateVentilationCatalog(malformed, slugs), /entries must be objects/);
  for (const date of ['2026-02-31', '2026-13-01', 'bad-date']) {
    const catalog = fixture(); catalog.products[0].verifiedOn = date;
    assert.throws(() => validateVentilationCatalog(catalog, slugs), /invalid verification date/);
  }
  for (const url of ['http://example.com', 'https://', 'https://user:secret@example.com']) {
    const catalog = fixture(); catalog.products[0].source = url;
    assert.throws(() => validateVentilationCatalog(catalog, slugs), /HTTPS/);
  }
  const catalog = fixture(); catalog.products[0].additionalSources = ['javascript:alert(1)'];
  assert.throws(() => validateVentilationCatalog(catalog, slugs), /additional sources/);
});

test('catalog catches mismatched units, impossible pitch ranges and accidental solar NFA', () => {
  for (const mutate of [
    catalog => { product(catalog, 'rigid3').unit = 'vents'; },
    catalog => { product(catalog, '750g').unit = 'linear ft'; },
    catalog => { product(catalog, 'rigid3').minPitch = 17; },
    catalog => { product(catalog, 'sr1810').nfa = 1825; },
    catalog => { product(catalog, 'prsolar2').sizingRows[0].intake = Infinity; },
    catalog => { product(catalog, 'prsolar2').sizingRows.push({area: 800, count: 2, intake: 720}); },
  ]) {
    const catalog = fixture(); mutate(catalog);
    assert.throws(() => validateVentilationCatalog(catalog, slugs));
  }
});
