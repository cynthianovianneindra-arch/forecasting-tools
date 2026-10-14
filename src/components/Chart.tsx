import { f1 } from "@/lib/format";

export interface Bar { label: string; utj: number; akad: number; proj: boolean; lo?: number; hi?: number; baseUtj?: number; trend?: number }

/** Grafik batang UTJ & akad; proyeksi berpola terang, garis putus penanda awal proyeksi, latar abu = rentang. */
export function Chart({ bars, title }: { bars: Bar[]; title: string }) {
  const W = 760, H = 260, L = 34, B = 28, T = 10;
  const max = Math.max(4, ...bars.map((b) => Math.max(b.utj, b.akad, b.hi ?? 0, b.baseUtj ?? 0))) * 1.1;
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const gw = (W - L) / bars.length, bw = Math.min(14, gw / 2 - 2);
  const firstProj = bars.findIndex((b) => b.proj);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const trendPts = bars.map((b, i) => (b.trend !== undefined ? `${L + gw * i + gw / 2},${y(b.trend)}` : "")).filter(Boolean).join(" ");
  const basePts = bars.map((b, i) => (b.baseUtj !== undefined ? `${L + gw * i + gw / 2},${y(b.baseUtj)}` : "")).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} style={{ width: "100%", height: "auto" }}>
      <defs>
        <pattern id="pu" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#C7D3E8" /><rect width="2" height="6" fill="#24467C" opacity=".35" /></pattern>
        <pattern id="pa" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F7D9B8" /><rect width="2" height="6" fill="#B8620F" opacity=".35" /></pattern>
      </defs>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#E1E5EB" /><text x={L - 6} y={y(t) + 4} fontSize="10" textAnchor="end" fill="#5A6473">{t}</text></g>))}
      {bars.map((b, i) => {
        const cx = L + gw * i + gw / 2;
        return (
          <g key={b.label + i}>
            {b.proj && b.lo !== undefined && b.hi !== undefined && <rect x={cx - gw / 2 + 1} width={gw - 2} y={y(b.hi)} height={Math.max(1, y(b.lo) - y(b.hi))} fill="#E3E8F0" />}
            <rect x={cx - bw - 1} width={bw} y={y(b.utj)} height={H - B - y(b.utj)} fill={b.proj ? "url(#pu)" : "#24467C"} stroke={b.proj ? "#24467C" : "none"} strokeDasharray={b.proj ? "3 2" : undefined} />
            <rect x={cx + 1} width={bw} y={y(b.akad)} height={H - B - y(b.akad)} fill={b.proj ? "url(#pa)" : "#E58A2B"} stroke={b.proj ? "#B8620F" : "none"} strokeDasharray={b.proj ? "3 2" : undefined} />
            <text x={cx} y={H - 10} fontSize="9" textAnchor="middle" fill="#5A6473">{b.label}</text>
            <title>{`${b.label}: UTJ ${f1(b.utj)}, akad ${f1(b.akad)}${b.proj ? " (proyeksi)" : ""}`}</title>
          </g>
        );
      })}
      {firstProj > 0 && <line x1={L + gw * firstProj} x2={L + gw * firstProj} y1={T} y2={H - B} stroke="#141B26" strokeDasharray="4 3" />}
      {trendPts && <polyline points={trendPts} fill="none" stroke="#176B3A" strokeWidth="2" />}
      {basePts && <polyline points={basePts} fill="none" stroke="#8A93A1" strokeWidth="2" strokeDasharray="5 3" />}
    </svg>
  );
}

export function Legend({ trend, base }: { trend?: boolean; base?: boolean }) {
  const sw = (c: string) => <span style={{ display: "inline-block", width: 12, height: 12, background: c, borderRadius: 2, marginRight: 6, verticalAlign: "-1px" }} />;
  return (
    <div className="legend">
      <span>{sw("#24467C")}UTJ</span><span>{sw("#E58A2B")}Akad</span><span>{sw("#C7D3E8")}Proyeksi (terang)</span><span>{sw("#E3E8F0")}Rentang UTJ</span>
      {trend && <span>{sw("#176B3A")}Garis tren (pembanding)</span>}
      {base && <span>{sw("#8A93A1")}Proyeksi dasar</span>}
    </div>
  );
}
