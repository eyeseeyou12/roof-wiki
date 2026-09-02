// Small DOM/formatting helpers shared across pages. No framework —
// the site is plain HTML/CSS/JS, so this just keeps the string-building
// in one place instead of repeating escape logic on every page.

export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

// Given a component record, the best short line to show in a list:
// summary if the seed file has one (currently none do, per CLAUDE.md),
// otherwise the first sentence-ish chunk of description so lists never
// show a blank line.
export function shortLine(component, maxLen = 160) {
  const source = component.summary || component.description || '';
  if (!source) return '';
  if (source.length <= maxLen) return source;
  return source.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

export function componentHref(slug) {
  return `/component.html?slug=${encodeURIComponent(slug)}`;
}

export function categoryHref(slug) {
  return `/category.html?slug=${encodeURIComponent(slug)}`;
}
