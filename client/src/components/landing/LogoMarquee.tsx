'use client';

/** Seamless, infinite marquee of customer logos (wordmarks). Pauses on hover. */
const logos = ['Nimbus', 'Cobalt', 'Vertex', 'Lumen', 'Drift', 'Apex', 'Northwind', 'Quanta', 'Beacon', 'Kepler'];

export function LogoMarquee() {
  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-[marquee_32s_linear_infinite] gap-14 pr-14 group-hover:[animation-play-state:paused]">
        {[...logos, ...logos].map((l, i) => (
          <span
            key={i}
            className="select-none whitespace-nowrap font-display text-xl font-bold tracking-tight text-muted-foreground/60 transition-colors hover:text-foreground"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

export default LogoMarquee;
