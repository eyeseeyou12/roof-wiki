import test from 'node:test';
import assert from 'node:assert/strict';
import { csvRows, parseMeasurementCsv, parseMeasurementPdfPages, pdfTextLines, reviewedSections, MAX_FILE_BYTES } from '../scripts/lib/measurement-import.mjs';
import { readMeasurementFile } from '../scripts/lib/measurement-file.mjs';
import { estimateAtticFloorArea } from '../scripts/lib/ventilation-calculator.mjs';

const csv = 'label,area_sqft,pitch,attic\nFront,1300,5/12,Main attic\nRear,900,6/12,Main attic\nGarage,400,4/12,Garage attic';
test('CSV imports separate attic groups without pitch or area loss', () => {
  const result = parseMeasurementCsv(csv);
  const groups = reviewedSections(result.rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].segments.length, 2);
  assert.equal(groups[1].label, 'Garage attic');
  assert.equal(estimateAtticFloorArea({segments: [groups[0].segments[0]]}).atticSquareFootage, 1200);
});
test('CSV handles BOM, quoted commas, escaped quotes, CRLF and quoted newlines', () => {
  const result = parseMeasurementCsv('\uFEFFlabel,area_sqft,pitch,attic\r\n"Front, left", "1,300",5/12,"Main ""A""\nattic"');
  assert.equal(result.rows[0].area, 1300);
  assert.equal(result.rows[0].label, 'Front, left');
  assert.equal(result.rows[0].attic, 'Main "A"\nattic');
});
test('semicolon and tab-delimited measurement exports work', () => {
  for (const separator of [';', '\t']) assert.equal(parseMeasurementCsv(['area_sqft','pitch'].join(separator)+'\n'+['1300','5/12'].join(separator)).rows[0].area, 1300);
});
test('malformed CSV fails instead of dropping or shifting rows', () => {
  for (const text of ['area_sqft,pitch\n1,300,5/12', 'area_sqft,pitch\n"1300,5/12', 'area_sqft,pitch\n,5/12']) assert.throws(() => parseMeasurementCsv(text));
  assert.throws(() => csvRows('area,pitch\n"100"x,5/12'), /closing quote/);
});
test('ambiguous units and missing pitches require review, never default values', () => {
  const result = parseMeasurementCsv('label,area\nFront,1300');
  assert.equal(result.rows[0].unit, '');
  assert.equal(result.rows[0].pitchRise, null);
  assert.throws(() => reviewedSections(result.rows), /unit/);
  result.rows[0].unit = 'sqft';
  assert.throws(() => reviewedSections(result.rows), /pitch/);
});
test('roofing squares and square metres convert before calculation', () => {
  const result = parseMeasurementCsv('label,area,unit,pitch_rise,pitch_run,attic\nA,13,squares,5,12,A\nB,100,m2,4,12,B');
  const groups = reviewedSections(result.rows);
  assert.equal(groups[0].segments[0].roofAreaSqFt, 1300);
  assert.equal(groups[1].segments[0].roofAreaSqFt, 1076.39);
});
test('totals and waste rows are excluded from CSV imports', () => {
  const result = parseMeasurementCsv('label,area_sqft,pitch\nFront,1300,5/12\nTotal,1300,5/12\nWaste 10%,1430,5/12');
  assert.equal(result.rows.length, 1);
  assert.match(result.warnings[0], /2 total/);
});
test('excluded rows do not need pitch values and flat roofs retain zero rise', () => {
  const rows = parseMeasurementCsv('label,area_sqft,pitch\nRoof,1300,0/12\nPatio,200,').rows;
  rows[1].included = false;
  assert.equal(reviewedSections(rows)[0].segments[0].pitchRise, 0);
  rows[0].pitchRun = 0;
  assert.throws(() => reviewedSections(rows), /positive run/);
});
test('non-numeric, non-finite, zero, and negative areas cannot reach the calculator', () => {
  for (const value of ['not a number', 'Infinity', '0', '-5', '9'.repeat(400)]) {
    const rows = parseMeasurementCsv(csv).rows; rows[0].area = value;
    assert.throws(() => reviewedSections(rows), /positive area/);
  }
});
test('PDF imports the pitch-area table, not predominant pitch or waste quantities', () => {
  const result = parseMeasurementPdfPages([['Total Roof Area: 2200 sqft Predominant Pitch: 5/12', 'Pitch 5/12 6/12', 'Area (sqft) 1,300 900', 'Squares 13 9', 'Waste % 0% 10% 15%', 'Area (sqft) 2200 2420 2530']]);
  assert.deepEqual(result.rows.map(r => [r.area,r.pitchRise]), [[1300,5],[900,6]]);
});
test('PDF repeated tables are not added twice and coverage is flagged', () => {
  const page = ['Pitch 5/12 6/12', 'Area (sqft) 1300 900'];
  const result = parseMeasurementPdfPages([page,page]);
  assert.equal(result.rows.length, 2);
  assert.ok(result.warnings.some(w => /first measurement table/.test(w)));
});
test('PDF total-only fallback leaves pitch blank', () => {
  const result = parseMeasurementPdfPages([['Total Roof Area: 2200 sqft Predominant Pitch: 8/12']]);
  assert.equal(result.rows[0].pitchRise, null);
  assert.throws(() => reviewedSections(result.rows), /pitch/);
});
test('unreadable PDF layout fails and a misaligned table never guesses column pairs', () => {
  assert.throws(() => parseMeasurementPdfPages([[]]), /No supported/);
  assert.throws(() => parseMeasurementPdfPages([['Pitch 5/12 6/12','Area (sqft) 1300']]), /No supported/);
});
test('explicit facet rows and PDF text item positions are recognized', () => {
  const result = parseMeasurementPdfPages([['Facet A 1300 sqft 5/12','Facet B 900 sqft 6/12']]);
  assert.equal(result.rows.length, 2);
  const items = [{str:'900',transform:[12,0,0,12,200,680]},{str:'Pitch 5/12 6/12',transform:[12,0,0,12,50,700]},{str:'Area (sqft) 1300',transform:[12,0,0,12,50,680]}];
  assert.deepEqual(pdfTextLines(items), ['Pitch 5/12 6/12','Area (sqft) 1300 900']);
});
test('file reader validates limits, gives an honest ESX fallback, and reads CSV without PDF code', async () => {
  const file = {name:'roof.csv',size:csv.length,text:async()=>csv};
  assert.equal((await readMeasurementFile(file, {loadPdf:()=>{throw new Error('should not load');}})).rows.length, 3);
  await assert.rejects(readMeasurementFile({...file,name:'roof.esx'}), /Native ESX decoding is not supported/);
  await assert.rejects(readMeasurementFile({...file,size:MAX_FILE_BYTES+1}), /20 MB/);
  await assert.rejects(readMeasurementFile({...file,size:0}), /non-empty/);
});

// A minimal in-memory PDF fixture exercises the actual PDF.js text reader.
function testPdf() {
  const stream = 'BT /F1 12 Tf 50 700 Td (Pitch 5/12 6/12) Tj 0 -20 Td (Area \\(sqft\\) 1300 900) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object,i) => {offsets.push(pdf.length); pdf += `${i+1} 0 obj\n${object}\nendobj\n`;});
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
test('actual PDF bytes become editable area/pitch rows through PDF.js', async () => {
  const bytes = testPdf();
  const result = await readMeasurementFile({name:'sample.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer}, {loadPdf:()=>import('pdfjs-dist/legacy/build/pdf.mjs'),workerSrc:import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')});
  assert.deepEqual(result.rows.map(r => [r.area,r.pitchRise]), [[1300,5],[900,6]]);
});
