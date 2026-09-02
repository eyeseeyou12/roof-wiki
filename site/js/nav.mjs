// Shared header, injected into <div id="site-header"></div> on every
// page. Not a templating system — just avoids hand-duplicating the same
// nav markup across six static HTML files (no SSG exists yet, see
// CLAUDE.md's "Not yet built" section).
import { escapeHtml } from './render.mjs';

const LINKS = [
  { key: 'home', href: '/index.html', label: 'roof-wiki' },
  { key: 'browse', href: '/browse.html', label: 'Browse' },
  { key: 'calculator', href: '/calculator.html', label: 'Calculator' },
];

export function renderNav(activeKey) {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  const params = new URLSearchParams(location.search);
  const currentQuery = activeKey === 'search' ? params.get('q') || '' : '';

  const navLinks = LINKS.filter((l) => l.key !== 'home')
    .map(
      (l) =>
        `<a href="${l.href}"${l.key === activeKey ? ' aria-current="page"' : ''}>${escapeHtml(l.label)}</a>`
    )
    .join('');

  mount.innerHTML = `
    <a class="brand" href="/index.html">roof-wiki</a>
    <nav>${navLinks}</nav>
    <form class="header-search" action="/search.html" method="get" role="search">
      <input type="search" name="q" placeholder="Search a name…" value="${escapeHtml(currentQuery)}" aria-label="Search components">
      <button type="submit">Search</button>
    </form>
  `;
}
