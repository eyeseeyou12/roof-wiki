import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSearchIndex, search } from '../scripts/lib/query.mjs';
const components = JSON.parse(readFileSync(new URL('../dist/data/components.json', import.meta.url)));
const index = createSearchIndex(JSON.parse(readFileSync(new URL('../dist/data/search-index.json', import.meta.url))));
const results = q => search(index, components, q).map(r => r.slug);
test('exact field nickname ranks correctly', () => assert.equal(results('box vent')[0], 'static-roof-vent'));
test('ambiguous aliases preserve both component classes', () => {
  assert.ok(results('louver vent').includes('static-roof-vent'));
  assert.ok(results('louver vent').includes('gable-vent'));
});
test('description and alias terms can match together', () => assert.equal(results('humid bathroom air')[0], 'bath-exhaust-roof-vent'));
test('appearance words span recorded fields', () => assert.equal(results('plastic square vent')[0], 'static-roof-vent'));
test('brand and exact model find the linked component', () => {
  assert.equal(results('Broan 634M')[0], 'bath-exhaust-roof-vent');
  assert.equal(results('Cobra Rigid Vent 3')[0], 'ridge-vent');
});
test('transposed letters remain searchable', () => assert.equal(results('turtel vent')[0], 'static-roof-vent'));
test('unrelated and blank queries produce no guessed answer', () => {
  assert.deepEqual(results('banana satellite'), []);
  assert.deepEqual(results('   '), []);
});
test('catalog publishes three sourced examples and no invented Xactimate mappings', () => {
  const products = Object.values(components).flatMap(c => c.products);
  assert.equal(products.length, 3);
  assert.ok(products.every(p => p.sourceUrl.startsWith('https://') && p.verifiedOn));
  assert.ok(Object.values(components).every(c => c.xactimate.length === 0));
});

test('model punctuation and spacing do not hide product matches', () => {
  for (const q of ['750-G', '750G', 'Lomanco 750 G']) {
    assert.equal(results(q)[0], 'static-roof-vent');
  }
  assert.equal(results('Broan 634 M')[0], 'bath-exhaust-roof-vent');
  for (const q of ['Lomanco 750X', 'Lomanco 750A', 'Lomanco 750-A']) {
    assert.deepEqual(results(q), []);
  }
});
