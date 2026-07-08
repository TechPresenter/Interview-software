'use client';

import { useMemo, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, formatNational } from '@/lib/countries';

const inputCls =
  'h-11 w-full rounded-xl border border-input bg-background/60 px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40';

/* ── Mobile number with an international country-code selector ── */

/** Split a stored "+91 98765 43210" into an ISO country code + national digits. */
export function splitPhone(stored?: string): { code: string; national: string } {
  if (!stored) return { code: DEFAULT_COUNTRY.code, national: '' };
  const s = stored.trim();
  const byDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find((c) => s.startsWith(c.dial));
  if (byDial) return { code: byDial.code, national: s.slice(byDial.dial.length).replace(/\D/g, '') };
  return { code: DEFAULT_COUNTRY.code, national: s.replace(/\D/g, '') };
}

/** Re-join an ISO code + national digits into the stored "+dial national" form. */
export function joinPhone(code: string, national: string): string {
  const digits = national.replace(/\D/g, '');
  if (!digits) return '';
  const c = COUNTRIES.find((x) => x.code === code) || DEFAULT_COUNTRY;
  return `${c.dial} ${digits}`;
}

export function PhoneField({
  label, code, national, onCode, onNational, required, error,
}: {
  label: string;
  code: string;
  national: string;
  onCode: (v: string) => void;
  onNational: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  const country = useMemo(() => COUNTRIES.find((c) => c.code === code) || DEFAULT_COUNTRY, [code]);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={code}
          onChange={(e) => onCode(e.target.value)}
          aria-label="Country code"
          className="h-11 w-[92px] shrink-0 rounded-xl border border-input bg-background/60 px-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        >
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.dial}</option>)}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={national}
          onChange={(e) => onNational(formatNational(e.target.value, code))}
          placeholder={`${country.flag} Mobile number`}
          autoComplete="tel-national"
          aria-invalid={!!error}
          className={inputCls}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/* ── Date of birth: DD/MM/YYYY text + native calendar picker ── */

const isoToDisplay = (v = '') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};
const displayToIso = (v = '') => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/** DOB field: shows/stores DD/MM/YYYY, with a native calendar picker on the icon. */
export function DateOfBirthField({ label, value, onChange }: { label: string; value: string; onChange: (ddmmyyyy: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null);
  const display = isoToDisplay(value);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : displayToIso(value);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          className={`${inputCls} pr-11`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Calendar className="h-4 w-4" /></span>
        {/* Transparent native date input overlays the calendar icon → opens the OS picker. */}
        <input
          ref={dateRef}
          type="date"
          value={iso}
          max={today}
          onChange={(e) => onChange(isoToDisplay(e.target.value))}
          aria-label={label}
          className="absolute right-0 top-0 h-full w-11 cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}
