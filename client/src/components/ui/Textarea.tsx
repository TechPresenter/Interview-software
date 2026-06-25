'use client';

/** Labeled textarea matching the form style. */
export function Textarea({
  label,
  value,
  onChange,
  rows = 4,
  ...rest
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{label}</span>}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/40"
        {...rest}
      />
    </label>
  );
}

export default Textarea;
