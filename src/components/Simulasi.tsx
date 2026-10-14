"use client";
import { useMemo, useState } from "react";
import { Chart, Legend } from "./Chart";
import { f1, labelBulan } from "@/lib/format";
import { EMPTY, Scenario, VARS, applyScenario, changedCount } from "@/lib/whatif";

interface Row { bulan: string; utj: number; utjLo: number; utjHi: number; akad: number; trend: number }
export function Simulasi({ rows, netPrice }: { rows: Row[]; netPrice: number }) {
  const [s, setS] = useState<Scenario>(EMPTY);
  const [mode, setMode] = useState<"bulanan" | "tahunan">("bulanan");
  const { rows: sc, stockWarning } = useMemo(() => applyScenario(rows, s), [rows, s]);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const bU = sum(rows.map((r) => r.utj)), bA = sum(rows.map((r) => r.akad));
  const sU = sum(sc.map((r) => r.utj)), sA = sum(sc.map((r) => r.akad));
  const bars = mode === "bulanan"
    ? sc.map((r, i) => ({ label: labelBulan(r.bulan), utj: r.utj, akad: r.akad, proj: true, baseUtj: rows[i].utj }))
    : [{ label: "12 bln", utj: sU, akad: sA, proj: true, baseUtj: bU }];
  const groups = [...new Set(VARS.map((v) => v.group))];
  const d = (a: number, b: number) => `${a - b >= 0 ? "+" : ""}${f1(a - b)}`;
  return (
    <div className="stack">
      <div><h1>Simulasi Skenario</h1><p className="muted">Proyeksi dasar di Dashboard tidak berubah. Koefisien di sini masih ilustrasi (SPEC 4.1) dan belum terkalibrasi; pengaruh variabel ekonomi lemah pada data historis.</p></div>
      <div className="grid2">
        <div className="stack">
          <div className="card"><h2>Hasil skenario · 12 bulan</h2>
            <table className="mini"><tbody>
              <tr><td>UTJ</td><td className="n">{f1(sU)} ({d(sU, bU)})</td></tr>
              <tr><td>Akad</td><td className="n">{f1(sA)} ({d(sA, bA)})</td></tr>
              <tr><td>Penerimaan (Rp miliar)</td><td className="n">{f1(sA * netPrice)} ({d(sA * netPrice, bA * netPrice)})</td></tr>
              <tr><td>Variabel diubah</td><td className="n">{changedCount(s)}</td></tr></tbody></table>
            {stockWarning && <p className="err">Peringatan: UTJ skenario melebihi stok unit yang tersedia dijual (stok demo).</p>}</div>
          <div>{groups.map((g, i) => (
            <details key={g} open={i === 0}><summary>{g}</summary>
              {VARS.filter((v) => v.group === g).map((v) => (
                <label className="sl" key={v.key}>{v.label}: <b>{s[v.key]} {v.unit}</b>
                  <input type="range" min={v.min} max={v.max} step={v.step} value={s[v.key]} onChange={(e) => setS({ ...s, [v.key]: +e.target.value })} /></label>))}
            </details>))}
            <button className="btn alt" onClick={() => setS(EMPTY)}>Reset skenario</button></div>
        </div>
        <div className="stack">
          <div className="card" style={{ display: "flex", justifyContent: "space-between" }}><h2>Hasil skenario</h2>
            <div className="seg">{(["bulanan", "tahunan"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "bulanan" ? "Bulanan" : "Total 12 bln"}</button>)}</div></div>
          <div className="card"><Chart bars={bars} title="Grafik hasil skenario" /><Legend base /></div>
          <div className="card"><table><thead><tr><th>Periode</th><th className="n">UTJ</th><th className="n">Akad</th><th className="n">Penerimaan (Rp M)</th></tr></thead>
            <tbody>{sc.map((r) => <tr key={r.bulan}><td>{labelBulan(r.bulan)}</td><td className="n">{f1(r.utj)}</td><td className="n">{f1(r.akad)}</td><td className="n">{f1(r.penerimaan)}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}
