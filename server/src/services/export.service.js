import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

/**
 * Report exporters. Each returns a Buffer + suggested filename + content type so
 * the controller can stream it as a download.
 */

/** Render a single AI interview report as a PDF buffer. */
export async function reportToPdf({ report, candidate, job, branding, proctoring }) {
  const name = branding?.platformName || 'AIPL Hire';
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Header
  doc.fontSize(22).fillColor('#6366f1').text(name, { continued: true });
  doc.fillColor('#111').fontSize(14).text('  · Interview Report');
  doc.moveDown();

  doc.fillColor('#111').fontSize(16).text(candidate?.name || 'Candidate');
  doc.fontSize(10).fillColor('#666').text(`${candidate?.email || ''}`);
  if (job?.title) doc.text(`Role: ${job.title}`);
  if (report.createdAt) doc.text(`Date: ${new Date(report.createdAt).toLocaleDateString()}`);
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
    doc.moveDown();
  }

  // Proctoring & integrity summary (§16)
  if (proctoring) {
    doc.fontSize(13).fillColor('#6366f1').text('Proctoring & integrity');
    doc.fontSize(10).fillColor('#111');
    if (proctoring.fraudScore != null) doc.text(`• Fraud score: ${proctoring.fraudScore}/100 (${proctoring.riskLevel || 'safe'} risk)`);
    if (proctoring.integrityScore != null) doc.text(`• Integrity score: ${proctoring.integrityScore}/100`);
    if (proctoring.attentionScore != null) doc.text(`• Attention score: ${proctoring.attentionScore}/100`);
    if (proctoring.eyeContactPct != null) doc.text(`• Eye contact: ${proctoring.eyeContactPct}%`);
    if (Array.isArray(proctoring.events)) doc.text(`• Anti-cheat events logged: ${proctoring.events.length}`);
    doc.moveDown();
  }

  doc.moveDown(1);
  doc.fontSize(8).fillColor('#999').text(`Generated ${new Date().toLocaleString()} · ${name} AI`, { align: 'center' });

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

/** Render a payment/invoice as a branded PDF buffer. */
export async function invoiceToPdf({ payment, company, branding }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const name = branding?.platformName || 'HireSense';
  const amount = ((payment.amount || 0) / 100).toFixed(2);
  const cur = payment.currency || 'USD';

  doc.fontSize(22).fillColor('#6366f1').text(name);
  doc.fontSize(10).fillColor('#666').text('Invoice / Payment Receipt');
  doc.moveDown();

  doc.fillColor('#111').fontSize(12).text(`Invoice #: ${payment.invoiceNumber || payment._id}`);
  doc.fontSize(10).fillColor('#666').text(`Date: ${new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}`);
  doc.text(`Status: ${formatRec(payment.status)}`);
  doc.text(`Payment method: ${formatRec(payment.provider)}`);
  doc.moveDown();

  doc.fontSize(11).fillColor('#111').text('Billed to:');
  doc.fontSize(10).fillColor('#666').text(company?.name || '—');
  const billEmail = company?.billingEmail || company?.contactEmail;
  if (billEmail) doc.text(billEmail);
  doc.moveDown();

  doc.fontSize(12).fillColor('#6366f1').text('Description');
  doc.fontSize(10).fillColor('#111').text(`${payment.description || 'Subscription'}`);
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#111').text(`Total: ${cur} ${amount}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text(`${name} · Generated ${new Date().toLocaleString()}`, { align: 'center' });

  doc.end();
  const buffer = await done;
  return { buffer, filename: `invoice-${payment.invoiceNumber || payment._id}.pdf`, contentType: 'application/pdf' };
}

/** Build an analytics report as CSV / Excel / PDF. */
export async function buildAnalyticsExport(format, { business: b, traffic: t, funnel, range }) {
  const stamp = new Date().toISOString().slice(0, 10);
  const rows = [
    ['Metric', 'Value'],
    ['Date range', `${range.since.toISOString().slice(0, 10)} to ${range.until.toISOString().slice(0, 10)}`],
    ['Total users', b.users.total],
    ['New users', b.users.new],
    ['Active users (DAU)', b.users.dau],
    ['Active users (WAU)', b.users.wau],
    ['Active users (MAU)', b.users.mau],
    ['Paid subscribers', b.subscriptions.paid],
    ['Trials', b.subscriptions.trialing],
    ['MRR', b.revenue.mrr],
    ['ARR', b.revenue.arr],
    ['Churn rate %', b.revenue.churnRate],
    ['AI tokens', b.ai.tokens],
    ['AI cost (USD)', Number(b.ai.cost || 0).toFixed(2)],
    ['Emails sent', b.email.sent],
    ['Email open rate %', b.email.openRate],
    ['Notifications', b.notifications],
    ['Contact enquiries', b.enquiries],
    ['Newsletter signups', b.newsletter],
    ['Demo bookings', b.demos],
    ['Blog views', b.blog.views],
    ['Page views', t.pageviews],
    ['Sessions', t.sessions],
    ['Unique visitors', t.visitors],
    ['Bounce rate %', t.bounceRate],
    ['Avg session (s)', t.avgSessionSeconds],
    ...(funnel || []).map((f) => [`Funnel: ${f.label}`, f.value]),
  ];

  if (format === 'csv') {
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    return { buffer: Buffer.from(csv, 'utf8'), filename: `analytics-${stamp}.csv`, contentType: 'text/csv; charset=utf-8' };
  }

  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'HireSense';
    const ws = wb.addWorksheet('Analytics');
    ws.columns = [{ header: 'Metric', key: 'm', width: 30 }, { header: 'Value', key: 'v', width: 26 }];
    ws.getRow(1).font = { bold: true };
    rows.slice(1).forEach((r) => ws.addRow({ m: r[0], v: r[1] }));
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, filename: `analytics-${stamp}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  // PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  doc.fontSize(20).fillColor('#6366f1').text('Analytics Report');
  doc.fontSize(10).fillColor('#666').text(`${range.since.toDateString()} — ${range.until.toDateString()}`);
  doc.moveDown();
  doc.fillColor('#111').fontSize(11);
  rows.slice(2).forEach((r) => doc.text(`${r[0]}: ${r[1]}`));
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999').text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
  doc.end();
  const buffer = await done;
  return { buffer, filename: `analytics-${stamp}.pdf`, contentType: 'application/pdf' };
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
