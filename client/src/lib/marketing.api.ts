import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** Public (no-auth) marketing endpoints: contact form, etc. */
const http = axios.create({ baseURL: BASE });

export interface ContactPayload {
  name: string;
  email: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  subject: string;
  message: string;
  /** Honeypot — must stay empty. */
  company_website?: string;
}

export const marketingApi = {
  contact: (payload: ContactPayload) => http.post('/contact', payload).then((r) => r.data),
};

export default marketingApi;
