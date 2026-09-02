import { createSearchIndex, search, logSearchMiss } from '/lib/query.mjs';
import { loadComponents, loadSearchIndex } from './data.mjs';
import { escapeHtml, shortLine, componentHref, el } from './render.mjs';

const LOG_SEARCH_ENDPOINT = '/api/log-search';
const DEBOUNCE_MS = 200;

const form = document.getElementById('search-form');
const input = document.getElementById('q');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('search-status');

let miniIndex = null;
let componentsBySlug = null;
let debounceTimer = null;

async function init() {
  const [searchIndexRows, components] = await Promise.all([loadSearchIndex(), loadComponents()]);
  miniIndex = createSearchIndex(searchIndexRows);
  componentsBySlug = components;

  const initialQuery = new URLSearchParams(location.search).get('q') || '';
  input.value = initialQuery;
  if (initialQuery) runSearch(initialQuery);
  else renderEmptyPrompt();
}

function renderEmptyPrompt() {
  resultsEl.innerHTML = '';
  statusEl.textContent = '';
}

function runSearch(queryText) {
  const trimmed = queryText.trim();
  const url = new URL(location.href);
  if (trimmed) url.searchParams.set('q', trimmed);
  else url.searchParams.delete('q');
  history.replaceState(null, '', url);

  if (!trimmed) {
    renderEmptyPrompt();
    return;
  }
  if (!miniIndex) return;

  const results = search(miniIndex, componentsBySlug, trimmed, { limit: 10 });
  renderResults(results, trimmed);

  clearTimeout(debounceTimer);
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
          'Nothing matched that name. Try a shorter or more general word — search matches full aliases, not partial ones split across multiple words.',
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

init();
