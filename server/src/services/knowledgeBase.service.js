import { KnowledgeBase } from '../models/KnowledgeBase.js';
import { saveBuffer, extractText, ExtractionError, fetchUrlText } from './file.service.js';
import { logger } from '../config/logger.js';

/**
 * Knowledge base ingestion: turn uploaded files / URLs / pasted text into stored,
 * chunked, searchable content that grounds KB-driven interviews.
 */

const MAX_CHARS = 400_000; // cap stored content so a huge upload can't blow up docs

/** Split text into ~1200-char chunks on paragraph boundaries. */
export function chunkText(text, size = 1200) {
  const clean = (text || '').replace(/\r/g, '').trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + p).length > size && buf) {
      chunks.push(buf.trim());
      buf = '';
    }
    buf += `${p}\n\n`;
    while (buf.length > size) {
      chunks.push(buf.slice(0, size).trim());
      buf = buf.slice(size);
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

/**
 * Ingest a batch of sources into extracted-text segments.
 * @param {{ files?: Array<{buffer:Buffer,mimetype:string,originalname:string,size:number}>, urls?: string[], text?: string }} input
 * @returns {Promise<Array<{ source: object, text: string }>>}
 */
export async function ingestSources({ files = [], urls = [], text = '' } = {}) {
  const segments = [];

  for (const f of files) {
    // An unreadable file is recorded with its reason rather than dropped: a KB
    // that silently ingested nothing is exactly why question generation looked
    // broken — the source was listed, its text was empty, and nothing said so.
    let extracted = '';
    let error = null;
    try {
      extracted = await extractText(f.buffer, f.mimetype, f.originalname);
    } catch (err) {
      if (!(err instanceof ExtractionError)) throw err;
      error = err.message;
      logger.warn({ file: f.originalname, err: err.message }, 'Knowledge base source could not be read');
    }
    const stored = await saveBuffer(f.buffer, f.originalname);
    segments.push({
      source: { kind: 'file', label: f.originalname, url: stored.url, mime: f.mimetype, bytes: f.size, chars: extracted.length, error },
      text: extracted,
    });
  }

  for (const raw of urls) {
    const url = String(raw).trim();
    if (!url) continue;
    const extracted = await fetchUrlText(url);
    segments.push({ source: { kind: 'url', label: url, url, chars: extracted.length }, text: extracted });
  }

  if (text && text.trim()) {
    segments.push({ source: { kind: 'text', label: 'Pasted text', chars: text.trim().length }, text: text.trim() });
  }

  return segments;
}

/**
 * Build / rebuild a KB's stored content from a set of source segments. Pass
 * `append=true` to add to existing sources, otherwise sources are replaced.
 */
export async function applySources(kb, segments, { append = false } = {}) {
  const existingSources = append ? kb.sources || [] : [];
  const sources = [...existingSources, ...segments.map((s) => s.source)];

  // Reconstruct full content from the (kept) prior content + new segments.
  const priorContent = append ? (kb.content || '') : '';
  let content = [priorContent, ...segments.map((s) => `\n\n## ${s.source.label}\n${s.text}`)].join('').trim();
  if (content.length > MAX_CHARS) content = content.slice(0, MAX_CHARS);

  const chunks = chunkText(content).map((t) => ({ text: t, source: '' }));

  kb.sources = sources;
  kb.content = content;
  kb.chunks = chunks;
  kb.charCount = content.length;
  kb.tokensApprox = Math.round(content.length / 4);
  kb.lastIndexedAt = new Date();
  kb.topics = deriveTopics(content.replace(/^#+ .*$/gm, ' '));
  await kb.save();
  logger.info({ kb: kb._id, chars: content.length, sources: sources.length }, 'Knowledge base indexed');
  return kb;
}

/** Lightweight keyword/topic extraction (no AI needed) for the UI + grounding hint. */
export function deriveTopics(content, limit = 12) {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from', 'will', 'your', 'you', 'have', 'has', 'was', 'were', 'can', 'all', 'any', 'our', 'their', 'they', 'which', 'when', 'what', 'how', 'into', 'use', 'used', 'using', 'about', 'these', 'those', 'such', 'also', 'than', 'then', 'each']);
  const freq = new Map();
  for (const w of (content || '').toLowerCase().match(/[a-z][a-z+#.-]{3,}/g) || []) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
}

/**
 * Build a grounding context string for the interview/report prompts. Returns the
 * most relevant chunks for `query` (simple keyword overlap) up to maxChars, or the
 * start of the content when there's no query.
 */
export async function contextFor(kbId, { query = '', maxChars = 6000 } = {}) {
  const kb = await KnowledgeBase.findById(kbId).select('+content +chunks');
  if (!kb || kb.status !== 'active' || !kb.content) return null;
  const chunks = (kb.chunks || []).map((c) => c.text).filter(Boolean);
  if (!chunks.length) return { name: kb.name, topics: kb.topics, text: kb.content.slice(0, maxChars) };

  let selected = chunks;
  if (query) {
    const terms = query.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    selected = chunks
      .map((text) => ({ text, score: terms.reduce((s, t) => s + (text.toLowerCase().includes(t) ? 1 : 0), 0) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.text);
  }

  let out = '';
  for (const c of selected) {
    if (out.length + c.length > maxChars) break;
    out += `${c}\n\n`;
  }
  return { name: kb.name, topics: kb.topics, text: (out || kb.content.slice(0, maxChars)).trim() };
}

export default { ingestSources, applySources, contextFor, chunkText, deriveTopics };
