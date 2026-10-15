import { MAX_IMPORT_ROWS, reviewedSections } from '/lib/measurement-import.mjs';
import { readMeasurementFile } from '/lib/measurement-file.mjs';
import { el } from './render.mjs';

export function initMeasurementUpload(onApply) {
  const controls = document.getElementById('measurement-upload-controls');
  const fileInput = document.getElementById('measurement-file');
  const status = document.getElementById('measurement-status');
  const error = document.getElementById('measurement-error');
  const review = document.getElementById('measurement-review');
  let request = 0;
  controls.disabled = false;

  const showError = message => { error.textContent = message; error.hidden = false; };
  const cancel = () => {
    request++;
    review.replaceChildren(); fileInput.value = ''; status.textContent = ''; error.hidden = true;
  };
  document.getElementById('measurement-cancel').addEventListener('click', cancel);

  fileInput.addEventListener('change', async () => {
    const id = ++request;
    const file = fileInput.files?.[0];
    review.replaceChildren(); error.hidden = true;
    if (!file) { status.textContent = ''; return; }
    status.textContent = `Reading ${file.name}…`;
    try {
      const data = await readMeasurementFile(file);
      if (id !== request) return;
      status.textContent = `${file.name}: ${data.rows.length} measurement row(s) found. Review before applying.`;
      renderReview(data, file.name, id);
    } catch (err) {
      if (id !== request) return;
      status.textContent = '';
      showError(err.message || 'The file could not be read. Try a PDF or CSV export.');
    }
  });

  function renderReview(data, fileName, requestId) {
    const form = el('form', {class: 'measurement-review-form'});
    form.appendChild(el('h3', {text: 'Review roof measurements'}));
    form.appendChild(el('p', {class: 'helper-text', text: 'Use sloped roof surface area without waste. Exclude roof areas without attic below. Give rows the same attic name only when those spaces are connected. Imported measurements do not include an overhang correction.'}));
    for (const warning of data.warnings) form.appendChild(el('p', {class: 'notice', text: warning}));
    const rowsContainer = el('div', {class: 'measurement-rows'});
    const rowFields = [];
    let nextId = 0;
    const reviewed = el('input', {type: 'checkbox', id: 'measurement-confirmed', required: true});
    const addRow = row => {
      if (rowFields.length >= MAX_IMPORT_ROWS) { showError(`Maximum ${MAX_IMPORT_ROWS} rows per import.`); return; }
      const i = ++nextId;
      const card = el('fieldset', {class: 'measurement-row'});
      card.appendChild(el('legend', {text: `Measurement ${i}`}));
      const include = el('input', {type: 'checkbox', id: `measurement-include-${i}`}); include.checked = row.included !== false;
      card.appendChild(el('label', {for: include.id || `measurement-include-${i}`, class: 'check-label'}, [include, ' Include this roof area']));
      const fields = el('div', {class: 'measurement-fields'});
      const field = (label, key, attrs = {}, options) => {
        const id = `measurement-${key}-${i}`;
        const input = options ? el('select', {id}, options.map(([value, text]) => el('option', {value, text}))) : el('input', {id, ...attrs});
        input.value = row[key] ?? '';
        fields.appendChild(el('div', {}, [el('label', {for: id, text: label}), input]));
        return input;
      };
      const label = field('Roof face or group', 'label', {type: 'text', maxlength: '100'});
      const area = field('Roof area', 'area', {type: 'number', min: '0.01', step: 'any', required: true});
      const unit = field('Area unit', 'unit', {}, [['','Choose unit'], ['sqft','Square feet'], ['squares','Roofing squares (100 sq ft)'], ['sqm','Square metres']]); unit.required = true;
      const rise = field('Pitch rise', 'pitchRise', {type: 'number', min: '0', step: 'any', required: true});
      const run = field('Pitch run', 'pitchRun', {type: 'number', min: '0.01', step: 'any', required: true});
      const attic = field('Attic section', 'attic', {type: 'text', maxlength: '100', required: true});
      card.appendChild(fields);
      if (row.source) card.appendChild(el('details', {}, [el('summary', {text: 'Source excerpt'}), el('p', {class:'helper-text', text: row.source})]));
      const inputs = [label, area, unit, rise, run, attic];
      const toggle = () => { for (const input of inputs) input.disabled = !include.checked; reviewed.checked = false; };
      include.addEventListener('change', toggle); toggle();
      card.addEventListener('input', () => { reviewed.checked = false; error.hidden = true; });
      card.addEventListener('change', () => { reviewed.checked = false; });
      rowFields.push({include, label, area, unit, rise, run, attic});
      rowsContainer.appendChild(card);
    };
    for (const row of data.rows) addRow(row);
    form.appendChild(rowsContainer);
    const add = el('button', {type: 'button', class: 'secondary', text: '+ Add or split a roof row'});
    add.addEventListener('click', () => addRow({label:'', area:'', unit:'sqft', pitchRise:'', pitchRun:12, attic:'Main attic', included:true}));
    form.appendChild(add);
    const mode = el('select', {id:'measurement-apply-mode'}, [el('option',{value:'append',text:'Add as new attic sections'}), el('option',{value:'replace',text:'Replace current attic sections'})]);
    mode.addEventListener('change', () => { reviewed.checked = false; });
    form.appendChild(el('div', {class:'import-apply-mode'}, [el('label',{for:'measurement-apply-mode',text:'How to apply these measurements'}), mode]));
    form.appendChild(el('p',{class:'helper-text',text:'Adding preserves entered measurements. Replacing removes all current attic sections and their overhang entries. Split a grouped row by reducing its original area and adding the remaining area as a new row.'}));
    form.appendChild(el('label',{for:'measurement-confirmed',class:'check-label'}, [reviewed, ' I checked the areas, units, pitches, excluded areas, and attic assignments.']));
    form.appendChild(el('button',{type:'submit',text:'Use reviewed measurements'}));
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (requestId !== request || !reviewed.checked) return;
      error.hidden = true;
      try {
        const rows = rowFields.map(f => ({included:f.include.checked, label:f.label.value, area:f.area.value, unit:f.unit.value, pitchRise:f.rise.value, pitchRun:f.run.value, attic:f.attic.value}));
        const sections = reviewedSections(rows);
        onApply(sections, mode.value);
        review.replaceChildren(); fileInput.value = '';
        status.textContent = `Applied ${sections.length} attic section(s) from ${fileName}. Check overhangs below, then select Calculate.`;
        request++;
      } catch (err) { showError(err.message); }
    });
    review.appendChild(form);
  }
}
