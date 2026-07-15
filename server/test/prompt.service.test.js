import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

/**
 * The prompt resolver sits on the interview hot path, so what is pinned here is
 * mostly what it must NOT do: throw, hit Mongo on every question, or serve a
 * stale body after an admin saves.
 */

// vi.mock is hoisted above module-level consts, so the stubs must be hoisted too
// — otherwise the real model binds and every lookup blocks on a DB connection.
const { findOneSpy, leanResult } = vi.hoisted(() => ({ findOneSpy: vi.fn(), leanResult: vi.fn() }));
vi.mock('../src/models/PromptTemplate.js', () => ({
  PromptTemplate: {
    findOne: (filter) => {
      findOneSpy(filter);
      return { lean: leanResult };
    },
  },
}));

const { renderPrompt, previewPrompt, invalidatePromptCache } = await import('../src/services/ai/prompt.service.js');
const { DEFAULT_PROMPTS, PROMPT_KEYS } = await import('../src/services/ai/prompts/defaults.js');
// Imported up here on purpose: compiling the real model once readyState is faked
// makes mongoose bind a collection against a connection that does not exist.
const { PROMPT_TEMPLATE_KEYS } = await vi.importActual('../src/models/PromptTemplate.js');

/** readyState is a prototype getter; shadow it to fake a connection. */
const setConnected = (connected) =>
  Object.defineProperty(mongoose.connection, 'readyState', { value: connected ? 1 : 0, configurable: true });

const GREETING_INPUT = {
  candidateName: 'Asha',
  jobTitle: 'Backend Engineer',
  interviewType: 'technical',
  durationMinutes: 30,
  questionCount: 8,
  language: 'en',
};

const dbRow = (over = {}) => ({
  key: 'greeting',
  system: 'Custom persona for {{interviewType}}.',
  template: 'Hi {{candidateName}}, ready for {{jobTitle}}?',
  ...over,
});

beforeEach(() => {
  invalidatePromptCache();
  findOneSpy.mockReset();
  leanResult.mockReset();
  setConnected(true);
});

describe('prompt.service · fallback to the built-in', () => {
  it('renders the built-in when no template is stored', async () => {
    leanResult.mockResolvedValue(null);
    const { system, messages } = await renderPrompt('greeting', GREETING_INPUT);
    expect(system).toContain('You are "Sense"');
    expect(messages[0].content).toContain('Greet Asha for the "Backend Engineer" technical interview');
  });

  it('never serves a disabled template — the lookup only asks for the active one', async () => {
    leanResult.mockResolvedValue(null);
    await renderPrompt('greeting', GREETING_INPUT);
    expect(findOneSpy).toHaveBeenCalledWith({ key: 'greeting', isActive: true });
  });

  it('treats a template with an empty body as absent rather than sending nothing', async () => {
    leanResult.mockResolvedValue(dbRow({ template: '   ' }));
    const { messages } = await renderPrompt('greeting', GREETING_INPUT);
    expect(messages[0].content).toContain('Greet Asha');
  });
});

describe('prompt.service · the stored template wins', () => {
  it('renders the stored body and interpolates the same vars', async () => {
    leanResult.mockResolvedValue(dbRow());
    const { system, messages } = await renderPrompt('greeting', GREETING_INPUT);
    expect(system).toBe('Custom persona for technical.');
    expect(messages[0].content).toBe('Hi Asha, ready for Backend Engineer?');
  });

  it('precomputes conditional blocks, so a stored body cannot lose the grounding rule', async () => {
    leanResult.mockResolvedValue(dbRow({ key: 'nextQuestion', template: 'Ask about {{jobTitle}}.{{knowledgeBlock}}' }));
    const { messages } = await renderPrompt('nextQuestion', {
      jobTitle: 'SRE', difficulty: 'hard', interviewType: 'technical', knowledge: 'Kubernetes internals.',
    });
    expect(messages[0].content).toContain('you MUST base your question ONLY on the following material');
    expect(messages[0].content).toContain('Kubernetes internals.');
  });

  it('keeps the truncation cap out of admin hands', async () => {
    leanResult.mockResolvedValue(dbRow({ key: 'analyzeResume', template: '{{resumeText}}' }));
    const { messages } = await renderPrompt('analyzeResume', { resumeText: 'x'.repeat(20000) });
    expect(messages[0].content).toHaveLength(14000);
  });
});

