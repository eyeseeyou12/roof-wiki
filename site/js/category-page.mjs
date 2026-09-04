import { browseCategory } from '/lib/query.mjs';
import { loadCategories, loadComponents } from './data.mjs';
import { el, escapeHtml, shortLine, componentHref } from './render.mjs';

const titleEl = document.getElementById('category-title');
const listEl = document.getElementById('component-list');

async function init() {
  const slug = new URLSearchParams(location.search).get('slug');
  const [categories, components] = await Promise.all([loadCategories(), loadComponents()]);
  const category = slug ? browseCategory(categories, components, slug) : null;

  if (!category) {
    titleEl.textContent = 'Category not found';
    listEl.innerHTML = '';
    listEl.appendChild(el('li', { class: 'empty-state', text: 'That category slug doesn’t exist. Go back to Browse.' }));
    return;
  }

  document.title = `${category.name} — roof-wiki`;
  titleEl.textContent = category.name;

  listEl.innerHTML = '';
  for (const c of category.components) {
    const li = el('li');
    li.appendChild(
      el('a', { class: 'card', href: componentHref(c.slug) }, [
        el('span', {
          html: `${c.entryType === 'rule' ? '<span class="badge rule">Rule</span> ' : ''}<span class="name">${escapeHtml(c.displayName)}</span>`,
        }),
        el('div', { class: 'snippet', text: shortLine(components[c.slug] || c) }),
      ])
    );
    listEl.appendChild(li);
  }

  if (category.components.length === 0) {
    listEl.appendChild(el('li', { class: 'empty-state', text: 'No components in this category yet.' }));
  }
}

init();
