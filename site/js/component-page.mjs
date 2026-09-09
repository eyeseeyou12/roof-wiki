import { getComponent } from '/lib/query.mjs';
import { loadComponents } from './data.mjs';
import { el, escapeHtml, componentHref, categoryHref, loadError } from './render.mjs';

const DIALECT_LABELS = {
  field: 'Field',
  manufacturer: 'Manufacturer',
  code: 'Code',
  adjuster: 'Adjuster',
  brand: 'Brand',
  descriptive: 'Descriptive',
};

const LINK_TYPE_LABELS = {
  see_also: 'See also',
  confused_with: 'Often confused with',
  governed_by: 'Governed by',
  part_of: 'Part of',
};

const FIELD_SECTIONS = [
  ['description', 'What it is'],
  ['function', 'What it does'],
  ['replacementNotes', 'Replacement notes'],
  ['measurementNotes', 'What to measure'],
  ['failureModes', 'Failure modes'],
  ['disambiguation', 'Disambiguation'],
];

const CONFIDENCE_NOTE = {
  thin: 'thin — treat as unverified until reviewed.',
  medium: 'medium.',
  high: 'high.',
};

const titleEl = document.getElementById('component-title');
const bodyEl = document.getElementById('component-body');

async function init() {
  const slug = new URLSearchParams(location.search).get('slug');
  const components = await loadComponents();
  const component = slug ? getComponent(components, slug) : null;

  if (!component) {
    titleEl.textContent = 'Not found';
    bodyEl.appendChild(
      el('p', { class: 'empty-state', text: 'No component with that slug. Try Search or Browse from the header.' })
    );
    return;
  }

  document.title = `${component.displayName} — roof-wiki`;

  const headerBadges = [];
  if (component.entryType === 'rule') headerBadges.push(el('span', { class: 'badge rule', text: 'Rule' }));
  titleEl.innerHTML = '';
  titleEl.appendChild(el('span', { text: component.displayName }));
  for (const b of headerBadges) {
    titleEl.appendChild(document.createTextNode(' '));
    titleEl.appendChild(b);
  }

  if (component.status === 'draft' || component.confidence === 'thin') {
    const bits = [];
    if (component.status === 'draft') bits.push('this entry is in draft and hasn’t been reviewed yet');
    if (component.confidence === 'thin') bits.push(`confidence is ${CONFIDENCE_NOTE.thin}`);
    bodyEl.appendChild(
      el('div', { class: 'notice', text: `Note: ${bits.join('; ')}` })
    );
  }

  if (component.summary) {
    bodyEl.appendChild(el('p', { class: 'summary-lead', text: component.summary }));
  }

  for (const [field, label] of FIELD_SECTIONS) {
    const value = component[field];
    if (!value) continue;
    bodyEl.appendChild(
      el('div', { class: 'field-block' }, [el('h2', { text: label }), el('p', { text: value })])
    );
  }

  renderReferences(component);
  renderAliases(component);
  renderLinks(component);
  renderCategories(component);

  if (component.sources) {
    bodyEl.appendChild(
      el('div', { class: 'field-block' }, [
        el('h2', { text: 'Sources' }),
        el('p', { text: component.sources }),
      ])
    );
  }
}

