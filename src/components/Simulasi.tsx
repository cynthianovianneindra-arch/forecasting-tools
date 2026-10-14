"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Chart, Legend } from "./Chart";
import { f1, labelBulan, labelPenuh } from "@/lib/format";
import { analisisSkenario } from "@/lib/analisis";
import { applyScenario, changedCount, EMPTY, KATEGORI_EVENT, Referensi, scenarioQuery, Scenario, turunan } from "@/lib/whatif";
import type { ForecastRow } from "@/lib/forecast";

const inp = { minHeight: 44, borderRadius: 14, border: "1px solid #EDE7DE", background: "#F4F0E9", padding: "0 12px", fontSize: 14, width: "100%" } as const;
const num = (v: string): number | null => { const n = Number(v.replace(",", ".")); return v.trim() === "" || !isFinite(n) ? null : n; };
const fmt = (n: number | null, d = 0) => (n === null ? "-" : n.toLocaleString("id-ID", { maximumFractionDigits: d }));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

interface Props {
  rows: ForecastRow[]; netPrice: number; acuan: Referensi; stokOpen?: number;
  belumDibangunPerTipe: { tipe: string; n: number }[]; korelasiEkonomi?: number | null;
}

/** Simulasi skenario: semua variabel diisi manual (tanpa slider). UTJ dan akad ditampilkan bulat (dibulatkan ke bawah). */
export function Simulasi({ rows, netPrice, acuan: ref, stokOpen, belumDibangunPerTipe, korelasiEkonomi }: Props) {
  const [mode, setMode] = useState<"bulanan" | "total">("bulanan");
  const [f, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const s: Scenario = useMemo(() => ({
    bangun: Object.fromEntries(belumDibangunPerTipe.map((t) => [t.tipe, Math.max(0, Math.floor(num(f["b:" + t.tipe] ?? "") ?? 0))]).filter(([, n]) => (n as number) > 0)),
    mulaiBangun: Math.floor(num(f.mulai ?? "") ?? 0),
    harga: num(f.harga ?? ""), promo: Math.max(0, num(f.promo ?? "") ?? 0), leads: num(f.leads ?? ""),
    event: Object.fromEntries(KATEGORI_EVENT.map((k) => [k, Math.max(0, Math.floor(num(f["e:" + k] ?? "") ?? 0))]).filter(([, n]) => (n as number) > 0)),
    birate: num(f.birate ?? ""), ihsg: num(f.ihsg ?? ""), emas: num(f.emas ?? ""), inflasi: num(f.inflasi ?? ""),
  }), [f, belumDibangunPerTipe]);

  const stok = stokOpen ?? 0;
  const res = useMemo(() => applyScenario(rows, s, ref, stok, netPrice), [rows, s, ref, stok, netPrice]);
  const analisis = useMemo(() => analisisSkenario({ base: rows, s, ref, stokOpen: stok, belumDibangunPerTipe, netPriceMiliar: netPrice, korelasiEkonomi }), [rows, s, ref, stok, belumDibangunPerTipe, netPrice, korelasiEkonomi]);
  const t = turunan(s, ref);
  const { utjBase: bU, utjScn: sU, akadBase: bA, akadScn: sA, penBase, penScn } = analisis.totals;
  const d = (a: number, b: number) => `${a - b >= 0 ? "+" : ""}${f1(a - b).replace(",0", "")}`;
  const bars = mode === "bulanan"
    ? res.rows.map((r, i) => ({ label: labelBulan(r.bulan), full: labelPenuh(r.bulan), showLabel: [1, 4, 7, 10].includes(+r.bulan.slice(5)), utj: r.utjInt, akad: r.akadInt, proj: true, baseUtj: rows[i].utjInt }))
    : [{ label: "12 bln", full: "Total 12 bulan", utj: sU, akad: sA, proj: true, baseUtj: bU }];
  const nDiubah = changedCount(s);

  return (
    <div className="stack">
      <div><h1>Simulasi Skenario</h1><p className="muted">Isi variabel secara manual; kosongkan yang tidak ingin diubah. Proyeksi dasar di Dashboard tidak berubah. UTJ dan akad dibulatkan ke bawah. Koefisien masih ilustrasi (belum dikalibrasi dari data).</p></div>
      <div className="grid2">
        <div className="stack">
          <div className="card"><h2>Hasil skenario · 12 bulan</h2>
            <table className="mini"><tbody>
              <tr><td>UTJ</td><td className="n">{sU} ({d(sU, bU)})</td></tr>
              <tr><td>Akad</td><td className="n">{sA} ({d(sA, bA)})</td></tr>
              <tr><td>Penerimaan (Rp miliar)</td><td className="n">{f1(penScn)} ({d(penScn, penBase)})</td></tr>
              <tr><td>Variabel diubah</td><td className="n">{nDiubah}</td></tr></tbody></table>
            {res.stockWarning && <p className="err">Peringatan: kebutuhan unit melebihi stok tersedia (stok Open {stok} unit + unit order bangun).</p>}</div>
          <div>
            <details open><summary>1. Order bangun per tipe</summary>
              <p className="muted" style={{ fontSize: 12 }}>Hanya dari unit berstatus Close (belum dibangun). Stok Open saat ini: {stok} unit.</p>
              {belumDibangunPerTipe.length === 0 ? <p className="muted">Data unit belum ada; unggah Excel lengkap dengan sheet UNIT.</p> : belumDibangunPerTipe.map((x) => (
                <label key={x.tipe} className="sl">{x.tipe} <span className="muted">(tersedia {x.n} unit)</span>
                  <select style={inp} value={f["b:" + x.tipe] ?? "0"} onChange={(e) => set("b:" + x.tipe, e.target.value)}>{Array.from({ length: x.n + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? "0 (tidak dibangun)" : `${i} unit`}</option>)}</select></label>))}
              <label className="sl">Bulan mulai bangun
                <select style={inp} value={f.mulai ?? "0"} onChange={(e) => set("mulai", e.target.value)}>{rows.map((r, i) => <option key={r.bulan} value={i}>{labelPenuh(r.bulan)}</option>)}</select></label>
            </details>
            <details><summary>2. Harga & promo</summary>
              <label className="sl">Harga jual rata-rata (Rp juta) <span className="muted">acuan {fmt(ref.harga)}</span>
                <input style={inp} type="number" step="any" inputMode="decimal" value={f.harga ?? ""} onChange={(e) => set("harga", e.target.value)} placeholder={fmt(ref.harga)} /></label>
              <label className="sl">Nilai promo (Rp juta per unit)
                <input style={inp} type="number" step="any" min={0} inputMode="decimal" value={f.promo ?? ""} onChange={(e) => set("promo", e.target.value)} placeholder="0" /></label>
              {(s.harga !== null || s.promo > 0) && <p className="muted" style={{ fontSize: 12 }}>Setara perubahan harga {t.hargaPct >= 0 ? "+" : ""}{fmt(t.hargaPct, 1)}% dan promo {fmt(t.promoPct, 1)}% dari harga.</p>}
            </details>
            <details><summary>3. Marketing & event</summary>
              <label className="sl">Leads per bulan <span className="muted">acuan {fmt(ref.leadsBulanan)}</span>
                <input style={inp} type="number" step={1} min={0} inputMode="numeric" value={f.leads ?? ""} onChange={(e) => set("leads", e.target.value)} placeholder={fmt(ref.leadsBulanan)} /></label>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "10px 0 0" }}>Jumlah event per bulan</p>
              {KATEGORI_EVENT.map((k) => (
                <label key={k} className="sl">{k}
                  <select style={inp} value={f["e:" + k] ?? "0"} onChange={(e) => set("e:" + k, e.target.value)}>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i === 0 ? "0 (tidak ada)" : `${i} event`}</option>)}</select></label>))}
            </details>
            <details><summary>4. Kondisi ekonomi (isi manual)</summary>
              <p className="muted" style={{ fontSize: 12 }}>Isi nilai yang diasumsikan; kolom menampilkan nilai terakhir sebagai acuan.</p>
              {([["birate", "BI Rate (%)", ref.birate, 2], ["ihsg", "IHSG", ref.ihsg, 0], ["emas", "Harga emas (USD/oz)", ref.emas, 0], ["inflasi", "Inflasi tahunan (%)", ref.inflasi, 2]] as const).map(([k, label, acuan, dec]) => (
                <label key={k} className="sl">{label} <span className="muted">acuan {fmt(acuan, dec)}</span>
                  <input style={inp} type="number" step="any" inputMode="decimal" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={fmt(acuan, dec)} /></label>))}
            </details>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button className="btn alt" onClick={() => setF({})}>Reset skenario</button>
              {nDiubah > 0 && <Link className="btn" href={`/laporan?jenis=bulanan&s=${scenarioQuery(s)}`}>Cetak skenario di laporan</Link>}
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="card" style={{ display: "flex", justifyContent: "space-between" }}><h2>Hasil skenario</h2>
            <div className="seg">{(["bulanan", "total"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "bulanan" ? "Bulanan" : "Total 12 bln"}</button>)}</div></div>
          <div className="card"><Chart bars={bars} title="Grafik hasil skenario" /><Legend base /></div>
          <div className="card"><table><thead><tr><th>Periode</th><th className="n">UTJ</th><th className="n">Akad</th><th className="n">Penerimaan (Rp M)</th></tr></thead>
            <tbody>{res.rows.map((r, i) => <tr key={r.bulan}><td>{labelPenuh(r.bulan)}</td><td className="n">{r.utjInt} <span className="muted">(dasar {rows[i].utjInt})</span></td><td className="n">{r.akadInt}</td><td className="n">{f1(r.penerimaan)}</td></tr>)}</tbody></table></div>
          <div className="card"><h2>Analisis skenario</h2>
            {analisis.ringkasan.map((x) => <p key={x} style={{ margin: "6px 0" }}>{x}</p>)}
            {nDiubah > 0 && <>
              <table style={{ marginTop: 8 }}><thead><tr><th>Kelompok variabel</th><th className="n">Pengaruh pada UTJ 12 bulan</th></tr></thead>
                <tbody>{analisis.kontribusi.map((k) => <tr key={k.kelompok}><td>{k.kelompok}</td><td className="n">{k.selisihUtj > 0 ? "+" : ""}{k.selisihUtj}</td></tr>)}</tbody></table>
              <h2 style={{ marginTop: 12 }}>Stok</h2><p style={{ margin: "6px 0" }}>{analisis.stok}</p></>}
            <h2 style={{ marginTop: 12 }}>Catatan dan keterbatasan</h2>
            <ul style={{ margin: "6px 0", paddingLeft: 20 }}>{analisis.peringatan.map((x) => <li key={x} style={{ fontSize: 13 }}>{x}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
