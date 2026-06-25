import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Report exporters. Each returns a Buffer + suggested filename + content type so
 * the controller can stream it as a download.
 */

/** Render a single AI interview report as a PDF buffer. */
export async function reportToPdf({ report, candidate, job }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Header
  doc.fontSize(22).fillColor('#6366f1').text('HireSense', { continued: true });
  doc.fillColor('#111').fontSize(14).text('  · Interview Report');
  doc.moveDown();

  doc.fillColor('#111').fontSize(16).text(candidate?.name || 'Candidate');
  doc.fontSize(10).fillColor('#666').text(`${candidate?.email || ''}`);
  if (job?.title) doc.text(`Role: ${job.title}`);
  doc.moveDown();

  // Overall + recommendation
  doc.fontSize(13).fillColor('#111').text(`Overall score: ${report.overallScore ?? '—'} / 100`);
  doc.text(`Recommendation: ${formatRec(report.recommendation)}`);
  if (report.integrityScore != null) doc.text(`Integrity score: ${report.integrityScore} / 100`);
  doc.moveDown();

  // Competency scores
  doc.fontSize(13).fillColor('#6366f1').text('Competency scores');
  doc.fontSize(10).fillColor('#111');
  for (const [k, v] of Object.entries(report.scores || {})) {
    if (v != null) doc.text(`• ${titleCase(k)}: ${v}/100`);
  }
  doc.moveDown();

  section(doc, 'Strengths', report.strengths);
  section(doc, 'Weaknesses', report.weaknesses);
  section(doc, 'Improvement areas', report.improvementAreas);

  if (report.detailedFeedback) {
    doc.fontSize(13).fillColor('#6366f1').text('Detailed feedback');
    doc.fontSize(10).fillColor('#111').text(report.detailedFeedback, { align: 'left' });
  }

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text(`Generated ${new Date().toLocaleString()} · HireSense AI`, { align: 'center' });

  doc.end();
  const buffer = await done;
  return {
    buffer,
    filename: `report-${slug(candidate?.name)}.pdf`,
    contentType: 'application/pdf',
  };
}

/** Render a candidate ranking (array of {candidate, report}) as an Excel buffer. */
export async function rankingToExcel({ rows, jobTitle }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'HireSense';
  const ws = wb.addWorksheet('Ranking');

  ws.columns = [
    { header: 'Rank', key: 'rank', width: 6 },
    { header: 'Candidate', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Overall', key: 'overall', width: 10 },
    { header: 'Technical', key: 'technical', width: 10 },
    { header: 'Communication', key: 'communication', width: 14 },
    { header: 'Problem Solving', key: 'problemSolving', width: 14 },
    { header: 'Recommendation', key: 'recommendation', width: 16 },
    { header: 'Integrity', key: 'integrity', width: 10 },
  ];
  ws.getRow(1).font = { bold: true };

  rows.forEach((r, i) => {
    const s = r.report?.scores || {};
    ws.addRow({
      rank: i + 1,
      name: r.candidate?.name,
      email: r.candidate?.email,
      overall: r.report?.overallScore,
      technical: s.technical,
      communication: s.communication,
      problemSolving: s.problemSolving,
      recommendation: formatRec(r.report?.recommendation),
      integrity: r.report?.integrityScore,
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(buffer),
    filename: `ranking-${slug(jobTitle) || 'all'}.xlsx`,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

/* ── helpers ───────────────────────────────────────────── */
function section(doc, title, items) {
  if (!items?.length) return;
  doc.fontSize(13).fillColor('#6366f1').text(title);
  doc.fontSize(10).fillColor('#111');
  items.forEach((i) => doc.text(`• ${i}`));
  doc.moveDown();
}
const formatRec = (r) => (r ? r.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
const titleCase = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default { reportToPdf, rankingToExcel };
