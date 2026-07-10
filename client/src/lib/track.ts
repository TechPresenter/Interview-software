import { UAParser } from 'ua-parser-js';

/**
 * First-party analytics client. Shared visitor/session/device helpers plus a
 * generic `track()` beacon that powers CTA clicks, feature usage, and custom
 * events. No cookies, no PII — mirrors PageTracker's identity model.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Persistent anonymous visitor id (localStorage). */
export function getVisitor(): { v: string; isNew: boolean } {
  try {
    const existing = localStorage.getItem('_vid');
    if (existing) return { v: existing, isNew: false };
    const v = rid();
    localStorage.setItem('_vid', v);
    return { v, isNew: true };
  } catch {
    return { v: rid(), isNew: true };
  }
}

/** 30-minute sliding session id (sessionStorage). */
export function getSession(): string {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem('_sid');
    if (raw) {
      const [sid, ts] = raw.split('|');
      if (sid && now - Number(ts) < 30 * 60_000) {
        sessionStorage.setItem('_sid', `${sid}|${now}`);
        return sid;
      }
    }
    const sid = rid();
    sessionStorage.setItem('_sid', `${sid}|${now}`);
    return sid;
  } catch {
    return rid();
  }
}

const deviceType = (t?: string) => (t === 'mobile' ? 'mobile' : t === 'tablet' ? 'tablet' : !t ? 'desktop' : 'other');

/** Parse device / OS / browser from the user agent. */
export function deviceInfo() {
  try {
    const ua = new UAParser().getResult();
    return { device: deviceType(ua.device.type), os: ua.os.name || '', browser: ua.browser.name || '' };
  } catch {
    return { device: 'desktop', os: '', browser: '' };
  }
}

/**
 * Fire a first-party analytics event. Safe to call anywhere client-side; never
 * throws and never blocks the UI.
 *
 *   track('resume_upload', { size: 1234 }, 'feature')
 *   trackCta('get_started', { label: 'Start free' })
 */
export function track(name: string, props: Record<string, any> = {}, category = 'event') {
  if (typeof window === 'undefined' || !name) return;
  try {
    const { v } = getVisitor();
    const d = deviceInfo();
    const p = new URLSearchParams(window.location.search);
    fetch(`${BASE}/track/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        category,
        props,
        path: window.location.pathname,
        referrer: document.referrer || '',
        visitorId: v,
        sessionId: getSession(),
        ...d,
        utmSource: p.get('utm_source') || '',
        utmMedium: p.get('utm_medium') || '',
        utmCampaign: p.get('utm_campaign') || '',
      }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    /* never break the UI for analytics */
  }
}

/** Convenience wrapper for CTA-category events. */
export const trackCta = (name: string, props: Record<string, any> = {}) => track(name, props, 'cta');

/** Convenience wrapper for feature-usage events. */
export const trackFeature = (name: string, props: Record<string, any> = {}) => track(name, props, 'feature');
