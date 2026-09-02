import { listCategories } from '/lib/query.mjs';
import { loadCategories } from './data.mjs';
import { el, categoryHref } from './render.mjs';

const listEl = document.getElementById('category-list');

async function init() {
  const categories = await loadCategories();
  const rows = listCategories(categories).sort((a, b) => a.sortOrder - b.sortOrder);

  listEl.innerHTML = '';
  for (const c of rows) {
    const li = el('li');
    li.appendChild(
      el('a', { class: 'card', href: categoryHref(c.slug) }, [
        el('span', { class: 'name', text: c.name }),
        el('div', {
          class: 'snippet',
          text: `${c.componentCount} component${c.componentCount === 1 ? '' : 's'}`,
        }),
      ])
    );
    listEl.appendChild(li);
  }
}

init();