describe('prompt.service · preview', () => {
  it('reports placeholders that resolved to nothing', async () => {
    leanResult.mockResolvedValue(null);
    const { unfilled } = await previewPrompt('greeting', { candidateName: 'Asha', interviewType: 'technical' });
    expect(unfilled).toContain('jobTitle');
    expect(unfilled).toContain('durationMinutes');
    expect(unfilled).not.toContain('candidateName');
  });

  it('flags a placeholder the prompt does not define', async () => {
    leanResult.mockResolvedValue(null);
    const { unfilled } = await previewPrompt('greeting', GREETING_INPUT, { template: 'Hi {{candidateName}} {{jobTittle}}' });
    expect(unfilled).toContain('jobTittle');
    expect(unfilled).not.toContain('candidateName');
  });

  // A draft edits one field at a time. Treating it as all-or-nothing showed the
  // admin a prompt that would never be sent.
  it('layers a template-only draft over the live system prompt', async () => {
    leanResult.mockResolvedValue(null);
    const { system, messages, source } = await previewPrompt('greeting', GREETING_INPUT, { template: 'Draft {{candidateName}}' });
    expect(source).toBe('draft');
    expect(messages[0].content).toBe('Draft Asha');
    // Not blanked: this is the system prompt that would actually ship.
    expect(system).toBeTruthy();
    expect(system).toContain('Sense');
  });

  it('engages a system-only draft', async () => {
    leanResult.mockResolvedValue(null);
    const { system, messages, source } = await previewPrompt('greeting', GREETING_INPUT, { system: 'You are a pirate. Say arrr.' });
    expect(source).toBe('draft');
    expect(system).toBe('You are a pirate. Say arrr.');
    // The body is untouched by a system-only edit.
    expect(messages[0].content).toContain('Asha');
  });

  it('renders unsaved edits without touching what is live', async () => {
    leanResult.mockResolvedValue(dbRow());
    const { source, messages } = await previewPrompt('greeting', GREETING_INPUT, { system: 'S', template: 'Draft for {{candidateName}}' });
    expect(source).toBe('draft');
    expect(messages[0].content).toBe('Draft for Asha');
  });

  it('reports which body is live', async () => {
    leanResult.mockResolvedValue(null);
    expect((await previewPrompt('greeting', GREETING_INPUT)).source).toBe('default');
    invalidatePromptCache();
    leanResult.mockResolvedValue(dbRow());
    expect((await previewPrompt('greeting', GREETING_INPUT)).source).toBe('database');
  });
});

describe('prompt.service · caching', () => {
  it('does not hit Mongo on every question', async () => {
    leanResult.mockResolvedValue(dbRow());
    await renderPrompt('greeting', GREETING_INPUT);
    await renderPrompt('greeting', GREETING_INPUT);
    await renderPrompt('greeting', GREETING_INPUT);
    expect(findOneSpy).toHaveBeenCalledTimes(1);
  });

  it('caches the miss too, so an unseeded install does not query per question', async () => {
    leanResult.mockResolvedValue(null);
    await renderPrompt('greeting', GREETING_INPUT);
    await renderPrompt('greeting', GREETING_INPUT);
    expect(findOneSpy).toHaveBeenCalledTimes(1);
  });

  it('serves the new body on the next call after an invalidation — no restart', async () => {
    leanResult.mockResolvedValue(dbRow({ template: 'Old {{candidateName}}' }));
    const before = await renderPrompt('greeting', GREETING_INPUT);
    expect(before.messages[0].content).toBe('Old Asha');

    leanResult.mockResolvedValue(dbRow({ template: 'New {{candidateName}}' }));
    expect((await renderPrompt('greeting', GREETING_INPUT)).messages[0].content).toBe('Old Asha');

    invalidatePromptCache('greeting');
    expect((await renderPrompt('greeting', GREETING_INPUT)).messages[0].content).toBe('New Asha');
  });

  it('invalidates a single key without dropping the others', async () => {
    leanResult.mockResolvedValue(dbRow());
    await renderPrompt('greeting', GREETING_INPUT);
    invalidatePromptCache('scoreAnswer');
    await renderPrompt('greeting', GREETING_INPUT);
    expect(findOneSpy).toHaveBeenCalledTimes(1);
  });
});

describe('prompt.service · never breaks an interview', () => {
  it('falls back to the built-in when the lookup rejects', async () => {
    leanResult.mockRejectedValue(new Error('connection timed out'));
    const { messages } = await renderPrompt('greeting', GREETING_INPUT);
    expect(messages[0].content).toContain('Greet Asha');
  });

  it('does not cache a failure, so recovery is immediate', async () => {
    leanResult.mockRejectedValue(new Error('connection timed out'));
    await renderPrompt('greeting', GREETING_INPUT);
    leanResult.mockResolvedValue(dbRow());
    expect((await renderPrompt('greeting', GREETING_INPUT)).messages[0].content).toBe('Hi Asha, ready for Backend Engineer?');
  });

  it('skips the query entirely while Mongo is disconnected rather than waiting on the buffer timeout', async () => {
    setConnected(false);
    const { messages } = await renderPrompt('greeting', GREETING_INPUT);
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(messages[0].content).toContain('Greet Asha');
  });

  it('renders every key from its built-in with no stored templates', async () => {
    leanResult.mockResolvedValue(null);
    for (const key of PROMPT_KEYS) {
      const { messages } = await renderPrompt(key, {});
      expect(messages[0].content.length).toBeGreaterThan(0);
    }
  });

  it('throws on an unknown key — a coding error with no default to fall back to', async () => {
    await expect(renderPrompt('nope', {})).rejects.toThrow(/Unknown prompt key/);
  });
});

describe('prompt.service · metadata', () => {
  it('keeps the model enum in lockstep with the built-ins', () => {
    expect(PROMPT_TEMPLATE_KEYS).toEqual(PROMPT_KEYS);
  });

  it('documents every placeholder its template uses', () => {
    for (const key of PROMPT_KEYS) {
      const def = DEFAULT_PROMPTS[key];
      const declared = new Set(def.variables.map((v) => v.name));
      const used = [...`${def.system}${def.template}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]);
      for (const name of used) expect(declared, `${key} must document {{${name}}}`).toContain(name);
    }
  });
});
