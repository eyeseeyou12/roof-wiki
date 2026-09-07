import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { setImmediate } from 'node:timers/promises';

// Run the actual page modules with failed/deferred fetches and a minimal DOM
// boundary. This checks loading/error behavior, not layout or browser rendering.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.value = ''; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(c => c.textContent).join(' '); }
  set innerHTML(value) { this.textContent = value; }
  setAttribute(key, value) { this.attrs[key] = value; }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
}
const source = name => readFileSync(new URL(`../site/js/${name}.mjs`, import.meta.url), 'utf8');
function harness(page, fetch = async () => { throw new Error('offline'); }) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, new Element());
    return nodes.get(id);
  };
  node('calculator-controls').disabled = true; // Initial HTML fieldset state.
  const timers = new Map();
  let reloads = 0;
  let timerId = 0;
  const context = createContext({
    document: {getElementById: node, createElement: tag => new Element(tag), createTextNode: text => ({textContent: text})},
    location: {search: '?q=original', href: 'https://example.test/search?q=original', reload: () => reloads++},
    history: {replaceState() {}}, URL, URLSearchParams, fetch,
    createSearchIndex: () => ({}), search: () => [], logSearchMiss() {},
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  for (const name of ['render', 'data', page]) {
    const code = source(name).replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/^export /gm, '');
    runInContext(code, context, {filename: `${name}.mjs`});
  }
  return {node, nodes, timers, reloads: () => reloads};
}
const descendants = node => [node, ...node.children.flatMap(descendants)];

for (const [page, output, title] of [
  ['browse-page', 'category-list', null],
  ['category-page', 'component-list', 'category-title'],
  ['component-page', 'component-body', 'component-title'],
  ['search-page', 'results', null],
  ['calculator-page', 'results-container', null],
]) {
  test(`${page}: failed data shows an announced error and working reload action`, async () => {
    const h = harness(page);
    await setImmediate();
    const rendered = descendants(h.node(output));
    assert.ok(rendered.some(n => n.attrs?.role === 'alert'));
    assert.match(h.node(output).textContent, /could not load/);
    const button = rendered.find(n => n.tag === 'button');
    assert.equal(button.textContent, 'Reload page');
    button.listeners.click();
    assert.equal(h.reloads(), 1);
    if (title) assert.match(h.node(title).textContent, /unavailable/);
    if (page === 'calculator-page') {
      assert.equal(h.node('calculator-controls').disabled, true);
      h.node('calculator-form').listeners.submit({preventDefault() {}});
      assert.match(h.node(output).textContent, /could not load/);
    }
    if (page === 'search-page') {
      h.node('q').value = '';
      h.node('q').listeners.input();
      assert.match(h.node(output).textContent, /could not load/);
    }
  });
}

test('search preserves edits during a slow load and cancels logging when cleared', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const h = harness('search-page', async () => { await pending; return {ok: true, json: async () => []}; });
  assert.equal(h.node('q').value, 'original');
  h.node('q').value = 'box vent';
  h.node('q').listeners.input();
  assert.match(h.node('search-status').textContent, /Loading/);
  release();
  await setImmediate();
  assert.equal(h.node('q').value, 'box vent');
  assert.match(h.node('search-status').textContent, /box vent/);
  assert.equal(h.timers.size, 1);
  h.node('q').value = '';
  h.node('q').listeners.input();
  assert.equal(h.timers.size, 0);
});
