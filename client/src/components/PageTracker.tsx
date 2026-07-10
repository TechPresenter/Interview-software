'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { UAParser } from 'ua-parser-js';

/**
 * First-party page-view beacon. On every route change it sends an anonymous
 * event (path, referrer, UTM, device/OS/browser + a persistent visitor id and a
 * 30-min sliding session id) to /track/collect. Geo is resolved server-side from
 * the IP. No cookies, no PII — powers the admin Analytics dashboard.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function visitor() {
  try {
    let v = localStorage.getItem('_vid');
    if (!v) { v = rid(); localStorage.setItem('_vid', v); return { v, isNew: true }; }
    return { v, isNew: false };
  } catch { return { v: rid(), isNew: true }; }
}

function session() {
  try {
    const now = Date.now();
    const raw = sessionStorage.getItem('_sid');
    if (raw) {
      const [sid, ts] = raw.split('|');
      if (sid && now - Number(ts) < 30 * 60_000) { sessionStorage.setItem('_sid', `${sid}|${now}`); return sid; }
    }
    const sid = rid();
    sessionStorage.setItem('_sid', `${sid}|${now}`);
    return sid;
  } catch { return rid(); }
}

const deviceType = (t?: string) => (t === 'mobile' ? 'mobile' : t === 'tablet' ? 'tablet' : !t ? 'desktop' : 'other');

export function PageTracker() {
  const pathname = usePathname();
  const last = useRef<string>('');

  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    try {
      const { v, isNew } = visitor();
      const ua = new UAParser().getResult();
      const p = new URLSearchParams(window.location.search);
      const body = {
        path: pathname,
        referrer: document.referrer || '',
        visitorId: v,
        sessionId: session(),
        isNewVisitor: isNew,
        device: deviceType(ua.device.type),
        os: ua.os.name || '',
        browser: ua.browser.name || '',
        utmSource: p.get('utm_source') || '',
        utmMedium: p.get('utm_medium') || '',
        utmCampaign: p.get('utm_campaign') || '',
      };
      fetch(`${BASE}/track/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {});
    } catch {
      /* never break navigation */
    }
  }, [pathname]);

  return null;
}

export default PageTracker;
