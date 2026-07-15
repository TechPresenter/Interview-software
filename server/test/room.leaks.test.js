import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(dir, p), 'utf8');

/**
 * What the interview room may say to the person being interviewed.
 *
 * The room is the one surface with no login: whoever holds the link is served.
 * That makes every field in its responses public, and three of them were things
 * the candidate must never see:
 *
 *  1. `expectedPoints` — the ideal-answer key that scoreAnswer() marks the reply
 *     against. It was returned with the question itself, so a candidate could
 *     read the mark scheme in the network tab before answering. Every score the
 *     product produced was worth nothing against anyone who looked.
 *  2. `rationale` — the interviewer's private note on why the question is asked.
 *  3. The proctoring dossier — the authoritative fraud score and the evidence[]
 *     snapshots taken of the candidate, handed back to the candidate.
 *
 * These assert the shape of the code that serialises the room, because standing
 * an interview up in a unit test needs a live DB and an AI provider. The live
 * end-to-end check is in the commit message.
 */

describe('interview room · the candidate never receives the mark scheme', () => {
  const src = read('../src/services/room.service.js');

  it('defines a publicQuestion allowlist', () => {
    expect(src).toMatch(/const publicQuestion = /);
  });

  it('the allowlist names only the three fields the client declares', () => {
    const body = src.match(/const publicQuestion = \(q\) =>\s*\n?\s*\(?q \? \{([^}]*)\}/)?.[1] ?? '';
    expect(body, 'publicQuestion body not found — did the shape change?').not.toBe('');
    const fields = [...body.matchAll(/(\w+):/g)].map((m) => m[1]).sort();
    // client/src/lib/room.api.ts RoomQuestion = { text, competencies?, isFollowUp? }
    expect(fields).toEqual(['competencies', 'isFollowUp', 'text']);
    expect(body).not.toMatch(/expectedPoints|rationale|answerKey|questionId/);
  });

  it('every question that crosses the wire goes through it', () => {
    // Every `question:` / `pendingQuestion:` property that is built into a
    // response must run through publicQuestion(). Two shapes are legitimately
    // NOT responses and are named explicitly rather than pattern-skipped:
    //   pending.text       → the prompt handed to the AI scorer
    //   pending.questionId → the id recorded on the transcript/answer row
    // Assignments into engineState (`= question`) aren't property literals and
    // never match; the scorer keeps the full object by design.
    const INTERNAL = ['pending.text', 'pending.questionId'];
    const leaks = [...src.matchAll(/^\s*(?:pendingQuestion|question): (.+?),?$/gm)]
      .map((m) => m[1].trim())
      .filter((v) => !INTERNAL.some((i) => v.startsWith(i)))
      .filter((v) => !v.includes('publicQuestion('));
    expect(
      leaks,
      `raw question object returned to the candidate — wrap it in publicQuestion(): ${leaks.join(' | ')}`,
    ).toEqual([]);
  });

  it('the engine still keeps the full object for scoring', () => {
    // The fix must not have stripped expectedPoints from the scorer's input —
    // that would silently gut answer grading instead of leaking it.
    expect(src).toMatch(/expectedPoints: pending\.expectedPoints/);
    expect(src).toMatch(/interview\.engineState\.pendingQuestion = /);
  });
});

describe('interview room · the candidate never receives their own dossier', () => {
  const src = read('../src/services/room.service.js');

  it('recordProctoring withholds the authoritative score', () => {
    const fn = src.match(/export async function recordProctoring[\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/return \{ recorded: true, terminated:/);
    // The score, risk band and integrity number are the calibration signal: post
    // an event, read the number, learn exactly what the detector reacts to.
    const returned = fn.match(/return \{[^}]*\}/g)?.join(' ') ?? '';
    expect(returned).not.toMatch(/fraudScore|riskLevel|integrityScore|flagged/);
  });

  it('recordDevice does not hand back interview.proctoring', () => {
    const fn = src.match(/export async function recordDevice[\s\S]*?\n\}/)?.[0] ?? '';
    expect(fn).not.toBe('');
    // setDeviceNetwork returns the whole subdocument: every violation event and
    // the evidence[] URLs of snapshots taken of this candidate.
    expect(fn).not.toMatch(/return proctor\.setDeviceNetwork/);
    expect(fn).toMatch(/return \{ recorded: true \}/);
  });

  it('the recruiter still gets the full score over the socket', () => {
    // Withholding it from the candidate must not have withheld it from the
    // people it is for.
    const proctoring = read('../src/services/proctoring.service.js');
    expect(proctoring).toMatch(/emitToCompany\([\s\S]*?fraudScore/);
  });
});

describe('interview room · uploads reject the token before buffering the body', () => {
  const routes = read('../src/routes/room.routes.js');

  it('resolves the token ahead of multer on both upload routes', () => {
    // multer buffers the entire body the moment it runs, and these two use
    // memoryStorage with 1 GB / 64 MB caps — so anyone could make the server
    // allocate a gigabyte by POSTing to a token that never existed.
    for (const route of ['/:token/recording', '/:token/recording-chunk']) {
      const line = routes.split('\n').find((l) => l.includes(`'${route}'`));
      expect(line, `${route} route missing`).toBeTruthy();
      const guardAt = line.indexOf('resolveRoomToken');
      const uploadAt = line.search(/upload(Media|RecordingChunk)/);
      expect(guardAt, `${route}: no resolveRoomToken`).toBeGreaterThan(-1);
      expect(uploadAt, `${route}: no multer`).toBeGreaterThan(-1);
      expect(guardAt, `${route}: multer runs before the token check`).toBeLessThan(uploadAt);
    }
  });
});

describe('tracking · click redirect is not an open redirect', () => {
  const src = read('../src/routes/tracking.routes.js');

  it('compares parsed origins rather than a string prefix', () => {
    expect(src).toMatch(/target\.origin === home\.origin/);
    // The old test — "starts with http" — is true of every URL on the internet.
    expect(src).not.toMatch(/res\.redirect\(\/\^https\?/);
  });

  it('falls back to the app for anything else', () => {
    expect(src).toMatch(/return config\.clientUrl;/);
  });
});
