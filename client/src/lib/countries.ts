/** Curated country list for the phone / country selectors. India first (default). */
export interface Country {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string; // international dialing code, incl. "+"
  flag: string; // emoji flag
  /** Expected national number length (min–max digits) for light validation. */
  min: number;
  max: number;
}

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', min: 10, max: 10 },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', min: 10, max: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', min: 9, max: 10 },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪', min: 8, max: 9 },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', min: 10, max: 10 },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', min: 9, max: 9 },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', min: 8, max: 8 },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', min: 10, max: 11 },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', min: 9, max: 9 },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', min: 9, max: 9 },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', min: 9, max: 9 },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦', min: 8, max: 8 },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦', min: 9, max: 9 },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬', min: 10, max: 10 },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩', min: 10, max: 10 },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰', min: 10, max: 10 },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰', min: 9, max: 9 },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵', min: 10, max: 10 },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', min: 9, max: 10 },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', min: 10, max: 10 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

/** Group India's 10 digits as 5-5; otherwise plain digits. */
export function formatNational(digits: string, code: string): string {
  const d = digits.replace(/\D/g, '');
  if (code === 'IN' && d.length > 5) return `${d.slice(0, 5)} ${d.slice(5, 10)}`.trim();
  return d;
}
