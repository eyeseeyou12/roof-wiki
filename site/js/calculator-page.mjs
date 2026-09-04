import {
  estimateAtticFloorArea,
  calculateForSections,
  estimateExhaustOptions,
  estimateIntakeOptions,
  listAvailableBrands,
  CFM_SIZED_COMPONENTS,
  VentilationCalculatorError,
} from '/lib/ventilation-calculator.mjs';
import { loadComponents, loadProducts } from './data.mjs';
import { el, escapeHtml, componentHref } from './render.mjs';

const sectionsContainer = document.getElementById('sections-container');
const addSectionBtn = document.getElementById('add-section');
const brandSelect = document.getElementById('brand-select');
const exceptionCheckbox = document.getElementById('exception-confirmed');
const form = document.getElementById('calculator-form');
const errorEl = document.getElementById('calculator-error');
const resultsEl = document.getElementById('results-container');

let nextSectionId = 0;
let products = [];
let componentsBySlug = {};

function sectionTemplate(sectionId, isFirst) {
  return `
    <fieldset class="section-block" data-section-id="${sectionId}">
      <legend>${isFirst ? 'This attic' : 'Separated attic section'}</legend>
      ${isFirst ? '' : `
        <p class="helper-text">Only use this for a space that's actually cut off from the main attic — a garage attic behind a firewall, an addition not open to the rest — since combined totals can hide an under-ventilated section. Each section is sized independently.</p>
        <div class="field-row">
          <div>
            <label>Section label</label>
            <input type="text" class="section-label" placeholder="e.g. Garage attic" value="Separated section">
          </div>
        </div>
      `}
      ${isFirst ? `
        <div class="field-row">
          <div>
            <label>Section label (optional)</label>
            <input type="text" class="section-label" placeholder="e.g. Main attic">
          </div>
        </div>
      ` : ''}

      <div class="field-row">
        <div>
          <label>How do you know the attic area?</label>
          <select class="mode-select">
            <option value="roof">From a roof report (roof segments)</option>
            <option value="direct">I know the attic square footage directly</option>
          </select>
        </div>
      </div>

      <div class="mode-roof">
        <div class="segments-container"></div>
        <button type="button" class="secondary add-segment">+ Add roof segment</button>

        <div class="field-row" style="margin-top:0.75rem;">
          <div>
            <label>Eave length (ft, optional)</label>
            <input type="number" class="eave-length" min="0" step="0.1" placeholder="e.g. 120">
          </div>
          <div>
            <label>Overhang depth (ft, optional)</label>
            <input type="number" class="overhang-depth" min="0" step="0.1" placeholder="e.g. 1.5">
          </div>
        </div>
        <p class="helper-text">Both optional — leave blank to skip the overhang correction. Aerial roof reports measure to the outer roofline, which extends past the walls by the overhang depth; that strip isn't attic space.</p>
      </div>

      <div class="mode-direct" hidden>
        <div class="field-row">
          <div>
            <label>Attic square footage</label>
            <input type="number" class="direct-sqft" min="0" step="1" placeholder="e.g. 1800">
          </div>
        </div>
      </div>

      ${isFirst ? '' : '<button type="button" class="ghost remove-section">Remove this section</button>'}
    </fieldset>
  `;
}

function segmentRowTemplate() {
  return `
    <div class="segment-row">
      <div>
        <label>Roof area (sq ft)</label>
        <input type="number" class="seg-area" min="0" step="1" aria-label="Roof segment area, sq ft" placeholder="e.g. 1200">
      </div>
      <div>
        <label>Pitch rise</label>
        <input type="number" class="seg-rise" min="0" step="0.5" aria-label="Pitch rise" placeholder="e.g. 5" value="5">
      </div>
      <div>
        <label>Pitch run</label>
        <input type="number" class="seg-run" min="1" step="1" aria-label="Pitch run" placeholder="12" value="12">
      </div>
      <button type="button" class="remove-row" aria-label="Remove this segment">✕</button>
    </div>
  `;
}

function addSection() {
  const id = nextSectionId++;
  const isFirst = sectionsContainer.children.length === 0;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = sectionTemplate(id, isFirst).trim();
  const block = wrapper.firstElementChild;
  sectionsContainer.appendChild(block);
  addSegmentRow(block);
  updateRemoveSegmentState(block);
}

