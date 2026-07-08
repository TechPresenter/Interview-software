import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** Public (no-auth) marketing endpoints: contact form, etc. */
const http = axios.create({ baseURL: BASE });

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  company?: string;
  jobTitle?: string;
  subject: string;
  message: string;
  /** Honeypot — must stay empty. */
  company_website?: string;
  /** CAPTCHA token (when spam protection is enabled). */
  captchaToken?: string;
}

export interface CaptchaConfig {
  enabled: boolean;
  provider: 'none' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha';
  siteKey: string;
  forms: string[];
}

export interface DemoPayload {
  name: string;
  company?: string;
  email: string;
  phone: string;
  country?: string;
  preferredDate?: string;
  timeSlot?: string;
  timezone?: string;
  employees?: string;
  message?: string;
  company_website?: string;
  captchaToken?: string;
}

export const marketingApi = {
  contact: (payload: ContactPayload) => http.post('/contact', payload).then((r) => r.data),
  demo: (payload: DemoPayload) => http.post('/demo', payload).then((r) => r.data),
  newsletter: (email: string, extra?: { captchaToken?: string; company_website?: string }) =>
    http.post('/newsletter', { email, ...extra }).then((r) => r.data),
  captcha: (): Promise<CaptchaConfig> => http.get('/content/captcha').then((r) => r.data.data),
};

export default marketingApi;
