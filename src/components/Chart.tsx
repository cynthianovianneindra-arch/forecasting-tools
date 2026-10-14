"use client";
import { useState } from "react";

export interface Bar { label: string; full?: string; showLabel?: boolean; utj: number; akad: number; proj: boolean; lo?: number; hi?: number; baseUtj?: number; trend?: number }

/** Grafik batang UTJ & akad; proyeksi berpola terang, garis putus penanda awal proyeksi, latar abu = rentang.
 *  Arahkan kursor atau sentuh sebuah batang untuk melihat tanggal dan nilainya. */
export function Chart({ bars, title }: { bars: Bar[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760, H = 260, L = 34, B = 28, T = 10;
  const max = Math.max(4, ...bars.map((b) => Math.max(b.utj, b.akad, b.hi ?? 0, b.baseUtj ?? 0))) * 1.1;
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const gw = (W - L) / bars.length, bw = Math.min(16, gw / 2 - 2);
  const firstProj = bars.findIndex((b) => b.proj);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const trendPts = bars.map((b, i) => (b.trend !== undefined ? `${L + gw * i + gw / 2},${y(b.trend)}` : "")).filter(Boolean).join(" ");
  const basePts = bars.map((b, i) => (b.baseUtj !== undefined ? `${L + gw * i + gw / 2},${y(b.baseUtj)}` : "")).filter(Boolean).join(" ");
  const hb = hover !== null ? bars[hover] : null;
  const kiri = hover !== null && hover > bars.length / 2; // tooltip di sisi berlawanan agar tidak menutupi batang
  const bulat = (v: number) => String(Math.floor(v + 1e-9));
  const nilai = (v: number, proj: boolean) => (proj ? bulat(v) : String(Math.round(v)));
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} style={{ width: "100%", height: "auto", touchAction: "manipulation" }}>
        <defs>
          <pattern id="pu" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#8E959B" /><rect width="2" height="6" fill="#1A2127" opacity=".4" /></pattern>
          <pattern id="pa" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#A9BBC8" /><rect width="2" height="6" fill="#536878" opacity=".5" /></pattern>
        </defs>
        {ticks.map((t) => (<g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#DEDDDB" strokeDasharray="4 4" /><text x={L - 6} y={y(t) + 4} fontSize="10" textAnchor="end" fill="#5B6670">{t}</text></g>))}
        {bars.map((b, i) => {
          const cx = L + gw * i + gw / 2;
          return (
            <g key={b.label + i}>
              {hover === i && <rect x={cx - gw / 2} width={gw} y={T} height={H - B - T} fill="#1A2127" opacity=".07" />}
              {b.proj && b.lo !== undefined && b.hi !== undefined && <rect x={cx - gw / 2 + 1} width={gw - 2} y={y(b.hi)} height={Math.max(1, y(b.lo) - y(b.hi))} fill="#E8E8E6" />}
              <rect x={cx - bw - 1} width={bw} y={y(b.utj)} height={H - B - y(b.utj)} rx="3" fill={b.proj ? "url(#pu)" : "#1A2127"} stroke={b.proj ? "#1A2127" : "none"} strokeDasharray={b.proj ? "3 2" : undefined} />
              <rect x={cx + 1} width={bw} y={y(b.akad)} height={H - B - y(b.akad)} rx="3" fill={b.proj ? "url(#pa)" : "#536878"} stroke={b.proj ? "#3E505E" : "none"} strokeDasharray={b.proj ? "3 2" : undefined} />
              {b.showLabel !== false && <text x={cx} y={H - 10} fontSize="10" textAnchor="middle" fill="#5B6670">{b.label}</text>}
            </g>
          );
        })}
        {firstProj > 0 && <line x1={L + gw * firstProj} x2={L + gw * firstProj} y1={T} y2={H - B} stroke="#2B3640" strokeDasharray="4 3" />}
        {trendPts && <polyline points={trendPts} fill="none" stroke="#2B3640" strokeWidth="2" />}
        {basePts && <polyline points={basePts} fill="none" stroke="#8A9AA7" strokeWidth="2" strokeDasharray="5 3" />}
        {/* area sentuh per bulan (transparan) */}
        {bars.map((b, i) => (
          <rect key={"h" + i} x={L + gw * i} width={gw} y={0} height={H - B + 14} fill="transparent" style={{ cursor: "pointer" }}
            onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }} />
        ))}
      </svg>
      {hb && (
        <div role="status" style={{ position: "absolute", top: 4, [kiri ? "left" : "right"]: 8, background: "#0A0A0A", color: "#fff", borderRadius: 14, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(40,30,20,.25)", pointerEvents: "none", minWidth: 150 }}>
          <b>{hb.full ?? hb.label}</b> <span style={{ opacity: .7 }}>· {hb.proj ? "proyeksi" : "aktual"}</span>
          <div><span style={{ color: "#1A2127" }}>■</span> UTJ: <b>{nilai(hb.utj, hb.proj)}</b>{hb.proj && hb.lo !== undefined && hb.hi !== undefined ? ` (rentang ${bulat(hb.lo)}–${bulat(hb.hi)})` : ""}</div>
          <div><span style={{ color: "#536878" }}>■</span> Akad: <b>{Math.floor(hb.akad + 1e-9)}</b>{hb.proj ? " (dibulatkan ke bawah)" : ""}</div>
          {hb.trend !== undefined && <div><span style={{ color: "#2B3640" }}>■</span> Garis tren: {bulat(hb.trend)}</div>}
          {hb.baseUtj !== undefined && <div><span style={{ color: "#8A9AA7" }}>■</span> UTJ dasar: {bulat(hb.baseUtj)}</div>}
        </div>
      )}
    </div>
  );
}

export function Legend({ trend, base }: { trend?: boolean; base?: boolean }) {
  const sw = (c: string) => <span style={{ display: "inline-block", width: 12, height: 12, background: c, borderRadius: 2, marginRight: 6, verticalAlign: "-1px" }} />;
  return (
    <div className="legend">
      <span>{sw("#1A2127")}UTJ</span><span>{sw("#536878")}Akad</span><span>{sw("#8E959B")}{sw("#A9BBC8")}Proyeksi (warna lebih terang dari aktual)</span><span>{sw("#E8E8E6")}Rentang UTJ</span>
      {trend && <span>{sw("#2B3640")}Garis tren (pembanding)</span>}
      {base && <span>{sw("#8A9AA7")}Proyeksi dasar</span>}
      <span style={{ marginLeft: "auto" }}>Arahkan kursor atau sentuh batang untuk melihat nilai</span>
    </div>
  );
}
