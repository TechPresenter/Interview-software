/** Display formatters shared across admin/company dashboards. */

/** Money stored in minor units (cents) → localized currency string. */
export function money(minor: number, currency = 'USD') {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    (minor || 0) / 100,
  );
}

export function number(n: number) {
  return new Intl.NumberFormat('en').format(n || 0);
}

export function date(d: string | Date | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function dateTime(d: string | Date | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
}

export function relativeTime(d: string | Date | undefined) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function titleCase(s: string) {
  return s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Time-of-day greeting based on Indian Standard Time (Asia/Kolkata), regardless
 * of the viewer's local timezone:
 *   12:00 AM – 11:59 AM → Good Morning
 *   12:00 PM – 3:59 PM  → Good Afternoon
 *   4:00 PM – 11:59 PM  → Good Evening
 */
export function greetingIST(d: Date = new Date()) {
  const hour =
    Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(d)) % 24;
  if (hour < 12) return 'Good Morning';
  if (hour < 16) return 'Good Afternoon';
  return 'Good Evening';
}
