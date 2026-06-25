import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** Public marketing content client (no auth). */
const http = axios.create({ baseURL: `${BASE}/content` });

export const contentApi = {
  branding: () => http.get('/branding').then((r) => r.data.data),
  plans: () => http.get('/plans').then((r) => r.data.data),
  faqs: () => http.get('/faqs').then((r) => r.data.data),
  testimonials: () => http.get('/testimonials').then((r) => r.data.data),
  announcements: () => http.get('/announcements').then((r) => r.data.data),
  blog: (params?: object) => http.get('/blog', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta })),
  blogPost: (slug: string) => http.get(`/blog/${slug}`).then((r) => r.data.data),
  page: (slug: string) => http.get(`/pages/${slug}`).then((r) => r.data.data),
};

export default contentApi;
