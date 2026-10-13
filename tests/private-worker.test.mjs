import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrivateWorker } from '../scripts/lib/private-worker.mjs';
import { protectSite } from '../scripts/lib/private-site-build.mjs';
import { onRequestPost, onRequestGet } from '../functions/api/log-search.js';

// Deliberately a test-only credential, unrelated to the review deployment.
const password = 'private-worker-unit-test-password';
const hash = createHash('sha256').update(password).digest('hex');
const auth = 'Basic ' + btoa('roofwiki:' + password);
const assets = {
  '/index.html': { body: '<h1>Private home</h1>', type: 'text/html; charset=utf-8' },
  '/calculator.html': { body: '<h1>Private planner</h1>', type: 'text/html; charset=utf-8' },
  '/data/products.json': { body: '{"products":[]}', type: 'application/json; charset=utf-8' },
  '/js/planner.mjs': { body: 'export default true;', type: 'application/javascript; charset=utf-8' },
  '/example.png': { body: Buffer.from([0, 255, 128, 10]).toString('base64'), base64: true, type: 'image/png' },
};
const worker = createPrivateWorker(assets, hash, { POST: onRequestPost, GET: onRequestGet });
const request = (path, options = {}) => new Request('https://private.example' + path, options);
const authenticated = (path, options = {}) => request(path, { ...options, headers: { ...options.headers, Authorization: auth } });

test('private Worker rejects anonymous and invalid credentials before resolving any route', async () => {
  for (const path of ['/', '/calculator', '/calculator.html', '/data/products.json', '/js/planner.mjs', '/_worker.js', '/missing', '/api/log-search']) {
    for (const method of ['GET', 'HEAD', 'POST', 'OPTIONS']) {
      const response = await worker.fetch(request(path, { method }), {});
      assert.equal(response.status, 401, path + ' ' + method);
      assert.match(response.headers.get('WWW-Authenticate'), /^Basic /);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
      assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, noarchive');
      assert.doesNotMatch(await response.text(), /Private planner|products/);
    }
  }
  for (const Authorization of ['Bearer test', 'Basic invalid??', 'Basic ' + btoa('nocolon'), 'Basic ' + btoa('wrong:' + password), 'Basic ' + btoa('roofwiki:wrong'), 'Basic ' + btoa('roofwiki:'), 'Basic ' + 'A'.repeat(513)]) {
    assert.equal((await worker.fetch(request('/calculator', { headers: { Authorization } }), {})).status, 401);
  }
  assert.equal((await worker.fetch(new Request('http://private.example/calculator', { headers: { Authorization: auth } }), {})).status, 401);
});

test('authorized clean URLs, assets, binary data, errors and HEAD retain privacy headers', async () => {
  for (const path of ['/calculator', '/calculator/', '/calculator.html', '/calculator?mode=plan']) {
    const response = await worker.fetch(authenticated(path), {});
    assert.equal(response.status, 200);
    assert.equal(await response.text(), assets['/calculator.html'].body);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  }
  const binary = await worker.fetch(authenticated('/example.png'), {});
  assert.deepEqual(new Uint8Array(await binary.arrayBuffer()), new Uint8Array([0, 255, 128, 10]));
  const head = await worker.fetch(authenticated('/calculator', { method: 'HEAD' }), {});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  for (const path of ['/_worker.js', '/_routes.json', '/missing', '/data/../private-password']) {
    assert.equal((await worker.fetch(authenticated(path), {})).status, 404);
  }
  assert.equal((await worker.fetch(authenticated('/calculator', { method: 'POST' }), {})).status, 405);
  assert.throws(() => createPrivateWorker(assets, ''), /digest/);
});

test('D1 logging remains authenticated and preserves existing query normalization', async () => {
  let prepared, bound, runs = 0;
  const env = { DB: { prepare(sql) { prepared = sql; return { bind(...values) { bound = values; return { async run() { runs++; } }; } }; } } };
  const body = JSON.stringify({ query: 'Ridge VENT!', resultCount: 2, clickedComponentSlug: 'ridge-vent' });
  assert.equal((await worker.fetch(request('/api/log-search', { method: 'POST', body }), env)).status, 401);
  assert.equal(runs, 0);
  const response = await worker.fetch(authenticated('/api/log-search', { method: 'POST', body }), env);
  assert.equal(response.status, 204);
  assert.match(prepared, /insert into search_miss/);
  assert.deepEqual(bound, ['Ridge VENT!', 'ridge vent', 2, 'ridge-vent']);
  assert.equal(runs, 1);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await worker.fetch(authenticated('/api/log-search'), env)).status, 405);
  assert.equal((await worker.fetch(authenticated('/api/log-search', { method: 'POST', body: '{' }), env)).status, 400);
  const failure = await worker.fetch(authenticated('/api/log-search', { method: 'POST', body: 'null' }), env);
  assert.equal(failure.status, 502);
  assert.equal(failure.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await worker.fetch(authenticated('/api/log-search', { method: 'POST', body }), {})).status, 502);
});

test('private build removes all public app assets and generates a working advanced Worker', async () => {
  const output = mkdtempSync(join(tmpdir(), 'roof-wiki-private-'));
  try {
    mkdirSync(join(output, 'data'));
    writeFileSync(join(output, 'index.html'), '<h1>SECRET APP HOME</h1>');
    writeFileSync(join(output, 'calculator.html'), '<h1>SECRET PLANNER</h1>');
    writeFileSync(join(output, 'data', 'products.json'), '{"fixture":"SECRET CATALOG"}');
    writeFileSync(join(output, 'test.pdf'), Buffer.from([0, 255, 128, 10]));
    protectSite(output);
    assert.deepEqual(readdirSync(output).sort(), ['_routes.json', '_worker.js', 'index.html']);
    assert.deepEqual(JSON.parse(readFileSync(join(output, '_routes.json'), 'utf8')), { version: 1, include: ['/*'], exclude: [] });
    const fallback = readFileSync(join(output, 'index.html'), 'utf8');
    assert.doesNotMatch(fallback, /SECRET|<script|<link|password|[a-f0-9]{64}/);
    const generated = readFileSync(join(output, '_worker.js'), 'utf8');
    assert.doesNotMatch(generated, /private-worker-unit-test-password/);
    // Replace only the configured digest in memory to exercise the generated
    // bundle with a test credential. The actual access password is never read.
    const testBundle = generated.replace(/(createPrivateWorker\(assets, ')[a-f0-9]{64}(',)/, '$1' + hash + '$2');
    const bundled = (await import('data:text/javascript;base64,' + Buffer.from(testBundle).toString('base64'))).default;
    assert.equal((await bundled.fetch(request('/calculator'), {})).status, 401);
    const planner = await bundled.fetch(authenticated('/calculator'), {});
    assert.equal(await planner.text(), '<h1>SECRET PLANNER</h1>');
    const products = await bundled.fetch(authenticated('/data/products.json'), {});
    assert.deepEqual(await products.json(), { fixture: 'SECRET CATALOG' });
    const pdf = await bundled.fetch(authenticated('/test.pdf'), {});
    assert.equal(pdf.headers.get('Content-Type'), 'application/pdf');
    assert.deepEqual(new Uint8Array(await pdf.arrayBuffer()), new Uint8Array([0, 255, 128, 10]));
    assert.equal((await bundled.fetch(authenticated('/api/log-search'), {})).status, 405);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
