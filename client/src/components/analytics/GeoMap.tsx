'use client';

import { useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

/**
 * Interactive SVG choropleth (world or India). Regions are shaded by `values`
 * (name → metric), with hover tooltips and clickable regions for drill-down.
 * TopoJSON is served from /public/maps (same-origin, lazy-loaded, offline-safe).
 */

const GEO_URL: Record<'world' | 'india', string> = {
  world: '/maps/world-110m.json',
  india: '/maps/india-states.json',
};

const nameOf = (mode: 'world' | 'india', geo: any): string =>
  mode === 'world' ? geo.properties?.name : geo.properties?.st_nm;

/** Reconcile world-atlas country names with common IP-geo provider names. */
const WORLD_ALIASES: Record<string, string[]> = {
  'United States of America': ['United States', 'USA', 'US'],
  'United Kingdom': ['UK', 'Britain', 'Great Britain'],
  Russia: ['Russian Federation'],
  Czechia: ['Czech Republic'],
  'Bosnia and Herz.': ['Bosnia and Herzegovina'],
  'Dominican Rep.': ['Dominican Republic'],
  'Dem. Rep. Congo': ['DR Congo', 'Democratic Republic of the Congo'],
  'S. Sudan': ['South Sudan'],
  'Solomon Is.': ['Solomon Islands'],
  'Central African Rep.': ['Central African Republic'],
  'Eq. Guinea': ['Equatorial Guinea'],
  eSwatini: ['Eswatini', 'Swaziland'],
  Myanmar: ['Burma'],
  'North Korea': ['Korea, North', "Democratic People's Republic of Korea"],
  'South Korea': ['Korea', 'Korea, South', 'Republic of Korea'],
  Vietnam: ['Viet Nam'],
  Syria: ['Syrian Arab Republic'],
  Laos: ["Lao People's Democratic Republic"],
};

/** Look up a region's metric, trying the map name then known aliases. */
function valueFor(values: Record<string, number>, mode: 'world' | 'india', name: string): number {
  if (values[name] != null) return values[name];
  if (mode === 'world') {
    for (const a of WORLD_ALIASES[name] || []) if (values[a] != null) return values[a];
  }
  return 0;
}

/** The data key (for drill-down) that matches a map region — resolves aliases. */
function dataKey(values: Record<string, number>, mode: 'world' | 'india', name: string): string {
  if (values[name] != null) return name;
  if (mode === 'world') {
    for (const a of WORLD_ALIASES[name] || []) if (values[a] != null) return a;
  }
  return name;
}

interface GeoMapProps {
  mode: 'world' | 'india';
  /** region name → metric value */
  values: Record<string, number>;
  onSelect?: (name: string) => void;
  metricLabel?: string;
}

export function GeoMap({ mode, values, onSelect, metricLabel = 'visitors' }: GeoMapProps) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const max = Math.max(1, ...Object.values(values));

  const fill = (v: number) => (v ? `hsl(var(--primary) / ${(0.18 + 0.82 * (v / max)).toFixed(2)})` : 'hsl(var(--muted))');

  const config =
    mode === 'world'
      ? { projection: 'geoEqualEarth' as const, projectionConfig: { scale: 150, center: [0, 8] as [number, number] }, height: 380 }
      : { projection: 'geoMercator' as const, projectionConfig: { scale: 900, center: [82.5, 22.5] as [number, number] }, height: 440 };

  return (
    <div className="relative">
      <ComposableMap
        projection={config.projection}
        projectionConfig={config.projectionConfig}
        width={800}
        height={config.height}
        style={{ width: '100%', height: 'auto' }}
      >
        <Geographies geography={GEO_URL[mode]}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const name = nameOf(mode, geo);
              const v = valueFor(values, mode, name);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={(e: any) => setTip({ x: e.clientX, y: e.clientY, text: `${name} · ${v.toLocaleString()} ${metricLabel}` })}
                  onMouseMove={(e: any) => setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
                  onMouseLeave={() => setTip(null)}
                  onClick={() => onSelect?.(dataKey(values, mode, name))}
                  style={{
                    default: { fill: fill(v), stroke: 'hsl(var(--border))', strokeWidth: 0.4, outline: 'none' },
                    hover: { fill: 'hsl(var(--accent))', stroke: 'hsl(var(--border))', strokeWidth: 0.5, outline: 'none', cursor: onSelect ? 'pointer' : 'default' },
                    pressed: { fill: 'hsl(var(--primary))', outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium shadow-lg"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

export default GeoMap;
