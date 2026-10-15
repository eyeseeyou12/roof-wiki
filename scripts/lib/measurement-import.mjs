// Measurement parsing only; no file storage, network calls, or ventilation formulas.
export const MAX_IMPORT_ROWS = 250;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export class MeasurementImportError extends Error {}
const numberPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const numberRE = new RegExp(`^${numberPattern}$`);
const normalize = value => String(value ?? '').trim().toLowerCase().replace(/²/g, '2').replace(/[^a-z0-9]/g, '');

export function readNumber(value) {
  const text = String(value ?? '').trim();
  const number = numberRE.test(text) ? Number(text.replaceAll(',', '')) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function areaUnit(value) {
  const unit = normalize(value);
  if (['sqft', 'sf', 'ft2', 'squarefeet', 'squarefoot'].includes(unit)) return 'sqft';
  if (['sq', 'squares', 'square', 'roofingsquares'].includes(unit)) return 'squares';
  if (['m2', 'sqm', 'squaremeters', 'squaremetres'].includes(unit)) return 'sqm';
  return '';
}

export function readPitch(value, run) {
  const text = String(value ?? '').trim();
  if (!text) return { pitchRise: null, pitchRun: 12 };
  const ratio = text.match(/^(\d+(?:\.\d+)?)\s*[/ :]\s*(\d+(?:\.\d+)?)$/);
  if (ratio) return { pitchRise: Number(ratio[1]), pitchRun: Number(ratio[2]) };
  return { pitchRise: readNumber(text), pitchRun: String(run ?? '').trim() ? readNumber(run) : 12 };
}

// Quoted cells, escaped quotes, CRLF, BOM, and embedded newlines are supported.
export function csvRows(text) {
  if (text.length > 2 * 1024 * 1024) throw new MeasurementImportError('CSV is too large. Export only the roof-measurement rows (up to 2 MB).');
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = ['\t', ';', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = []; let cell = ''; let quoted = false; let closed = false;
  const finishRow = () => { row.push(cell); if (row.some(c => c.trim())) rows.push(row); row = []; cell = ''; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell.trim() || closed) throw new MeasurementImportError('CSV contains an unexpected quote. Export it again as CSV.');
      cell = ''; quoted = true;
    } else if (char === delimiter) { row.push(cell); cell = ''; closed = false; }
    else if (char === '\n' || char === '\r') { finishRow(); if (char === '\r' && text[i + 1] === '\n') i++; }
    else if (closed && char.trim()) throw new MeasurementImportError('CSV has text after a closing quote.');
    else cell += char;
    if (rows.length > MAX_IMPORT_ROWS + 20) throw new MeasurementImportError(`Import at most ${MAX_IMPORT_ROWS} roof rows at a time.`);
  }
  if (quoted) throw new MeasurementImportError('CSV has an unclosed quoted cell.');
  finishRow();
  return rows;
}

