import { api, apiGet, apiPost } from './api';
import type { Difficulty, GenerateResult, QuestionLanguage, QuestionType } from '@/types/question';

/**
 * Knowledge base API. KB routes are mounted under both /knowledge-bases (company
 * roles) and /admin/knowledge-bases (super-admin) — the base is chosen by role.
 */
const base = (role?: string) => (role === 'super_admin' ? '/admin/knowledge-bases' : '/knowledge-bases');

/**
 * Body for KB-grounded generation. There is no job/skills input here on purpose:
 * the KB's own content is the subject matter, and these fields only shape the
 * output. `language`/`difficulty` are the QUESTION enums, not the KB's own
 * taxonomy — the KB says `both`, a Question says `bilingual`.
 */
export interface KbGenerateInput {
  types?: QuestionType[];
  count?: number;
  difficulty?: Difficulty;
  language?: QuestionLanguage;
  jobRole?: string;
  department?: string;
  save?: boolean;
  /** The previewed set a human kept, so saving persists what was approved. */
  questions?: object[];
}

export const knowledgeApi = {
  list: (role?: string) => apiGet<any[]>(base(role)),
  get: (role: string | undefined, id: string) => apiGet<any>(`${base(role)}/${id}`),
  create: (role: string | undefined, fd: FormData) => api.post(base(role), fd).then((r) => r.data.data),
  addSources: (role: string | undefined, id: string, fd: FormData, mode: 'append' | 'replace' = 'append') =>
    api.post(`${base(role)}/${id}/sources?mode=${mode}`, fd).then((r) => r.data.data),
  update: (role: string | undefined, id: string, body: object) => api.patch(`${base(role)}/${id}`, body).then((r) => r.data.data),
  toggle: (role: string | undefined, id: string) => api.post(`${base(role)}/${id}/toggle`).then((r) => r.data.data),
  remove: (role: string | undefined, id: string) => api.delete(`${base(role)}/${id}`).then((r) => r.data),
  generateQuestions: (role: string | undefined, id: string, body: KbGenerateInput) =>
    apiPost<GenerateResult>(`${base(role)}/${id}/generate-questions`, body),
};

export default knowledgeApi;
