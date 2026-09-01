#!/usr/bin/env node
// Reads content/categories.yml and content/components/*.md, loads them
// against db/schema.sql in an in-memory SQLite database (the same
// schema the validator's rules are written against), then exports the
// static JSON the client and the site generator both read. The content
// database itself is never shipped or persisted between builds — it
// exists only to get from seed files to correct, constraint-checked
// JSON in one pass.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';
import { parseSeedFile, SYMMETRIC_LINK_TYPES } from './lib/parse-seed.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contentDir = join(root, 'content', 'components');
const outDir = join(root, 'dist', 'data');

function loadSeeds() {
  const files = readdirSync(contentDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const records = [];
  for (const file of files) {
    const text = readFileSync(join(contentDir, file), 'utf8');
    const { errors, record } = parseSeedFile(file, text);
    if (errors.length) {
      for (const e of errors) console.error(`ERROR ${file}: ${e}`);
      throw new Error(`build aborted: ${file} failed to parse — run "npm run validate" for details`);
    }
    records.push(record);
  }
  return records;
}

function loadCategories() {
  const text = readFileSync(join(root, 'content', 'categories.yml'), 'utf8');
  const parsed = loadYaml(text);
  return parsed.categories || [];
}

function buildDatabase(records, categories) {
  const schema = readFileSync(join(root, 'db', 'schema.sql'), 'utf8');
  const db = new DatabaseSync(':memory:');
  db.exec(schema);

  const insertCategory = db.prepare(
    'insert into category (slug, name, parent_id, sort_order) values (?, ?, ?, ?)'
  );
  const categoryIdBySlug = new Map();
  for (const c of categories) {
    const parentId = c.parent ? categoryIdBySlug.get(c.parent) : null;
    const info = insertCategory.run(c.slug, c.name, parentId ?? null, c.sort_order ?? 0);
    categoryIdBySlug.set(c.slug, Number(info.lastInsertRowid));
  }

  const insertComponent = db.prepare(`
    insert into component (slug, display_name, entry_type, summary, description, function,
      replacement_notes, measurement_notes, failure_modes, disambiguation, status, confidence, sources)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const componentIdBySlug = new Map();
  for (const r of records) {
    const info = insertComponent.run(
      r.slug, r.display_name, r.entry_type, r.summary, r.description, r.function,
      r.replacement_notes || null, r.measurement_notes || null,
      r.failure_modes || null, r.disambiguation || null,
      r.status, r.confidence, r.sources
    );
    componentIdBySlug.set(r.slug, Number(info.lastInsertRowid));
  }

  const insertAlias = db.prepare(`
    insert into alias (component_id, name, normalized_name, dialect, region, notes)
    values (?, ?, ?, ?, ?, ?)
  `);
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const r of records) {
    for (const a of r.aliases) {
      insertAlias.run(componentIdBySlug.get(r.slug), a.name, normalize(a.name), a.dialect, a.region, a.notes);
    }
  }

  const insertComponentCategory = db.prepare(
    'insert or ignore into component_category (component_id, category_id) values (?, ?)'
  );
  for (const r of records) {
    for (const catSlug of r.categories) {
      const catId = categoryIdBySlug.get(catSlug);
      if (!catId) throw new Error(`build aborted: ${r.slug} references unknown category "${catSlug}"`);
      insertComponentCategory.run(componentIdBySlug.get(r.slug), catId);
    }
  }

  const insertLink = db.prepare(`
    insert or ignore into component_link (from_component_id, to_component_id, link_type, note)
    values (?, ?, ?, ?)
  `);
  for (const r of records) {
    for (const l of r.links) {
      const fromId = componentIdBySlug.get(r.slug);
      const toId = componentIdBySlug.get(l.target);
      if (!toId) throw new Error(`build aborted: ${r.slug} links to unknown component "${l.target}"`);
      insertLink.run(fromId, toId, l.linkType, l.note);
      if (SYMMETRIC_LINK_TYPES.includes(l.linkType)) {
        insertLink.run(toId, fromId, l.linkType, l.note);
      }
    }
  }

  return { db, categoryIdBySlug, componentIdBySlug };
}

function exportJson(db) {
  const components = db.prepare('select * from component').all();
  const aliases = db.prepare('select * from alias').all();
  const categories = db.prepare('select * from category order by sort_order').all();
  const componentCategory = db.prepare('select * from component_category').all();
  const links = db.prepare('select * from component_link').all();

  const idToSlug = new Map(components.map((c) => [c.id, c.slug]));

  const aliasesByComponent = new Map();
  for (const a of aliases) {
    if (!aliasesByComponent.has(a.component_id)) aliasesByComponent.set(a.component_id, []);
    aliasesByComponent.get(a.component_id).push({
      name: a.name,
      normalizedName: a.normalized_name,
      dialect: a.dialect,
      region: a.region,
      notes: a.notes,
    });
  }

  const categoriesByComponent = new Map();
  for (const cc of componentCategory) {
    if (!categoriesByComponent.has(cc.component_id)) categoriesByComponent.set(cc.component_id, []);
    categoriesByComponent.get(cc.component_id).push(cc.category_id);
  }
  const categoryIdToSlug = new Map(categories.map((c) => [c.id, c.slug]));

  const linksByComponent = new Map();
  for (const l of links) {
    if (!linksByComponent.has(l.from_component_id)) linksByComponent.set(l.from_component_id, []);
    linksByComponent.get(l.from_component_id).push({
      linkType: l.link_type,
      target: idToSlug.get(l.to_component_id),
      targetName: components.find((c) => c.id === l.to_component_id)?.display_name,
      note: l.note,
    });
  }

  const componentsOut = {};
  for (const c of components) {
    componentsOut[c.slug] = {
      slug: c.slug,
      displayName: c.display_name,
      entryType: c.entry_type,
      summary: c.summary,
      description: c.description,
      function: c.function,
      replacementNotes: c.replacement_notes,
      measurementNotes: c.measurement_notes,
      failureModes: c.failure_modes,
      disambiguation: c.disambiguation,
      status: c.status,
      confidence: c.confidence,
      sources: c.sources,
      categories: (categoriesByComponent.get(c.id) || []).map((catId) => categoryIdToSlug.get(catId)),
      aliases: aliasesByComponent.get(c.id) || [],
      links: linksByComponent.get(c.id) || [],
    };
  }

  const categoriesOut = categories.map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    parentSlug: cat.parent_id ? categoryIdToSlug.get(cat.parent_id) : null,
    sortOrder: cat.sort_order,
    componentSlugs: components
      .filter((c) => (categoriesByComponent.get(c.id) || []).includes(cat.id))
      .map((c) => c.slug),
  }));

  const searchIndex = [];
  let docId = 0;
  for (const c of components) {
    searchIndex.push({
      id: docId++,
      componentSlug: c.slug,
      componentName: c.display_name,
      text: c.display_name,
      dialect: null,
      kind: 'name',
      notes: null,
    });
    for (const a of aliasesByComponent.get(c.id) || []) {
      searchIndex.push({
        id: docId++,
        componentSlug: c.slug,
        componentName: c.display_name,
        text: a.name,
        dialect: a.dialect,
        kind: 'alias',
        notes: a.notes,
      });
    }
  }

  return { components: componentsOut, categories: categoriesOut, searchIndex };
}

function main() {
  const records = loadSeeds();
  const categories = loadCategories();
  const { db } = buildDatabase(records, categories);
  const { components, categories: categoriesOut, searchIndex } = exportJson(db);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'components.json'), JSON.stringify(components, null, 2));
  writeFileSync(join(outDir, 'categories.json'), JSON.stringify(categoriesOut, null, 2));
  writeFileSync(join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2));

  console.log(`Built ${Object.keys(components).length} components, ${categoriesOut.length} categories, ${searchIndex.length} search index entries.`);
  console.log(`-> ${outDir}`);
}

main();
