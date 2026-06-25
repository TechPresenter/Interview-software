'use client';

/** Labeled select matching the form style. */
export function Select({
  label,
  value,
  onChange,
  options,
  ...rest
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default Select;
