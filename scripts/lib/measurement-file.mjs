import { MAX_FILE_BYTES, MeasurementImportError, parseMeasurementCsv, parseMeasurementPdfPages, pdfTextLines } from './measurement-import.mjs';

export async function readMeasurementFile(file, { loadPdf = () => import('./vendor/pdf.mjs'), workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href } = {}) {
  if (!file || !file.size) throw new MeasurementImportError('Choose a non-empty measurement file.');
  if (file.size > MAX_FILE_BYTES) throw new MeasurementImportError('Choose a file smaller than 20 MB.');
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'esx') throw new MeasurementImportError('Native ESX decoding is not supported yet. Export a roof-measurement PDF or CSV and select that file here.');
  if (extension === 'csv') return parseMeasurementCsv(await file.text());
  if (extension !== 'pdf') throw new MeasurementImportError('Choose a PDF or CSV roof-measurement report.');
  const pdfjs = await loadPdf();
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, useSystemFonts: true});
  let timeout;
  try {
    const extraction = async () => {
      const pdf = await task.promise;
      if (pdf.numPages > 100) throw new MeasurementImportError('This PDF has more than 100 pages. Export just its roof-measurement pages.');
      const pages = []; let size = 0;
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const lines = pdfTextLines(content.items);
        size += lines.join('\n').length;
        if (size > 2 * 1024 * 1024) throw new MeasurementImportError('This PDF contains too much text. Export just its roof-measurement pages.');
        pages.push(lines);
        page.cleanup();
      }
      return parseMeasurementPdfPages(pages);
    };
    return await Promise.race([extraction(), new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new MeasurementImportError('PDF reading timed out. Try a smaller PDF or a CSV export.')), 45000);
    })]);
  } catch (error) {
    if (error instanceof MeasurementImportError) throw error;
    if (error.name === 'PasswordException') throw new MeasurementImportError('This PDF needs a password. Save an unlocked copy from your PDF viewer and try again.');
    throw new MeasurementImportError('The PDF could not be read. Try exporting a fresh PDF or measurement CSV.');
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}