function addSegmentRow(sectionBlock) {
  const container = sectionBlock.querySelector('.segments-container');
  const wrapper = document.createElement('div');
  wrapper.innerHTML = segmentRowTemplate().trim();
  container.appendChild(wrapper.firstElementChild);
  updateRemoveSegmentState(sectionBlock);
}

function updateRemoveSegmentState(sectionBlock) {
  const rows = sectionBlock.querySelectorAll('.segment-row');
  rows.forEach((row, i) => {
    row.querySelector('.remove-row').disabled = rows.length === 1;
  });
}

sectionsContainer.addEventListener('click', (e) => {
  const sectionBlock = e.target.closest('.section-block');
  if (e.target.matches('.add-segment')) {
    addSegmentRow(sectionBlock);
  } else if (e.target.matches('.remove-row')) {
    const row = e.target.closest('.segment-row');
    const container = sectionBlock.querySelector('.segments-container');
    if (container.children.length > 1) row.remove();
    updateRemoveSegmentState(sectionBlock);
  } else if (e.target.matches('.remove-section')) {
    sectionBlock.remove();
  }
});

sectionsContainer.addEventListener('change', (e) => {
  if (!e.target.matches('.mode-select')) return;
  const sectionBlock = e.target.closest('.section-block');
  const isDirect = e.target.value === 'direct';
  sectionBlock.querySelector('.mode-roof').hidden = isDirect;
  sectionBlock.querySelector('.mode-direct').hidden = !isDirect;
});

addSectionBtn.addEventListener('click', addSection);

async function init() {
  const [comps, prods] = await Promise.all([loadComponents(), loadProducts()]);
  componentsBySlug = comps;
  products = prods;

  brandSelect.innerHTML = '<option value="">Generic reference figures</option>';
  for (const brand of listAvailableBrands(products)) {
    brandSelect.appendChild(el('option', { value: brand, text: brand }));
  }

  addSection();
}

function readSection(sectionBlock) {
  const label = sectionBlock.querySelector('.section-label')?.value.trim() || null;
  const mode = sectionBlock.querySelector('.mode-select').value;

  if (mode === 'direct') {
    const sqft = parseFloat(sectionBlock.querySelector('.direct-sqft').value);
    return { label, atticSquareFootage: sqft, method: 'direct' };
  }

  const segments = [...sectionBlock.querySelectorAll('.segment-row')].map((row) => ({
    roofAreaSqFt: parseFloat(row.querySelector('.seg-area').value),
    pitchRise: parseFloat(row.querySelector('.seg-rise').value),
    pitchRun: parseFloat(row.querySelector('.seg-run').value) || 12,
  }));

  const eaveLengthFt = parseFloatOrNull(sectionBlock.querySelector('.eave-length').value);
  const overhangDepthFt = parseFloatOrNull(sectionBlock.querySelector('.overhang-depth').value);

  const estimate = estimateAtticFloorArea({ segments, eaveLengthFt, overhangDepthFt });
  return { label, ...estimate };
}

function parseFloatOrNull(value) {
  if (value === '' || value == null) return null;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  errorEl.hidden = true;
  resultsEl.innerHTML = '';

  const sectionBlocks = [...sectionsContainer.querySelectorAll('.section-block')];
  const exceptionConditionsConfirmed = exceptionCheckbox.checked;
  const brand = brandSelect.value || null;

  try {
    const readSections = sectionBlocks.map(readSection);
    const forCalc = readSections.map((s) => ({
      label: s.label,
      atticSquareFootage: s.atticSquareFootage,
      exceptionConditionsConfirmed,
    }));
    const { sections, combinedTotalNfaSqIn } = calculateForSections(forCalc);

    renderResults(sections, readSections, combinedTotalNfaSqIn, brand);
  } catch (err) {
    if (err instanceof VentilationCalculatorError) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } else {
      throw err;
    }
  }
});

