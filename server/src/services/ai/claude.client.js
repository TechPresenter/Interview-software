import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import { AiUsage } from '../../models/AiUsage.js';

/**
 * Thin, reliability-focused wrapper over the Anthropic SDK.
 *
 * Responsibilities:
 *  - lazy single client instance
 *  - retry with backoff on transient (429/5xx) errors
 *  - a `json()` helper that reliably extracts structured output
 *  - per-call usage + cost accounting persisted to AiUsage
 */

let client = null;
function getClient() {
  if (!config.ai.enabled) {
    throw ApiError.internal('AI is not configured (missing ANTHROPIC_API_KEY)');
  }
  if (!client) client = new Anthropic({ apiKey: config.ai.apiKey });
  return client;
}

// Approx USD per 1M tokens. Tune to current pricing; used for analytics only.
const PRICING = {
  'claude-opus-4-8': { in: 15, out: 75 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 0.8, out: 4 },
};

function estimateCost(model, usage) {
  const p = PRICING[model] || PRICING['claude-sonnet-4-6'];
  const input = (usage?.input_tokens || 0) / 1_000_000;
  const output = (usage?.output_tokens || 0) / 1_000_000;
  return Number((input * p.in + output * p.out).toFixed(6));
}

async function recordUsage({ feature, model, usage, latencyMs, success, company, interview }) {
  try {
    await AiUsage.create({
      company,
      interview,
      feature,
      model,
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
      totalTokens: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
      costUsd: estimateCost(model, usage),
      latencyMs,
      success,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to record AI usage');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Core completion call with retry. Returns the raw concatenated text plus usage.
 * @param {object} opts
 * @param {string} [opts.system]
 * @param {Array<{role:'user'|'assistant',content:string}>} opts.messages
 * @param {string} [opts.model]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @param {string} [opts.feature] usage bucket: interview|scoring|report|resume
 * @param {string} [opts.company] company id for accounting
 * @param {string} [opts.interview] interview id for accounting
 */
export async function complete({
  system,
  messages,
  model = config.ai.model,
  maxTokens = config.ai.maxTokens,
  temperature = 0.7,
  feature = 'other',
  company,
  interview,
}) {
  const c = getClient();
  const start = Date.now();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const resp = await c.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages,
      });
      const text = resp.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');
      await recordUsage({
        feature,
        model,
        usage: resp.usage,
        latencyMs: Date.now() - start,
        success: true,
        company,
        interview,
      });
      return { text, usage: resp.usage, raw: resp };
    } catch (err) {
      const status = err?.status;
      const retryable = status === 429 || (status >= 500 && status < 600);
      logger.warn({ err: err?.message, status, attempt }, 'Claude call failed');
      if (!retryable || attempt === maxAttempts) {
        await recordUsage({ feature, model, latencyMs: Date.now() - start, success: false, company, interview });
        throw ApiError.internal('AI service is temporarily unavailable');
      }
      await sleep(2 ** attempt * 500); // 1s, 2s backoff
    }
  }
  throw ApiError.internal('AI service failed');
}

/**
 * Completion that must return JSON. We instruct the model to emit only JSON and
 * defensively extract the first balanced object/array if it adds prose.
 */
export async function completeJson(opts) {
  const system = `${opts.system || ''}\n\nRespond with ONLY valid JSON. No markdown, no code fences, no commentary.`.trim();
  const { text, usage } = await complete({ ...opts, system, temperature: opts.temperature ?? 0.3 });
  return { data: extractJson(text), usage };
}

/** Best-effort JSON extraction from a model response. */
export function extractJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw ApiError.internal('AI returned malformed JSON');
  }
}

export default { complete, completeJson, extractJson };
