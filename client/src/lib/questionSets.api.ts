import { api, apiGet, apiPost } from './api';
import type { Paged } from './questions.api';
import type {
  Difficulty, ExperienceLevel, Question, QuestionLanguage, QuestionType,
} from '@/types/question';

/**
 * Curated question sets — the recruiter-built alternative to letting the engine
 * pick every question live. `Interview.questionSet` is served ahead of the bank
 * and the LLM, so a set here is exactly what the candidate gets asked.
 *
 * The company router mounts at the API root, so these live at /question-sets
 * (beside /jobs and /questions) — NOT /company/question-sets, which is only how
 * the controller's own doc comments spell it.
 */
const BASE = '/question-sets';

export const INTERVIEW_ROUNDS = ['screening', 'hr', 'technical', 'managerial', 'final'] as const;
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number];

export interface QuestionSet {
  _id: string;
  company?: string | null;
  name: string;
  description?: string;
  /** Refs only. `getOne` is the one endpoint that populates them. */
  questions: string[];
  jobRole?: string;
  department?: string;
  round?: InterviewRound | null;
  difficulty?: Difficulty | null;
  experienceLevel?: ExperienceLevel | null;
  language: QuestionLanguage;
  tags?: string[];
  isPublic?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
  usageCount?: number;
  /** Schema virtual — see `questionCountOf`, it is not always there. */
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionSetDetail extends Omit<QuestionSet, 'questions'> {
  questions: Question[];
}

export interface QuestionSetInput {
  name: string;
  description?: string;
  questions?: string[];
  jobRole?: string;
  department?: string;
  round?: InterviewRound | null;
  difficulty?: Difficulty | null;
  experienceLevel?: ExperienceLevel | null;
  language?: QuestionLanguage;
  tags?: string[];
  isActive?: boolean;
}

export interface AutoQuestionSetInput {
  name?: string;
  count?: number;
  skills?: string[];
  type?: QuestionType;
  /** The bank stores this on `category`; the auto endpoint names it `industry`. */
  industry?: string;
  jobRole?: string;
  round?: InterviewRound;
  difficulty?: Difficulty;
  experienceLevel?: ExperienceLevel;
  language?: QuestionLanguage;
  randomOrder?: boolean;
}

/** The server caps a set at 100 refs (createQuestionSetSchema). */
export const MAX_SET_QUESTIONS = 100;

/**
 * List rows come off a `.lean()` query, which skips the `questionCount` virtual —
 * only the create/update responses carry it. The refs themselves are always
 * present, so count those first and treat the virtual as the fallback.
 */
export const questionCountOf = (set: Pick<QuestionSet, 'questions' | 'questionCount'>) =>
  set.questions?.length ?? set.questionCount ?? 0;

/**
 * `round`/`difficulty`/`experienceLevel` are zod enums server-side: an empty
 * string is a 400, not "unset". Drop blanks rather than sending them.
 *
 * `null` survives on purpose — the set schema is `.nullish()` on those fields,
 * so null is how a round gets cleared. Empty arrays survive too: `questions: []`
 * is the only way to empty a set, and dropping it would silently no-op the save.
 */
export function pruneBlanks<T extends object>(body: T): T {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== '' && v !== undefined),
  ) as T;
}

async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const { data } = await api.get(url, { params });
  return { items: data.data as T[], meta: data.meta };
}

export const questionSetsApi = {
  list: (params?: object) => getPaged<QuestionSet>(BASE, params),
  get: (id: string) => apiGet<QuestionSetDetail>(`${BASE}/${id}`),
  create: (body: QuestionSetInput) => apiPost<QuestionSet>(BASE, pruneBlanks(body)),
  auto: (body: AutoQuestionSetInput) => apiPost<QuestionSet>(`${BASE}/auto`, pruneBlanks(body)),
  update: (id: string, body: Partial<QuestionSetInput>) =>
    api.patch(`${BASE}/${id}`, pruneBlanks(body)).then((r) => r.data.data as QuestionSet),
  duplicate: (id: string) => apiPost<QuestionSet>(`${BASE}/${id}/duplicate`, {}),
  remove: (id: string) => api.delete(`${BASE}/${id}`).then((r) => r.data),
};

export default questionSetsApi;
