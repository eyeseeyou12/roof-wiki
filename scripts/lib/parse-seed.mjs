import { load as loadYaml } from 'js-yaml';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const SECTION_HEADINGS = {
  'summary': 'summary',
  'description': 'description',
  'function': 'function',
  'replacement notes': 'replacement_notes',
  'measurement notes': 'measurement_notes',
  'failure modes': 'failure_modes',
  'disambiguation': 'disambiguation',
};

export const DIALECTS = ['field', 'manufacturer', 'code', 'adjuster', 'brand', 'descriptive'];
export const LINK_TYPES = ['governed_by', 'see_also', 'part_of', 'confused_with'];
export const SYMMETRIC_LINK_TYPES = ['see_also', 'confused_with'];
export const ENTRY_TYPES = ['component', 'rule'];
export const STATUSES = ['draft', 'reviewed'];
export const CONFIDENCES = ['high', 'medium', 'thin'];

// "name (dialect)" or "name (dialect — note)". Only an em/en dash splits
// off the note — slugs and notes routinely contain plain hyphens
// ("lead-flashing"), so a plain "-" can't be the delimiter.
const ALIAS_INLINE_RE = /^(.+?)\s*\(\s*([a-zA-Z]+)\s*(?:[—–]\s*(.+))?\)\s*$/;

class SeedError extends Error {}

export function slugFromFilename(fileName) {
  return fileName.replace(/\.md$/, '');
}

export function normalizeAliasName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function parseSeedFile(fileName, text) {
  const errors = [];
  const warnings = [];
  const slug = slugFromFilename(fileName);

  const match = FRONTMATTER_RE.exec(text);
  if (!match) {
    errors.push('missing --- frontmatter block');
    return { slug, errors, warnings, record: null };
  }
  const [, fmText, bodyText] = match;

  let fm;
  try {
    fm = loadYaml(fmText) || {};
  } catch (e) {
    errors.push(`invalid YAML frontmatter: ${e.message}`);
    return { slug, errors, warnings, record: null };
  }

  if (!fm.name || !String(fm.name).trim()) {
    errors.push('missing required field: name');
  }

  const entryType = fm.type ? String(fm.type).trim().toLowerCase() : 'component';
  if (!ENTRY_TYPES.includes(entryType)) {
    errors.push(`invalid type "${fm.type}" — expected one of ${ENTRY_TYPES.join(', ')}`);
  }

  const status = fm.status ? String(fm.status).trim().toLowerCase() : 'draft';
  if (!STATUSES.includes(status)) {
    errors.push(`invalid status "${fm.status}" — expected one of ${STATUSES.join(', ')}`);
  }

  let confidence = null;
  if (fm.confidence != null && String(fm.confidence).trim() !== '') {
    confidence = String(fm.confidence).trim().toLowerCase();
    if (!CONFIDENCES.includes(confidence)) {
      errors.push(`invalid confidence "${fm.confidence}" — expected one of ${CONFIDENCES.join(', ')}`);
      confidence = null;
    }
  }

  const categories = Array.isArray(fm.categories) ? fm.categories.map((c) => String(c).trim()) : [];

  const aliases = [];
  if (fm.aliases) {
    if (!Array.isArray(fm.aliases)) {
      errors.push('aliases must be a list');
    } else {
      for (const raw of fm.aliases) {
        try {
          aliases.push(parseAliasEntry(raw));
        } catch (e) {
          errors.push(e.message);
        }
      }
    }
  }

  const links = [];
  if (fm.links) {
    if (!Array.isArray(fm.links)) {
      errors.push('links must be a list');
    } else {
      for (const raw of fm.links) {
        try {
          links.push(parseLinkEntry(raw));
        } catch (e) {
          errors.push(e.message);
        }
      }
    }
  }

  const sources = fm.sources ? String(fm.sources).trim() : null;

  const sections = {};
  const lines = bodyText.split(/\r?\n/);
  let currentKey = null;
  let buffer = [];
  const flush = () => {
    if (currentKey) {
      sections[currentKey] = buffer.join('\n').trim();
    }
    buffer = [];
  };
  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flush();
      const label = headingMatch[1].trim().toLowerCase();
      const key = SECTION_HEADINGS[label];
      if (!key) {
        warnings.push(`unknown section heading "${headingMatch[1]}" — ignored`);
        currentKey = null;
      } else {
        currentKey = key;
      }
    } else if (currentKey) {
      buffer.push(line);
    }
  }
  flush();

  const record = {
    slug,
    display_name: fm.name ? String(fm.name).trim() : null,
    entry_type: entryType,
    status,
    confidence,
    categories,
    aliases,
    links,
    sources,
    summary: sections.summary || '',
    description: sections.description || '',
    function: sections.function || '',
    replacement_notes: sections.replacement_notes || '',
    measurement_notes: sections.measurement_notes || '',
    failure_modes: sections.failure_modes || '',
    disambiguation: sections.disambiguation || '',
  };

  return { slug, errors, warnings, record };
}

function parseAliasEntry(raw) {
  if (raw && typeof raw === 'object') {
    if (!raw.name || !raw.dialect) {
      throw new SeedError(`alias object missing name/dialect: ${JSON.stringify(raw)}`);
    }
    const dialect = String(raw.dialect).trim().toLowerCase();
    if (!DIALECTS.includes(dialect)) {
      throw new SeedError(`alias "${raw.name}" has unknown dialect "${raw.dialect}"`);
    }
    return {
      name: String(raw.name).trim(),
      dialect,
      region: raw.region ? String(raw.region).trim() : null,
      notes: raw.notes ? String(raw.notes).trim() : null,
    };
  }
  const str = String(raw).trim();
  const m = ALIAS_INLINE_RE.exec(str);
  if (!m) {
    throw new SeedError(`could not parse alias "${str}" — expected "name (dialect)" or "name (dialect — note)"`);
  }
  const [, name, dialectRaw, note] = m;
  const dialect = dialectRaw.trim().toLowerCase();
  if (!DIALECTS.includes(dialect)) {
    throw new SeedError(`alias "${str}" has unknown dialect "${dialectRaw}" — expected one of ${DIALECTS.join(', ')}`);
  }
  return {
    name: name.trim(),
    dialect,
    region: null,
    notes: note ? note.trim() : null,
  };
}

function parseLinkEntry(raw) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SeedError(`link entry must be a mapping like "confused_with: some-slug", got ${JSON.stringify(raw)}`);
  }
  const keys = Object.keys(raw);
  if (keys.length !== 1) {
    throw new SeedError(`link entry must have exactly one link_type key, got ${JSON.stringify(raw)}`);
  }
  const linkType = keys[0];
  if (!LINK_TYPES.includes(linkType)) {
    throw new SeedError(`unknown link_type "${linkType}" — expected one of ${LINK_TYPES.join(', ')}`);
  }
  const rawValue = String(raw[linkType]).trim();
  const parts = rawValue.split(/\s*[—–]\s*/);
  const target = parts[0].trim();
  const note = parts.length > 1 ? parts.slice(1).join(' — ').trim() : null;
  return { linkType, target, note };
}
