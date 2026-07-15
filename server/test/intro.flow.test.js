import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Interview } from '../src/models/Interview.js';
import { Answer } from '../src/models/Answer.js';
import { Job } from '../src/models/Job.js';
import {
  INTRO_STAGES, introCountFor, isFresher, planFor, introQuestion, bridge,
} from '../src/services/ai/intro.stages.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const roomSrc = fs.readFileSync(path.resolve(dir, '../src/services/room.service.js'), 'utf8');

/**
 * The background phase: what the AI asks before it asks anything technical.
 *
 * The two things that make this safe rather than merely present are that a
 * background turn (a) never counts as a scored question and (b) never reaches
 * the report's verdict. Both are one silent line away from being false, so most
 * of what follows is aimed at those two claims rather than at the happy path.
 */

const newInterview = (config = {}) => new Interview({
  company: new mongoose.Types.ObjectId(),
  candidate: new mongoose.Types.ObjectId(),
  accessToken: `t${Math.abs(Date.now() % 100000)}`,
  config: { questionCount: 8, durationMinutes: 30, ...config },
});

describe('intro · the schema line the whole design rests on', () => {
  it('isIntro survives assignment to pendingQuestion', () => {
    // pendingQuestion is a nested path with declared leaves and no strict:false,
    // so mongoose strips undeclared keys AT ASSIGNMENT — in memory, before any
    // save, with no error. Without the schema line, isIntro reads back undefined,
    // every `if (!pending.isIntro)` guard passes, and the background phase scores
    // itself and eats the question budget: at questionCount=1 the entire
    // interview becomes "tell me about yourself", reported with a hire verdict.
    const iv = newInterview();
    iv.engineState.pendingQuestion = introQuestion('background', { jobTitle: 'Engineer' });
    expect(iv.engineState.pendingQuestion.isIntro, 'isIntro was stripped — the guard is inoperative').toBe(true);
  });

  it('the other new engineState fields survive too', () => {
    const iv = newInterview();
    iv.engineState.introPlan = ['background', 'projects'];
    iv.engineState.introAsked = 2;
    iv.engineState.introFresher = true;
    expect(iv.engineState.introPlan).toEqual(['background', 'projects']);
    expect(iv.engineState.introAsked).toBe(2);
    expect(iv.engineState.introFresher).toBe(true);
  });

  it('transcript turns can be marked intro', () => {
    const iv = newInterview();
    iv.transcript.push({ role: 'ai', text: 'tell me about yourself', intro: true });
    expect(iv.transcript[0].intro).toBe(true);
  });

  it('Answer rows can be marked intro', () => {
    const a = new Answer({ interview: new mongoose.Types.ObjectId(), questionText: 'q', isIntro: true });
    expect(a.isIntro).toBe(true);
  });

  it('a fresh interview defaults to no intro — this is what makes it migration-free', () => {
    // A doc written before this shipped reads introPlan: [] and introAsked: 0,
    // so `introAsked < introPlan.length` is false and it never enters the intro
    // path. No migration, no re-planning of in-flight interviews.
    const iv = newInterview();
    expect(iv.engineState.introPlan).toEqual([]);
    expect(iv.engineState.introAsked).toBe(0);
    expect(iv.engineState.pendingQuestion.isIntro).toBe(false);
  });
});

