import { UAParser } from 'ua-parser-js';

/**
 * Device, browser & network capture (§10). All free browser APIs + a keyless
 * public IP-geo lookup (ipwho.is). Geo is best-effort and only as precise as the
 * IP allows unless the candidate grants the Geolocation permission.
 */

export interface DeviceInfo {
  browser?: string;
  browserVersion?: string;
  os?: string;
  deviceType?: string;
  screenResolution?: string;
  viewport?: string;
  cpuCores?: number;
  ram?: number;
  userAgent?: string;
  language?: string;
  timezone?: string;
}

export interface NetworkInfo {
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  lat?: number;
  lng?: number;
  networkType?: string;
  isp?: string;
  vpn?: boolean;
  downlinkMbps?: number;
}

export function captureDevice(): DeviceInfo {
  const parser = new UAParser();
  const r = parser.getResult();
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } };
  return {
    browser: r.browser.name,
    browserVersion: r.browser.version,
    os: [r.os.name, r.os.version].filter(Boolean).join(' '),
    deviceType: r.device.type || 'desktop',
    screenResolution: `${window.screen.width}×${window.screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    cpuCores: nav.hardwareConcurrency,
    ram: nav.deviceMemory,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Fetch approximate geo/network from IP (keyless, CORS-enabled). Never throws. */
export async function captureNetwork(): Promise<NetworkInfo> {
  const nav = navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } };
  const base: NetworkInfo = {
    networkType: nav.connection?.effectiveType,
    downlinkMbps: nav.connection?.downlink,
  };
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(6000) });
    const d = await res.json();
    if (d && d.success !== false) {
      base.ip = d.ip;
      base.country = d.country;
      base.region = d.region;
      base.city = d.city;
      base.lat = d.latitude;
      base.lng = d.longitude;
      base.isp = d.connection?.isp || d.connection?.org;
      // Best-effort VPN heuristic: IP timezone vs the browser's local timezone.
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (d.timezone?.id && localTz && d.timezone.id !== localTz) base.vpn = true;
    }
  } catch {
    /* offline or blocked — device info still captured */
  }
  return base;
}

/** Optional precise location with the candidate's explicit permission (§10). */
export function requestPreciseLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}
