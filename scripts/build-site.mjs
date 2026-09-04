#!/usr/bin/env node
// Assembles _site/ (Cloudflare Pages' pages_build_output_dir, see
// wrangler.toml) from three sources: the hand-authored static UI in
// site/, the content data build.mjs already produces in dist/data/,
// and the two isomorphic lib modules (query.mjs, ventilation-
// calculator.mjs) that run unmodified in the browser once vendored
// alongside a plain ESM build of their one dependency (minisearch).
//
// No SSG is involved — site/ is already plain HTML/CSS/JS, this just
// copies it next to the data and libs it fetches at runtime.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const siteOut = join(root, '_site');

function main() {
  execFileSync(process.execPath, [join(__dirname, 'build.mjs')], { cwd: root, stdio: 'inherit' });

  rmSync(siteOut, { recursive: true, force: true });
  mkdirSync(siteOut, { recursive: true });

  cpSync(join(root, 'site'), siteOut, { recursive: true });

  mkdirSync(join(siteOut, 'data'), { recursive: true });
  cpSync(join(root, 'dist', 'data'), join(siteOut, 'data'), { recursive: true });

  mkdirSync(join(siteOut, 'lib'), { recursive: true });
  cpSync(join(root, 'scripts', 'lib', 'query.mjs'), join(siteOut, 'lib', 'query.mjs'));
  cpSync(join(root, 'scripts', 'lib', 'ventilation-calculator.mjs'), join(siteOut, 'lib', 'ventilation-calculator.mjs'));

  mkdirSync(join(siteOut, 'lib', 'vendor'), { recursive: true });
  cpSync(
    join(root, 'node_modules', 'minisearch', 'dist', 'es', 'index.js'),
    join(siteOut, 'lib', 'vendor', 'minisearch.js')
  );

  console.log(`Assembled static site -> ${siteOut}`);
}

main();
