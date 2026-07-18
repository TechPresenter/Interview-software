import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { config } from '../config/index.js';
import { billingIdentity } from './billingConfig.service.js';
import { loadLogo } from './application.pdf.js';

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

/* ── invoice ───────────────────────────────────────────── */

/** Status pill tones — tinted background + readable ink, per payment.status. */
const PILL_TONES = {
  paid: { fg: '#15803d', bg: '#dcfce7' },
  refunded: { fg: '#b45309', bg: '#fef3c7' },
  failed: { fg: '#b91c1c', bg: '#fee2e2' },
};
const PILL_DEFAULT = { fg: '#666', bg: '#f3f4f6' };

/** en-IN short date ("18 Jul 2026"), '' when absent. */
const invDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** "18 Jul 2026 – 18 Aug 2026", or '' when the payment has no billing cycle. */
function billingPeriod(payment) {
  if (!payment.billingCycle) return '';
  const start = new Date(payment.paidAt || payment.createdAt || Date.now());
  if (Number.isNaN(start.getTime())) return '';
  const end = new Date(start);
  if (payment.billingCycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return `${invDate(start)} – ${invDate(end)}`;
}

/**
 * Render a payment as a professional A4 GST invoice PDF buffer.
 *
 * Seller identity comes from the admin-editable billingIdentity(); tax figures
 * prefer the payment.tax snapshot frozen at payment time (see Payment model) so
 * a later rate change never rewrites a historical invoice. Amounts print with
 * the currency CODE, never the ₹ glyph — Helvetica cannot encode it.
 */
export async function invoiceToPdf({ payment, company, branding }) {
  // Identity + logo are best-effort: a Settings blip or a dead CDN must not
  // turn an invoice download (or the receipt email that attaches it) into a 500.
  let identity;
  try {
    identity = await billingIdentity();
  } catch {
    identity = {
      legalName: '', address: '', gstin: config.billing.gstin,
      gstPercent: config.billing.gstin ? config.billing.gstPercent : 0,
      phone: '', email: '', website: '', terms: '',
    };
  }
  const logo = await loadLogo(branding);

  const sellerName = identity.legalName || branding?.platformName || 'AIPL Hire';
  const sellerGstin = payment.tax?.gstin || identity.gstin || '';
  const title = sellerGstin ? 'TAX INVOICE' : 'INVOICE';

  const cur = (payment.currency || config.billing.currency || 'INR').toUpperCase();
  const money = (n) => `${cur} ${n.toFixed(2)}`;
  const total = (payment.amount || 0) / 100;

  // Totals: the frozen snapshot when we have one; the legacy live-config
  // derivation for rows minted before the snapshot existed; plain total if no GST.
  let subtotal = null;
  let gstAmt = null;
  let gstPct = 0;
  if (payment.tax && payment.tax.percent > 0) {
    gstPct = payment.tax.percent;
    subtotal = (payment.tax.taxable || 0) / 100;
    gstAmt = (payment.tax.tax || 0) / 100;
  } else if (config.billing.gstin && config.billing.gstPercent > 0) {
    gstPct = config.billing.gstPercent;
    subtotal = total / (1 + gstPct / 100);
    gstAmt = total - subtotal;
  }

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, left: 50, right: 50, bottom: 64 }, // footer draws inside the bottom margin
    bufferPages: true, // page count for the footer is only known at the end
    info: { Title: `Invoice ${payment.invoiceNumber || payment._id || ''}`.trim(), Author: sellerName, Subject: 'Payment invoice' },
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const M = 50;
  const W = doc.page.width - M * 2;
  const R = M + W;
  const rule = (y, color = '#e5e7eb', width = 0.5) =>
    doc.moveTo(M, y).lineTo(R, y).lineWidth(width).strokeColor(color).stroke();

  /* header — logo + seller block left, title + status pill right */
  let leftY = M;
  if (logo) {
    try {
      doc.image(logo, M, M, { fit: [110, 38], align: 'left', valign: 'top' });
      leftY = M + 46;
    } catch {
      // passed the magic-byte check but would not embed (truncated upload) —
      // the seller wordmark below still identifies the document.
    }
  }
  doc.font('Helvetica-Bold').fontSize(logo ? 11 : 15).fillColor('#111').text(sellerName, M, leftY, { width: 280 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#666');
  if (identity.address) doc.text(identity.address, { width: 280 });
  if (sellerGstin) doc.text(`GSTIN: ${sellerGstin}`, { width: 280 });
  const contact = [identity.phone, identity.email].filter(Boolean).join('  ·  ');
  if (contact) doc.text(contact, { width: 280 });
  if (identity.website) doc.text(identity.website, { width: 280 });
  leftY = doc.y;

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#111').text(title, M + 280, M, { width: W - 280, align: 'right' });
  const tone = PILL_TONES[payment.status] || PILL_DEFAULT;
  const pillLabel = String(payment.status || 'created').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(8);
  const pillW = doc.widthOfString(pillLabel) + 16;
  const pillY = doc.y + 6;
  doc.roundedRect(R - pillW, pillY, pillW, 16, 8).fillColor(tone.bg).fill();
  doc.fillColor(tone.fg).text(pillLabel, R - pillW, pillY + 4.5, { width: pillW, align: 'center', lineBreak: false });

  doc.y = Math.max(leftY, pillY + 16) + 16;
  rule(doc.y, '#6366f1', 1);
  doc.y += 18;

  /* billed-to (left) + invoice meta (right) */
  const metaTop = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666').text('BILLED TO', M, metaTop);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(company?.name || '—', M, doc.y + 3, { width: 250 });
  const billEmail = company?.billingEmail || company?.contactEmail;
  if (billEmail) doc.font('Helvetica').fontSize(9).fillColor('#666').text(billEmail, { width: 250 });
  const billedEnd = doc.y;

  const methodRaw = payment.method || payment.provider;
  const methodLabel = methodRaw && methodRaw.toLowerCase() === 'upi' ? 'UPI' : formatRec(methodRaw);
  const meta = [
    ['Invoice #', String(payment.invoiceNumber || payment._id || '—')],
    ['Invoice date', invDate(payment.paidAt || payment.createdAt) || '—'],
    ['Payment method', methodLabel],
    ['Transaction ID', payment.providerPaymentId || ''],
    ['Order ID', payment.providerOrderId || ''],
  ].filter(([, v]) => v);
  const metaX = M + 265;
  const metaW = W - 265;
  let y = metaTop;
  for (const [label, value] of meta) {
    doc.font('Helvetica').fontSize(8.5).fillColor('#666').text(label, metaX, y, { width: 90, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor('#111').text(value, metaX + 90, y, { width: metaW - 90, align: 'right' });
    y = Math.max(doc.y, y + 12) + 2;
  }
  doc.y = Math.max(billedEnd, y) + 22;

  /* line-item table — description | billing period | amount */
  const period = billingPeriod(payment);
  const amountW = 105;
  const periodW = period ? 150 : 0;
  const descW = W - amountW - periodW;

  const th = doc.y;
  doc.rect(M, th, W, 20).fillColor('#f3f4f6').fill();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#666');
  doc.text('DESCRIPTION', M + 10, th + 6, { width: descW - 20, lineBreak: false });
  if (period) doc.text('BILLING PERIOD', M + descW, th + 6, { width: periodW, lineBreak: false });
  doc.text('AMOUNT', M + descW + periodW, th + 6, { width: amountW - 10, align: 'right', lineBreak: false });

  const rowY = th + 27;
  doc.font('Helvetica').fontSize(10).fillColor('#111').text(payment.description || 'Subscription', M + 10, rowY, { width: descW - 20 });
  if (payment.coupon?.code) {
    const off = payment.coupon.discount > 0 ? ` — ${money(payment.coupon.discount / 100)} off` : ' applied';
    doc.font('Helvetica').fontSize(8).fillColor('#666').text(`Coupon ${payment.coupon.code}${off}`, { width: descW - 20 });
  }
  const descEnd = doc.y;
  if (period) doc.font('Helvetica').fontSize(9).fillColor('#666').text(period, M + descW, rowY + 1, { width: periodW });
  doc.font('Helvetica').fontSize(10).fillColor('#111').text(money(total), M + descW + periodW, rowY, { width: amountW - 10, align: 'right' });
  doc.y = Math.max(descEnd, doc.y) + 8;
  rule(doc.y);
  doc.y += 14;

  /* totals — right-aligned block; prices are GST-inclusive so subtotal + GST = total */
  const totX = R - 240;
  const totRow = (label, value, opts = {}) => {
    const ty = doc.y;
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9.5);
    doc.fillColor('#666').text(label, totX, ty, { width: 130, lineBreak: false });
    doc.fillColor('#111').text(value, totX + 130, ty, { width: 110, align: 'right', lineBreak: false });
    doc.y = ty + (opts.size || 9.5) + 7;
  };
  if (gstPct > 0) {
    totRow('Subtotal', money(subtotal));
    totRow(`GST @ ${gstPct}%`, money(gstAmt));
    if (sellerGstin) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#999').text(`Seller GSTIN: ${sellerGstin}`, totX, doc.y, { width: 240, align: 'right', lineBreak: false });
      doc.y += 12;
    }
    doc.moveTo(totX, doc.y).lineTo(R, doc.y).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.y += 7;
    totRow('Total (incl. GST)', money(total), { bold: true, size: 12 });
  } else {
    totRow('Total', money(total), { bold: true, size: 12 });
  }

  /* terms & conditions */
  if (identity.terms) {
    doc.y += 16;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#666').text('TERMS & CONDITIONS', M, doc.y);
    doc.y += 4;
    doc.font('Helvetica').fontSize(8).fillColor('#666').text(identity.terms, M, doc.y, { width: W, lineGap: 2 });
  }

  /* footer — stamped on every buffered page, drawn into the bottom margin */
  const footLine = [sellerName, identity.website, 'This is a computer-generated invoice.'].filter(Boolean).join('  ·  ');
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // text below the margin would trigger auto-paginate
    let fy = doc.page.height - saved + 14;
    rule(fy);
    fy += 6;
    doc.font('Helvetica').fontSize(7.5).fillColor('#999').text(footLine, M, fy, { width: W, align: 'center', lineBreak: false });
    if (range.count > 1) {
      doc.font('Helvetica').fontSize(7).fillColor('#999').text(`Page ${i - range.start + 1} of ${range.count}`, M, fy + 11, { width: W, align: 'center', lineBreak: false });
    }
    doc.page.margins.bottom = saved;
  }
  doc.flushPages();

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
    ['MRR', Math.round((b.revenue.mrr || 0) / 100)],
    ['ARR', Math.round((b.revenue.arr || 0) / 100)],
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