export function parseMeasurementCsv(text) {
  const table = csvRows(text);
  if (table.length < 2) throw new MeasurementImportError('CSV needs a header row and at least one roof-measurement row.');
  const headers = table[0].map(normalize);
  const find = aliases => headers.findIndex(h => aliases.includes(h));
  const area = find(['area', 'roofarea', 'roofareasqft', 'areasqft', 'areasf', 'areaft2', 'areaft', 'roofareasf', 'squarefeet', 'squares', 'areasquares', 'roofingsquares', 'aream2', 'areasqm']);
  if (area < 0) throw new MeasurementImportError('No roof-area column found. Use headers such as label, area_sqft, pitch, attic. See the CSV example below.');
  const pitch = find(['pitch', 'slope', 'roofpitch', 'pitchrise', 'rise']);
  const run = find(['pitchrun', 'run']);
  const unit = find(['unit', 'units', 'areaunit', 'areaunits']);
  const label = find(['label', 'facet', 'facetid', 'name', 'roofplane', 'segment']);
  const attic = find(['attic', 'atticsection', 'section', 'building', 'structure']);
  const headerUnit = /squares/.test(headers[area]) ? 'squares' : /m2|sqm/.test(headers[area]) ? 'sqm' : /sqft|sf|ft2|areaft$|squarefeet/.test(headers[area]) ? 'sqft' : '';
  const rows = []; let summaries = 0;
  for (let i = 1; i < table.length; i++) {
    const cells = table[i];
    if (cells.length !== table[0].length) throw new MeasurementImportError(`CSV row ${i + 1} has ${cells.length} cells; the header has ${table[0].length}. Check commas and quotes.`);
    const name = label >= 0 ? cells[label].trim() : `Roof row ${i}`;
    if (/\b(total|subtotal|waste)\b/i.test(name)) { summaries++; continue; }
    if (!cells[area].trim()) throw new MeasurementImportError(`CSV row ${i + 1} is missing its area. Fill it or remove the row.`);
    rows.push({ label: name || `Roof row ${i}`, area: readNumber(cells[area]), unit: unit >= 0 ? areaUnit(cells[unit]) : headerUnit,
      ...readPitch(pitch >= 0 ? cells[pitch] : '', run >= 0 ? cells[run] : ''),
      attic: attic >= 0 ? cells[attic].trim() || 'Main attic' : 'Main attic', included: true,
      source: `CSV row ${i + 1}: ${cells.join(' | ').slice(0, 220)}` });
  }
  if (!rows.length) throw new MeasurementImportError('No individual roof measurements found. Total/waste rows are excluded.');
  if (rows.length > MAX_IMPORT_ROWS) throw new MeasurementImportError(`Import at most ${MAX_IMPORT_ROWS} roof rows at a time.`);
  const warnings = [];
  if (summaries) warnings.push(`${summaries} total/waste row(s) omitted to avoid counting them again.`);
  if (rows.some(r => !r.unit)) warnings.push('Choose the area unit for rows whose CSV did not specify one.');
  if (rows.some(r => r.pitchRise === null)) warnings.push('Some rows need a pitch. No pitch has been guessed.');
  return { rows, warnings };
}

// Position-aware reconstruction keeps table columns on the same text line.
export function pdfTextLines(items) {
  const lines = [];
  for (const item of items) {
    if (!item.str?.trim() || !item.transform || Math.abs(item.transform[1]) > Math.abs(item.transform[0]) * 0.2) continue;
    const x = item.transform[4], y = item.transform[5];
    let line = lines.find(l => Math.abs(l.y - y) < 2.5);
    if (!line) { line = { y, cells: [] }; lines.push(line); }
    line.cells.push({ x, text: item.str });
  }
  return lines.sort((a,b) => b.y - a.y).map(l => l.cells.sort((a,b) => a.x - b.x).map(c => c.text).join(' ').replace(/\s+/g, ' ').trim());
}

