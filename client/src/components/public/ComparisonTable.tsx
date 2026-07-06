import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Cell = boolean | string;
export interface ComparisonRow {
  label: string;
  values: Cell[];
}

interface ComparisonTableProps {
  /** Column headers (one per compared option). */
  columns: string[];
  rows: ComparisonRow[];
  /** Index of the column to visually emphasize (e.g. HireSense / recommended plan). */
  highlightCol?: number;
  /** Header label for the first (feature) column. */
  firstColLabel?: string;
}

function renderCell(v: Cell, highlight: boolean) {
  if (v === true)
    return <Check className={cn('mx-auto h-5 w-5', highlight ? 'text-primary' : 'text-accent')} aria-label="Included" />;
  if (v === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />;
  return <span className="text-sm text-foreground">{v}</span>;
}

/**
 * Responsive comparison matrix. Scrolls horizontally on small screens with a
 * pinned first column, and highlights one option column. Server-safe.
 */
export function ComparisonTable({ columns, rows, highlightCol, firstColLabel = 'Feature' }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[680px] border-collapse text-center">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="sticky left-0 z-10 bg-card/80 p-4 text-left text-sm font-semibold backdrop-blur">
              {firstColLabel}
            </th>
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={cn(
                  'p-4 text-sm font-semibold',
                  i === highlightCol && 'relative text-primary',
                )}
              >
                {i === highlightCol && (
                  <span className="pointer-events-none absolute inset-x-1 inset-y-0 -z-0 rounded-t-xl bg-primary/5" />
                )}
                <span className="relative">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.label} className={cn('border-b border-border/70 last:border-0', ri % 2 === 1 && 'bg-muted/20')}>
              <th scope="row" className="sticky left-0 z-10 bg-card/80 p-4 text-left text-sm font-medium backdrop-blur">
                {row.label}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className={cn('p-4 align-middle', i === highlightCol && 'bg-primary/5')}>
                  {renderCell(v, i === highlightCol)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ComparisonTable;