function renderResults(sections, readSections, combinedTotalNfaSqIn, brand) {
  const brandOpts = brand ? { brand, products } : {};

  sections.forEach((result, i) => {
    const source = readSections[i];
    const panel = el('div', { class: 'results-panel' });
    panel.appendChild(el('h3', { text: result.label || (sections.length > 1 ? `Section ${i + 1}` : 'Results') }));

    const methodNote =
      source.method === 'direct'
        ? `Attic area entered directly: ${result.atticSquareFootage} sq ft.`
        : source.method === 'pitch-and-overhang'
        ? `Attic floor area estimated from roof segments (pitch-corrected) minus a ${source.overhangAreaSqFt} sq ft overhang strip: ${result.atticSquareFootage} sq ft.`
        : `Attic floor area estimated from roof segments (pitch-corrected only — no overhang correction applied): ${result.atticSquareFootage} sq ft.`;
    panel.appendChild(el('p', { class: 'helper-text', text: `${methodNote} Ratio used: ${result.ratioUsed}.` }));

    panel.appendChild(
      el('div', { class: 'stat-row' }, [
        stat(result.totalNfaSqIn, 'Total NFA (sq in)'),
        stat(result.exhaustNfaSqIn, 'Exhaust NFA (sq in)'),
        stat(result.intakeNfaSqIn, 'Intake NFA (sq in)'),
      ])
    );

    panel.appendChild(optionsTable('Exhaust options', estimateExhaustOptions(result.exhaustNfaSqIn, brandOpts), brand));
    panel.appendChild(cfmNote());
    panel.appendChild(optionsTable('Intake options', estimateIntakeOptions(result.intakeNfaSqIn, brandOpts), brand));

    resultsEl.appendChild(panel);
  });

  if (sections.length > 1) {
    resultsEl.appendChild(
      el('div', { class: 'notice' }, [
        el('strong', { text: `Combined total: ${combinedTotalNfaSqIn} sq in NFA. ` }),
        el('span', {
          text: 'Materials-quantity total only — never use this to size or balance any single section. Each section above is sized independently.',
        }),
      ])
    );
  }
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [el('div', { class: 'value', text: value }), el('div', { class: 'label', text: label })]);
}

function optionsTable(title, options, brand) {
  const wrap = el('div', { class: 'field-block' }, [el('h2', { text: title })]);
  if (!options.length) {
    wrap.appendChild(
      el('p', { class: 'helper-text', text: brand ? `No ${brand} products recorded for this option.` : 'No options available.' })
    );
    return wrap;
  }

  const table = el('table', { class: 'options-table' });
  const isBrand = Boolean(brand);
  table.innerHTML = `
    <thead>
      <tr>
        <th>${isBrand ? 'Product' : 'Component'}</th>
        <th>Quantity</th>
        <th>Unit</th>
        ${isBrand ? '<th>NFA rating</th>' : '<th>If lower-NFA product</th>'}
      </tr>
    </thead>
  `;
  const tbody = el('tbody');
  for (const o of options) {
    const nameCell = isBrand ? `${escapeHtml(o.brand)} ${escapeHtml(o.productName)}` : componentLink(o.component);
    const extraCell = isBrand
      ? `${o.nfaRating} sq in`
      : o.quantityIfLowerNfaProduct
      ? `up to ${o.quantityIfLowerNfaProduct}`
      : '—';
    const row = el('tr', {
      html: `<td>${nameCell}</td><td>${o.quantity}</td><td>${escapeHtml(o.unit)}</td><td>${extraCell}</td>`,
    });
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrap.appendChild(el('div', { class: 'overflow-x' }, [table]));
  wrap.appendChild(
    el('p', { class: 'helper-text', text: 'Estimates against reference NFA figures — verify against the spec sheet of whatever you actually buy.' })
  );
  return wrap;
}

function componentLink(slug) {
  const c = componentsBySlug[slug];
  const name = c ? c.displayName : slug;
  return `<a href="${componentHref(slug)}">${escapeHtml(name)}</a>`;
}

function cfmNote() {
  const names = CFM_SIZED_COMPONENTS.map((slug) => componentLink(slug)).join(', ');
  return el('p', {
    class: 'helper-text',
    html: `Also valid as exhaust, sized by CFM against attic volume rather than NFA — not calculated here: ${names}.`,
  });
}

init();
