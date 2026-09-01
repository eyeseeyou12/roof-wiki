#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSeedFile, normalizeAliasName, SYMMETRIC_LINK_TYPES } from './lib/parse-seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(__dirname, '..', process.argv[2] || 'content/components');

function loadAll(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const entries = [];
  let hardErrors = 0;
  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    const { slug, errors, warnings, record } = parseSeedFile(file, text);
    for (const e of errors) {
      console.error(`ERROR  ${file}: ${e}`);
      hardErrors++;
    }
    for (const w of warnings) {
      console.warn(`WARN   ${file}: ${w}`);
    }
    if (record) entries.push(record);
  }
  return { entries, hardErrors };
}

function hasLinkBetween(bySlug, a, b) {
  const ea = bySlug.get(a);
  const eb = bySlug.get(b);
  if (ea && ea.links.some((l) => l.target === b)) return true;
  if (eb && eb.links.some((l) => l.target === a)) return true;
  return false;
}

function main() {
  const { entries, hardErrors } = loadAll(contentDir);
  const bySlug = new Map(entries.map((e) => [e.slug, e]));

  console.log(`\nLoaded ${entries.length} entries from ${contentDir}\n`);

  // Missing fields. Every entry needs the basics; replacement/measurement
  // notes are only required for actual components — a rule like "don't
  // mix exhaust types" has no replacement direction.
  const requiredAlways = ['summary', 'description', 'function', 'confidence'];
  const requiredForComponents = ['replacement_notes', 'measurement_notes'];
  let missingCount = 0;
  for (const e of entries) {
    const missing = [];
    for (const f of requiredAlways) if (!e[f]) missing.push(f);
    if (e.entry_type === 'component') {
      for (const f of requiredForComponents) if (!e[f]) missing.push(f);
    }
    if (missing.length) {
      missingCount++;
      console.log(`MISSING FIELDS   ${e.slug}: ${missing.join(', ')}`);
    }
  }
  if (!missingCount) console.log('No missing required fields.');

  // Orphaned links: a link pointing at a slug that doesn't exist.
  console.log('');
  let orphanCount = 0;
  for (const e of entries) {
    for (const link of e.links) {
      if (!bySlug.has(link.target)) {
        orphanCount++;
        console.log(`ORPHANED LINK    ${e.slug} --${link.linkType}--> ${link.target} (no such entry)`);
      }
    }
  }
  // Symmetric link types should appear on both sides — the build script
  // adds the reverse automatically, but a validate-only reader should
  // still be able to see it's expected.
  let asymmetricCount = 0;
  for (const e of entries) {
    for (const link of e.links) {
      if (SYMMETRIC_LINK_TYPES.includes(link.linkType) && bySlug.has(link.target)) {
        const reverseExists = bySlug.get(link.target).links.some(
          (l) => l.linkType === link.linkType && l.target === e.slug
        );
        if (!reverseExists) {
          asymmetricCount++;
          console.log(`ONE-WAY LINK     ${e.slug} --${link.linkType}--> ${link.target} (reverse will be added at build time)`);
        }
      }
    }
  }
  if (!orphanCount && !asymmetricCount) console.log('No orphaned or unexpectedly one-way links.');

  // Duplicate normalized aliases across components: not an error (this is
  // the intended mechanism for "louver vent" -> gable vent + box vent),
  // but flagged as UNDOCUMENTED when the components involved have no
  // link (typically confused_with) explaining the collision.
  console.log('');
  const aliasIndex = new Map();
  for (const e of entries) {
    for (const a of e.aliases) {
      const norm = normalizeAliasName(a.name);
      if (!aliasIndex.has(norm)) aliasIndex.set(norm, []);
      aliasIndex.get(norm).push({ slug: e.slug, name: a.name });
    }
  }
  let collisionCount = 0;
  let undocumentedCount = 0;
  for (const [, hits] of aliasIndex) {
    const distinctSlugs = [...new Set(hits.map((h) => h.slug))];
    if (distinctSlugs.length < 2) continue;
    collisionCount++;
    let allPairsLinked = true;
    for (let i = 0; i < distinctSlugs.length && allPairsLinked; i++) {
      for (let j = i + 1; j < distinctSlugs.length; j++) {
        if (!hasLinkBetween(bySlug, distinctSlugs[i], distinctSlugs[j])) {
          allPairsLinked = false;
          break;
        }
      }
    }
    const tag = allPairsLinked ? 'documented' : 'UNDOCUMENTED';
    if (!allPairsLinked) undocumentedCount++;
    console.log(`ALIAS COLLISION [${tag}]  "${hits[0].name}" -> ${distinctSlugs.join(', ')}`);
  }
  if (!collisionCount) console.log('No cross-component alias collisions.');

  // Entries still marked draft.
  console.log('');
  const drafts = entries.filter((e) => e.status === 'draft');
  const draftRules = drafts.filter((e) => e.entry_type === 'rule');
  const draftComponents = drafts.filter((e) => e.entry_type === 'component');
  if (draftRules.length) {
    console.log(`DRAFT RULES (review first — these govern many components):`);
    for (const e of draftRules) console.log(`  - ${e.slug}`);
  }
  if (draftComponents.length) {
    console.log(`DRAFT COMPONENTS (${draftComponents.length}):`);
    for (const e of draftComponents) console.log(`  - ${e.slug}`);
  }
  if (!drafts.length) console.log('No draft entries.');

  console.log(
    `\n${hardErrors} hard error(s), ${missingCount} entr${missingCount === 1 ? 'y' : 'ies'} with missing fields, ` +
    `${orphanCount} orphaned link(s), ${undocumentedCount} undocumented alias collision(s), ${drafts.length} draft entr${drafts.length === 1 ? 'y' : 'ies'}.\n`
  );

  if (hardErrors > 0) {
    process.exitCode = 1;
  }
}

main();
