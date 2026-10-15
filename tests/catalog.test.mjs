import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCatalog } from '../scripts/lib/catalog.mjs';

const source = JSON.parse(readFileSync(new URL('../content/catalog.json', import.meta.url)));
const slugs = new Set(source.products.map(p => p.component));
const fixture = () => structuredClone(source);

test('the shipped manufacturer catalog satisfies the shared contract', () => {
  assert.doesNotThrow(() => validateCatalog(fixture(), slugs));
});

test('verification dates must exist on the calendar', () => {
  for (const date of ['2026-02-31', '2025-02-29', '2026-04-31', '2026-13-01', 'not-a-date']) {
    const catalog = fixture();
    catalog.products[0].verifiedOn = date;
    assert.throws(() => validateCatalog(catalog, slugs), /invalid verification date/);
  }
  const catalog = fixture();
  catalog.products[0].verifiedOn = '2024-02-29';
  assert.doesNotThrow(() => validateCatalog(catalog, slugs));
});

test('malformed catalog entries give actionable errors', () => {
  assert.throws(() => validateCatalog(null, slugs), /catalog must be an object/);
  assert.throws(() => validateCatalog({products: [null], xactimate: []}, slugs), /entries must be objects/);
});

test('unknown components and duplicate IDs cannot publish', () => {
  const unknown = fixture();
  unknown.products[0].component = 'unknown-component';
  assert.throws(() => validateCatalog(unknown, slugs), /unknown catalog component/);
  const duplicate = fixture();
  duplicate.products.push(structuredClone(duplicate.products[0]));
  assert.throws(() => validateCatalog(duplicate, slugs), /duplicate catalog id/);
});

test('manufacturer records require HTTPS sources and textual specs', () => {
  const catalog = fixture();
  catalog.products[0].sourceUrl = 'http://example.com';
  assert.throws(() => validateCatalog(catalog, slugs), /HTTPS/);
  catalog.products[0].sourceUrl = source.products[0].sourceUrl;
  catalog.products[0].specs = {size: 6};
  assert.throws(() => validateCatalog(catalog, slugs), /text key\/value pairs/);
});

test('incomplete Xactimate references cannot publish', () => {
  const catalog = fixture();
  catalog.xactimate.push({id: 'incomplete-test-reference', component: 'ridge-vent'});
  assert.throws(() => validateCatalog(catalog, slugs), /missing category/);
});