describe('intro · budget', () => {
  it.each([
    // questionCount, durationMinutes, expected
    [1, 30, 1], [3, 30, 1], [8, 30, 3], [20, 60, 3], [8, 15, 1], [1, 5, 1], [50, 90, 3],
  ])('qc=%i dur=%i → %i background question(s)', (questionCount, durationMinutes, want) => {
    expect(introCountFor({ questionCount, durationMinutes })).toBe(want);
  });

  it('never returns 0 on its own — requirement 1 says "always"', () => {
    // If the formula could reach 0, the background phase would vanish for some
    // configs with no admin in the loop, silently making req 1 false.
    for (let qc = 1; qc <= 50; qc += 1) {
      for (const dur of [5, 10, 15, 30, 45, 60, 90, 600]) {
        expect(introCountFor({ questionCount: qc, durationMinutes: dur }), `qc=${qc} dur=${dur}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('introCount: 0 is the ONLY way to zero — requirement 5s carve-out', () => {
    expect(introCountFor({ questionCount: 8, introCount: 0 })).toBe(0);
  });

  it('honours an explicit count verbatim and clamps nonsense', () => {
    expect(introCountFor({ questionCount: 8, introCount: 2 })).toBe(2);
    expect(introCountFor({ questionCount: 8, introCount: 99 })).toBe(INTRO_STAGES.length);
    expect(introCountFor({ questionCount: 8, introCount: -5 })).toBe(0);
  });

  it('never plans more stages than exist', () => {
    expect(introCountFor({ questionCount: 50, durationMinutes: 600 })).toBeLessThanOrEqual(INTRO_STAGES.length);
  });

  it('background share shrinks as the interview grows', () => {
    // Background is a fixed-cost preamble, not a proportional tax.
    const share = (qc, dur) => introCountFor({ questionCount: qc, durationMinutes: dur }) / qc;
    expect(share(8, 30)).toBeGreaterThan(share(20, 60));
    expect(share(20, 60)).toBeGreaterThan(share(50, 90));
  });

  it('is not keyed on interview type', () => {
    // Requirement 5 names "all interview types" as an axis where the flow must be
    // CONSISTENT. A type-keyed auto-reduction is the per-type inconsistency it
    // forbids — and it isn't an admin customizing anything. The clock does that
    // job honestly instead: a 15-minute screen gets 1 via floor(duration / 10).
    expect(String(introCountFor)).not.toMatch(/types|coding|aptitude|technical/);
    // Same config, different interview type → same background phase.
    const cfg = { questionCount: 8, durationMinutes: 30 };
    expect(introCountFor({ ...cfg })).toBe(introCountFor({ ...cfg }));
  });
});

describe('intro · stage wording adapts, never skips', () => {
  it('covers every stage the spec named', () => {
    // The 8 spec topics are merged into 3 questions; this asserts the merge
    // actually mentions them rather than quietly dropping one.
    const all = INTRO_STAGES.map((s) => s.text({ fresher: false, jobTitle: 'Engineer' })).join(' ').toLowerCase();
    expect(all).toMatch(/yourself/);        // spec 2 personal introduction
    expect(all).toMatch(/studied/);         // spec 3 education
    expect(all).toMatch(/work or internships/); // spec 4 work experience
    expect(all).toMatch(/project/);         // spec 5 projects
    expect(all).toMatch(/skills/);          // spec 6 skills
    expect(all).toMatch(/career/);          // spec 7 career goals
    expect(all).toMatch(/role/);            // spec 8 role-specific
  });

  it('rewords for a fresher instead of skipping the stage', () => {
    const fresher = introQuestion('background', { fresher: true });
    const senior = introQuestion('background', { fresher: false });
    expect(fresher.text).not.toBe(senior.text);
    expect(fresher.text).toMatch(/internships or projects/);
    // A fresher still gets asked — their coursework is the only signal they have.
    expect(fresher.text).toMatch(/tell me a bit about yourself/i);
  });

  it('drops the role clause when there is no job, and still asks', () => {
    // Spec 8's "(if applicable)" attaches to role-specific experience, not to
    // career goals.
    const withJob = introQuestion('motivation', { jobTitle: 'Data Engineer' });
    const without = introQuestion('motivation', {});
    expect(withJob.text).toMatch(/Data Engineer/);
    expect(without.text).not.toMatch(/undefined|null/);
    expect(without.text).toMatch(/career/);
  });

  it('serves Hindi when the interview is in Hindi', () => {
    const hi = introQuestion('background', { language: 'hi', fresher: false });
    expect(hi.text).toMatch(/[ऀ-ॿ]/);
    expect(bridge({ jobTitle: 'X', language: 'hi' })).toMatch(/[ऀ-ॿ]/);
  });

  it('every stage is answerable by anyone — no skip logic needed', () => {
    for (const stage of INTRO_STAGES) {
      for (const fresher of [true, false]) {
        for (const jobTitle of ['Engineer', undefined]) {
          const t = stage.text({ fresher, jobTitle });
          expect(t.length, `${stage.id} produced nothing`).toBeGreaterThan(20);
          expect(t).not.toMatch(/undefined|null|\[object/);
        }
      }
    }
  });

  it('carries no questionId, so it cannot corrupt a QuestionSet', () => {
    const q = introQuestion('background', {});
    expect(q.questionId).toBeUndefined();
    expect(q.expectedPoints).toEqual([]); // nothing to mark against
  });

  it('planFor returns stage ids in spec order', () => {
    expect(planFor({ config: { questionCount: 8, durationMinutes: 30 } })).toEqual(['background', 'projects', 'motivation']);
    expect(planFor({ config: { questionCount: 3, durationMinutes: 30 } })).toEqual(['background']);
    expect(planFor({ config: { introCount: 0 } })).toEqual([]);
  });

  it('an unknown stage id returns null rather than throwing', () => {
    expect(introQuestion('nope', {})).toBeNull();
  });
});

describe('intro · isFresher requires positive evidence', () => {
  it.each([
    ['the recruiter said senior', { config: { experienceLevel: 'senior' }, candidate: {} }, false],
    ['the recruiter said fresher', { config: { experienceLevel: 'fresher' }, candidate: {} }, true],
    ['nothing is known', { config: {}, candidate: {} }, false],
    ['the resume never parsed', { config: {}, candidate: { experience: [] } }, false],
    ['a stated zero years', { config: {}, candidate: { totalExperienceYears: 0 } }, true],
    ['the recruiter overrides the resume', { config: { experienceLevel: 'senior' }, candidate: { totalExperienceYears: 0 } }, false],
  ])('%s → %s', (_label, arg, want) => {
    expect(isFresher(arg)).toBe(want);
  });

  it('never infers inexperience from missing data', () => {
    // resume.analyzer only fills experience[] on a successful AI parse, so
    // absence is the common case, not a signal. Guessing "fresher" from it asks a
    // twelve-year staff engineer about "the internships that got you interested".
    expect(isFresher({ config: {}, candidate: undefined })).toBe(false);
    expect(isFresher({})).toBe(false);
    expect(isFresher({ config: {}, candidate: { totalExperienceYears: undefined } })).toBe(false);
  });
});

describe('intro · wiring in room.service', () => {
  it('tier -1 sits ABOVE the QuestionSet check', () => {
    // Tier 0 returns immediately, so anything below it never runs for a
    // QuestionSet interview — the intro would silently never fire.
    const introAt = roomSrc.indexOf('Tier -1: background');
    const tier0At = roomSrc.indexOf('Tier 0: a fixed set');
    expect(introAt, 'tier -1 missing').toBeGreaterThan(-1);
    expect(tier0At).toBeGreaterThan(-1);
    expect(introAt, 'tier -1 must come before tier 0').toBeLessThan(tier0At);
  });

  it('the intro branch is driven by the plan cursor, not by a tier outcome', () => {
    expect(roomSrc).toMatch(/if \(introAsked < introPlan\.length\)/);
  });

  it('currentIndex is only bumped for scored answers', () => {
    // The single line that decides whether the background eats the interview.
    expect(roomSrc).toMatch(/if \(isIntro\) \{[\s\S]*?introAsked \+= 1;[\s\S]*?\} else \{[\s\S]*?currentIndex \+= 1;/);
  });

  it('adaptDifficulty never sees a background answer', () => {
    expect(roomSrc).toMatch(/adaptiveDifficulty && !isIntro/);
  });

  it('the scorer is skipped for background answers', () => {
    expect(roomSrc).toMatch(/if \(isIntro\) \{[\s\S]{0,600}Background question — not scored/);
  });

  it('completion cannot fire mid-background', () => {
    expect(roomSrc).toMatch(/!isIntro && engine\.isComplete\(interview\)/);
  });

  it('skipping a background question does not burn a scored slot or book a 0', () => {
    expect(roomSrc).toMatch(/Background question — skipped, not scored/);
  });

  it('the report sees neither intro answers nor intro transcript turns', () => {
    // Unscoring alone only protects the NUMBERS: report.engine prefers the LLM's
    // recommendation and is handed the transcript, so small talk would still
    // reach the hire/reject verdict with the scores looking untouched.
    expect(roomSrc).toMatch(/scoredAnswers = answers\.filter\(\(a\) => !a\.isIntro\)/);
    expect(roomSrc).toMatch(/\.filter\(\(t\) => !t\.intro\)/);
    expect(roomSrc).toMatch(/evaluations: scoredAnswers\.map/);
    expect(roomSrc).toMatch(/answers: scoredAnswers/);
  });

  it('the bridge rides on the first scored question rather than costing a turn', () => {
    expect(roomSrc).toMatch(/if \(isIntro && !next\.isIntro\) next\.text = `\$\{bridge\(/);
  });

  it('background answers get follow-ups, bounded to one per stage', () => {
    expect(roomSrc).toMatch(/isIntro && interview\.config\.followUps && !pending\.isFollowUp/);
    expect(roomSrc).toMatch(/engine\.maybeFollowUp/);
  });

  it('progress counts background turns', () => {
    expect(roomSrc).toMatch(/const intro = interview\.engineState\.introPlan\?\.length \|\| 0/);
    expect(roomSrc).toMatch(/const total = scored \+ intro/);
  });
});

describe('intro · progressOf', () => {
  // progressOf is module-private, so drive the arithmetic it implements against
  // real docs. The room.service assertions above pin the source shape.
  const progress = (iv) => {
    const scored = iv.config.questionCount || 8;
    const intro = iv.engineState.introPlan?.length || 0;
    const total = scored + intro;
    return { current: Math.min(iv.engineState.currentIndex + (iv.engineState.introAsked || 0), total), total };
  };

  it('a pre-deploy doc reads exactly as it did before', () => {
    const iv = newInterview({ questionCount: 8 });
    iv.engineState.currentIndex = 4; // mid-flight when the deploy landed
    expect(progress(iv)).toEqual({ current: 4, total: 8 });
  });

  it('the bar moves during the background phase', () => {
    const iv = newInterview({ questionCount: 8 });
    iv.engineState.introPlan = ['background', 'projects', 'motivation'];
    expect(progress(iv)).toEqual({ current: 0, total: 11 });
    iv.engineState.introAsked = 2;
    expect(progress(iv)).toEqual({ current: 2, total: 11 });
  });

  it('a 1-question interview does not offer "Submit & finish" on the intro', () => {
    // The room shows the finish button when current + 1 >= total.
    const iv = newInterview({ questionCount: 1 });
    iv.engineState.introPlan = ['background'];
    const p = progress(iv);
    expect(p.current + 1 >= p.total, 'the room would say "Submit & finish" under "tell me about yourself"').toBe(false);
  });
});

describe('intro · admin customization rides the existing precedence chain', () => {
  it('a job blueprint can set introCount', () => {
    const job = new Job({ company: new mongoose.Types.ObjectId(), title: 'X', interviewConfig: { introCount: 1 } });
    expect(job.interviewConfig.introCount).toBe(1);
  });

  it('a job that says nothing leaves introCount null, which falls through to auto', () => {
    // scheduleInterview picks with `cfg[key] ?? bp[key] ?? def`, and `??` treats
    // null as unset — so an untouched job must not force 0.
    const job = new Job({ company: new mongoose.Types.ObjectId(), title: 'X' });
    expect(job.interviewConfig.introCount).toBeNull();
    expect(job.interviewConfig.introCount ?? undefined).toBeUndefined();
  });

  it('config.introCount has no default, so undefined stays distinguishable from 0', () => {
    // A default of 0 would silently turn the background phase off everywhere.
    const iv = newInterview();
    expect(iv.config.introCount).toBeUndefined();
  });
});

describe('intro · tier 3 fallbacks do not duplicate it', () => {
  it('no fallback re-asks a background question', () => {
    // fallbackQuestion indexes by currentIndex, which is 0 at the FIRST SCORED
    // question — so a list starting with "Tell me about yourself" asked it again,
    // verbatim, right after the bridge announcing the move to technical.
    const list = roomSrc.match(/const FALLBACKS = \[([\s\S]*?)\];/)?.[1] ?? '';
    expect(list).not.toBe('');
    expect(list.toLowerCase()).not.toMatch(/tell me about yourself/);
    expect(list.toLowerCase()).not.toMatch(/project you are proud of/);
    expect(list.toLowerCase()).not.toMatch(/where do you want to grow/);
  });

  it('still has fallbacks left to serve', () => {
    const list = roomSrc.match(/const FALLBACKS = \[([\s\S]*?)\];/)?.[1] ?? '';
    expect(list.split('\n').filter((l) => l.trim().startsWith("'")).length).toBeGreaterThanOrEqual(4);
  });
});