function renderReferences(component) {
  if (component.entryType === 'rule') return;
  const block = el('section', { class: 'field-block', id: 'products' }, [el('h2', { text: 'Products & specifications' })]);
  const products = component.products || [];
  if (!products.length) block.appendChild(el('p', { class: 'helper-text', text: 'No manufacturer-sourced products added for this component yet.' }));
  else {
    block.appendChild(el('p', { class: 'helper-text', text: 'Product examples. Check the manufacturer’s installation instructions and your measurements before selecting a replacement.' }));
    const grid = el('div', { class: 'product-grid' });
    for (const p of products) {
      const card = el('article', { class: 'product-card' }, [el('p', { class: 'helper-text', text: p.brand }), el('h3', { text: p.model }), el('p', { text: p.description })]);
      const dl = el('dl', { class: 'spec-list' });
      for (const [label, value] of Object.entries(p.specs)) {
        dl.appendChild(el('dt', { text: label })); dl.appendChild(el('dd', { text: value }));
      }
      card.appendChild(dl);
      card.appendChild(el('a', { href: p.sourceUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Manufacturer source ↗' }));
      card.appendChild(el('p', { class: 'helper-text', text: `Specifications checked ${p.verifiedOn}` }));
      grid.appendChild(card);
    }
    block.appendChild(grid);
  }
  bodyEl.appendChild(block);
  const xblock = el('section', { class: 'field-block', id: 'xactimate' }, [el('h2', { text: 'Xactimate references' })]);
  const refs = component.xactimate || [];
  if (!refs.length) xblock.appendChild(el('p', { class: 'helper-text', text: 'No verified line item available yet. Confirm the category, selector, description, and unit in your current Xactimate price list.' }));
  for (const x of refs) {
    xblock.appendChild(el('article', { class: 'product-card' }, [
      el('h3', { text: `${x.category} ${x.selector}` }), el('p', { text: x.description }),
      el('p', { text: `Unit: ${x.unit} · Price list: ${x.priceList}` }),
      x.notes ? el('p', { text: x.notes }) : null,
      el('p', { class: 'helper-text', text: `Source: ${x.source} · Checked ${x.verifiedOn}` }),
    ]));
  }
  bodyEl.appendChild(xblock);
}

function renderAliases(component) {
  if (!component.aliases.length) return;
  const byDialect = new Map();
  for (const a of component.aliases) {
    if (!byDialect.has(a.dialect)) byDialect.set(a.dialect, []);
    byDialect.get(a.dialect).push(a);
  }

  const block = el('div', { class: 'field-block' }, [el('h2', { text: 'Also known as' })]);
  for (const [dialect, aliases] of byDialect) {
    const group = el('div', { class: 'alias-group' }, [
      el('div', { class: 'dialect-label', text: DIALECT_LABELS[dialect] || dialect }),
    ]);
    for (const a of aliases) {
      const title = [a.region, a.notes].filter(Boolean).join(' — ');
      group.appendChild(el('span', { class: 'alias-chip', title: title || null, text: a.name }));
    }
    block.appendChild(group);
  }
  bodyEl.appendChild(block);
}

function renderLinks(component) {
  if (!component.links.length) return;
  const byType = new Map();
  for (const l of component.links) {
    if (!byType.has(l.linkType)) byType.set(l.linkType, []);
    byType.get(l.linkType).push(l);
  }

  const block = el('div', { class: 'field-block' }, [el('h2', { text: 'Related' })]);
  for (const [linkType, links] of byType) {
    block.appendChild(el('div', { class: 'link-type-label', text: LINK_TYPE_LABELS[linkType] || linkType }));
    const ul = el('ul', { class: 'link-list' });
    for (const l of links) {
      const li = el('li');
      li.appendChild(el('a', { href: componentHref(l.target), text: l.targetName }));
      if (l.note) li.appendChild(el('span', { class: 'helper-text', text: ` — ${l.note}` }));
      ul.appendChild(li);
    }
    block.appendChild(ul);
  }
  bodyEl.appendChild(block);
}

function renderCategories(component) {
  if (!component.categories.length) return;
  const block = el('div', { class: 'field-block' }, [el('h2', { text: 'Categories' })]);
  for (const slug of component.categories) {
    block.appendChild(
      el('a', {
        class: 'badge',
        href: categoryHref(slug),
        text: slug.replace(/-/g, ' '),
      })
    );
  }
  bodyEl.appendChild(block);
}

init().catch(() => {
  titleEl.textContent = 'Component unavailable';
  bodyEl.replaceChildren(loadError('This component could not load. Check your connection and try again.'));
});