export function parseMeasurementPdfPages(pages) {
  const candidates = []; const summaries = []; const warnings = [];
  const pitchRE = /\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/g;
  const units = '(sq\\.?\\s*ft\\.?|sqft|sf|ft[²2]|squares|sq\\.?\\s*m\\.?|m[²2])';
  pages.forEach((page, pageIndex) => {
    const lines = Array.isArray(page) ? page : page.split(/\r?\n/);
    // Roofr-style summary: one pitch header row followed by an area row.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const total = line.match(new RegExp(`(?:total\\s+roof\\s+area|total\\s+area)\\s*:?\\s*(${numberPattern})\\s*${units}`, 'i'));
      if (total) summaries.push({ area: readNumber(total[1]), unit: areaUnit(total[2]), source: `PDF page ${pageIndex + 1}: ${total[0]}` });
      if (!/^pitch(?:es)?\s*:?\s/i.test(line)) continue;
      const pitches = line.match(pitchRE) || [];
      if (!pitches.length) continue;
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const areaLine = lines[j].trim();
        const areaMatch = areaLine.match(new RegExp(`^area\\s*\\(\\s*${units}\\s*\\)\\s*:?(.*)$`, 'i'));
        if (!areaMatch) continue;
        const values = areaMatch[2].trim().split(/\s+/).map(readNumber);
        if (values.length !== pitches.length || values.some(n => n === null || n <= 0)) { warnings.push(`Page ${pageIndex + 1}: a pitch table could not be aligned; review the report manually.`); break; }
        candidates.push({ rows: pitches.map((pitch, index) => ({ label: `${pitch.replace(/\s/g, '')} roof area`, area: values[index], unit: areaUnit(areaMatch[1]), ...readPitch(pitch), attic: 'Main attic', included: true, source: `PDF page ${pageIndex + 1}: ${line} / ${areaLine}` })), page: pageIndex + 1 });
        break;
      }
    }
    // A facet table with explicit area units and pitch on each row.
    const facetRows = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (/\b(total|subtotal|waste|predominant|summary)\b/i.test(line)) continue;
      const match = line.match(new RegExp(`^(?:facet\\s+|plane\\s+|segment\\s+)?([a-z][a-z0-9_-]*)\\s+(${numberPattern})\\s*${units}\\s+(${pitchRE.source})$`, 'i'));
      if (match) facetRows.push({label: match[1], area: readNumber(match[2]), unit: areaUnit(match[3]), ...readPitch(match[4]), attic: 'Main attic', included: true, source: `PDF page ${pageIndex + 1}: ${line}`});
    }
    if (facetRows.length) candidates.push({rows: facetRows, page: pageIndex + 1});
  });
  if (candidates.length) {
    // Never add repeated summaries or a facet table to its own total.
    const first = candidates[0];
    const rows = first.rows;
    if (rows.length > MAX_IMPORT_ROWS) throw new MeasurementImportError(`Import at most ${MAX_IMPORT_ROWS} roof rows at a time.`);
    if (candidates.length > 1) warnings.push(`Used the first measurement table, on page ${first.page}. Other tables were not combined; check for separate buildings or additional pages.`);
    warnings.push('PDF rows may group several roof faces by pitch. Split those rows if they cover separate attic spaces; exclude patios, vaulted areas, and other roof area without attic below.');
    const total = summaries.find(s => s.unit === rows[0].unit);
    if (total) {
      const sum = rows.reduce((n,r) => n + r.area, 0);
      warnings.push(`Detected table total: ${sum.toLocaleString('en-US')} ${total.unit}. Report total: ${total.area.toLocaleString('en-US')} ${total.unit}. Check rounding, excluded areas, and coverage.`);
    }
    return {rows, warnings};
  }
  if (summaries.length) {
    warnings.push('Only a total roof area was recognized. Supply the pitch or split the area into individual pitches. A predominant pitch is not a pitch for the entire roof.');
    return {rows: [{label: 'Total roof area — review coverage', ...summaries[0], pitchRise: null, pitchRun: 12, attic: 'Main attic', included: true}], warnings};
  }
  throw new MeasurementImportError('No supported roof area/pitch table was found. This PDF may be scanned or use a different layout. Export a measurement CSV or enter the roof segments manually.');
}

export function reviewedSections(rows) {
  const selected = rows.filter(r => r.included);
  if (!selected.length) throw new MeasurementImportError('Select at least one roof row to import.');
  if (selected.length > MAX_IMPORT_ROWS) throw new MeasurementImportError(`Import at most ${MAX_IMPORT_ROWS} rows.`);
  const groups = new Map();
  for (const [index, row] of selected.entries()) {
    const area = readNumber(row.area), rise = readNumber(row.pitchRise), run = readNumber(row.pitchRun);
    const factor = {sqft: 1, squares: 100, sqm: 10.76391041671}[row.unit];
    if (area === null || area <= 0 || !factor) throw new MeasurementImportError(`Row ${index + 1}: enter a positive area and select its unit.`);
    if (rise === null || run === null || run <= 0) throw new MeasurementImportError(`Row ${index + 1}: enter a pitch rise (0 for flat) and a positive run.`);
    const label = String(row.attic ?? '').trim();
    if (!label) throw new MeasurementImportError(`Row ${index + 1}: name the attic section.`);
    const roofAreaSqFt = Math.round(area * factor * 100) / 100;
    if (!Number.isFinite(roofAreaSqFt) || roofAreaSqFt <= 0) throw new MeasurementImportError(`Row ${index + 1}: area is outside the supported range.`);
    if (!groups.has(label)) groups.set(label, {label, segments: []});
    groups.get(label).segments.push({roofAreaSqFt, pitchRise: rise, pitchRun: run});
  }
  return [...groups.values()];
}
