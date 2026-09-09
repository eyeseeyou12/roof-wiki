import { createSearchIndex, search, logSearchMiss } from '/lib/query.mjs';
import { loadComponents, loadSearchIndex } from './data.mjs';
import { escapeHtml, shortLine, componentHref, el, loadError } from './render.mjs';

const LOG_SEARCH_ENDPOINT = '/api/log-search';
const DEBOUNCE_MS = 200;

const form = document.getElementById('search-form');
const input = document.getElementById('q');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('search-status');

let miniIndex = null;
let componentsBySlug = null;
let debounceTimer = null;
let loadFailed = false;

async function init() {
  input.value = new URLSearchParams(location.search).get('q') || '';
  statusEl.textContent = 'Loading search…';
  const [searchIndexRows, components] = await Promise.all([loadSearchIndex(), loadComponents()]);
  miniIndex = createSearchIndex(searchIndexRows);
  componentsBySlug = components;

  if (input.value) runSearch(input.value);
  else renderEmptyPrompt();
}

function renderEmptyPrompt() {
  resultsEl.innerHTML = '';
  statusEl.textContent = '';
}

function runSearch(queryText) {
  clearTimeout(debounceTimer);
  if (loadFailed) return;
  const trimmed = queryText.trim();
  const url = new URL(location.href);
  if (trimmed) url.searchParams.set('q', trimmed);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);

  if (!trimmed) {
    renderEmptyPrompt();
    return;
  }
  if (!miniIndex) {
    statusEl.textContent = 'Loading search…';
    return;
  }

  const results = search(miniIndex, componentsBySlug, trimmed, { limit: 10 });
  renderResults(results, trimmed);

  debounceTimer = setTimeout(() => {
    logSearchMiss(LOG_SEARCH_ENDPOINT, { query: trimmed, resultCount: results.length });
  }, DEBOUNCE_MS);
}

function renderResults(results, queryText) {
  resultsEl.innerHTML = '';

  if (results.length === 0) {
    statusEl.textContent = `No matches for "${queryText}".`;
    resultsEl.appendChild(
      el('li', {
        class: 'empty-state',
        html:
          'Try fewer details, a nickname, the component’s purpose, or a brand and model. Descriptions are still being expanded.',
      })
    );
    return;
  }

  statusEl.textContent = `${results.length} match${results.length === 1 ? '' : 'es'} for "${queryText}"`;

  for (const r of results) {
    const matchedTerms = [...new Set(r.matches.map((m) => m.text))].filter(
      (t) => t.toLowerCase() !== r.displayName.toLowerCase()
    );
    const li = el('li');
    const card = el('a', { class: 'result-card', href: componentHref(r.slug) }, [
      el('span', {
        html: `${r.entryType === 'rule' ? '<span class="badge rule">Rule</span> ' : ''}<span class="name">${escapeHtml(r.displayName)}</span>`,
      }),
      el('div', { class: 'snippet', text: shortLine(componentsBySlug[r.slug] || r) }),
      matchedTerms.length
        ? el('div', {
            class: 'match-note',
            text: `Matched: ${matchedTerms.slice(0, 3).join(', ')}`,
          })
        : null,
    ]);
    li.appendChild(card);
    resultsEl.appendChild(li);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch(input.value);
});

input.addEventListener('input', () => {
  runSearch(input.value);
});

init().catch(() => {
  loadFailed = true;
  statusEl.textContent = '';
  resultsEl.replaceChildren(el('li', {}, [loadError('Search could not load. Check your connection and try again.')]));
});
