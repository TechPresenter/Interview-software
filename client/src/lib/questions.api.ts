import { apiGet, apiPost, api } from './api';
import type { Question, QuestionStats, GenerateQuestionsInput, GenerateResult } from '@/types/question';

/**
 * Question bank client.
 *
 * The super-admin maintains the global bank at /admin/questions; a company
 * maintains its own at /company/questions. The two surfaces are identical, so
 * one factory serves both and the page just says which scope it is in — rather
 * than duplicating thirteen endpoints per role.
 */

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const { data } = await api.get(url, { params });
  return { items: data.data as T[], meta: data.meta };
}

export function questionsApi(scope: 'admin' | 'company') {
  // The company router mounts at the API root, so its questions live at
  // /questions (alongside /jobs and /reports) — NOT /company/questions.
  const base = scope === 'admin' ? '/admin/questions' : '/questions';
  return {
    list: (params?: object) => getPaged<Question>(base, params),
    stats: () => apiGet<QuestionStats>(`${base}/stats`),
    create: (body: object) => apiPost<Question>(base, body),
    update: (id: string, body: object) => api.patch(`${base}/${id}`, body).then((r) => r.data.data as Question),
    remove: (id: string) => api.delete(`${base}/${id}`).then((r) => r.data),
    duplicate: (id: string) => apiPost<Question>(`${base}/${id}/duplicate`, {}),
    archive: (id: string) => apiPost<Question>(`${base}/${id}/archive`, {}),
    restore: (id: string) => apiPost<Question>(`${base}/${id}/restore`, {}),
    review: (id: string, status: 'approved' | 'rejected', note?: string) =>
      apiPost<Question>(`${base}/${id}/review`, { status, note }),
    bulkReview: (ids: string[], status: 'approved' | 'rejected') =>
      apiPost<{ updated: number }>(`${base}/bulk-review`, { ids, status }),
    bulkCreate: (questions: object[]) => apiPost<{ inserted: number }>(`${base}/bulk`, { questions }),
    generate: (body: GenerateQuestionsInput) => apiPost<GenerateResult>(`${base}/generate`, body),
    answerKey: (id: string) => apiPost<Question>(`${base}/${id}/answer-key`, {}),
  };
}

export type QuestionsApi = ReturnType<typeof questionsApi>;

/** Which bank the signed-in user manages. */
export const scopeForRole = (role?: string): 'admin' | 'company' =>
  role === 'super_admin' ? 'admin' : 'company';
