"use client";
import { useState } from "react";
import Link from "next/link";
import { Chart, Legend, Bar } from "./Chart";
import { f1, labelBulan, labelPenuh, tampilLabel } from "@/lib/format";
import { stockByType } from "@/lib/stock";

interface Row { bulan: string; utj: number; utjInt: number; utjLoInt: number; utjHiInt: number; akad: number; akadInt: number; trend: number }
interface Makro { indikator: string; korelasi: number | null; terakhir: string | null; nilaiTerakhir: number | null }
interface Props {
  monthly: { bulan: string; utj: number; akad: number }[]; rows: Row[]; netPrice: number; divergent: boolean;
  stok?: { open: number; total: number; belumDibangun: number; perTipe: { tipe: string; n: number }[]; belumDibangunPerTipe: { tipe: string; n: number }[] } | null;
  stokHabis?: number | null; stokKurang?: number | null; makro?: Makro[] | null;
}

export function Dashboard({ monthly, rows, netPrice, divergent, stok, stokHabis, stokKurang, makro }: Props) {
  const [mode, setMode] = useState<"bulanan" | "tahunan">("bulanan");
  let bars: Bar[];
  if (mode === "bulanan") {
    bars = [...monthly.slice(-12).map((m) => ({ label: labelBulan(m.bulan), full: labelPenuh(m.bulan), showLabel: tampilLabel(m.bulan), utj: m.utj, akad: m.akad, proj: false })),
      ...rows.map((r) => ({ label: labelBulan(r.bulan), full: labelPenuh(r.bulan), showLabel: tampilLabel(r.bulan), utj: r.utjInt, akad: r.akadInt, proj: true, lo: r.utjLoInt, hi: r.utjHiInt, trend: r.trend }))];
  } else {
    const yrs = new Map<string, Bar>();
    for (const m of monthly) { const y = m.bulan.slice(0, 4); const b = yrs.get(y) ?? { label: y, full: `Tahun ${y}`, utj: 0, akad: 0, proj: false }; b.utj += m.utj; b.akad += m.akad; yrs.set(y, b); }
    for (const r of rows) { const y = r.bulan.slice(0, 4); const b = yrs.get(y) ?? { label: y, full: `Tahun ${y}`, utj: 0, akad: 0, proj: true }; b.utj += r.utjInt; b.akad += r.akadInt; b.proj = true; b.full = `Tahun ${y} (aktual + proyeksi)`; yrs.set(y, b); }
    bars = [...yrs.values()];
  }
  const table = rows.slice(0, 6);
  return (
    <div className="stack">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div><h1>Proyeksi Penjualan</h1><p className="muted" style={{ maxWidth: 640 }}>Proyeksi dasar 12 bulan ke depan ({labelBulan(rows[0].bulan)} – {labelBulan(rows[11].bulan)}) dengan exponential smoothing. Garis putus menandai awal proyeksi. Akad dibulatkan ke bawah.</p></div>
        <div className="seg" role="group" aria-label="Tampilan">
          {(["bulanan", "tahunan"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "bulanan" ? "Bulanan" : "Tahunan"}</button>)}
        </div>
      </div>
      {divergent && <div className="warn">Arah penjualan mungkin berubah: garis tren berjauhan dari proyeksi utama</div>}
      <div className="grid">
        <div className="stack">
          <div className="card"><h2>UTJ dan akad</h2><Chart bars={bars} title="Grafik UTJ dan akad" /><Legend trend={mode === "bulanan"} />
            <p className="muted" style={{ fontSize: 12 }}>Rentang abu-abu = kemungkinan UTJ (10–90%) dari galat uji mundur; makin jauh makin lebar. Penjualan sangat berfluktuasi, jadi baca rentangnya, bukan hanya satu angka.</p></div>
          <div className="card"><h2>Rincian proyeksi (6 bulan pertama)</h2>
            <table><thead><tr><th>Periode</th><th className="n">UTJ (rentang)</th><th className="n">Akad</th><th className="n">Penerimaan (Rp miliar)</th></tr></thead>
              <tbody>{table.map((r) => <tr key={r.bulan}><td>{labelPenuh(r.bulan)}</td><td className="n">{r.utjInt} ({r.utjLoInt}–{r.utjHiInt})</td><td className="n">{r.akadInt}</td><td className="n">{f1(r.akadInt * netPrice)}</td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="stack">
          <div className="card"><h2>Unduh laporan</h2><Link className="btn" href="/laporan?jenis=bulanan">PDF Bulanan</Link> <Link className="btn alt" href="/laporan?jenis=tahunan">PDF Tahunan</Link></div>
          {stok && <div className="card"><h2>Stok tersedia dijual</h2><div className="kpi">{stok.open} unit</div><p className="muted">status Open dari {stok.total} unit (sheet UNIT). Belum dibangun (Close): {stok.belumDibangun} unit, bisa dijual setelah dibangun.</p>
            {stokHabis !== null && stokHabis !== undefined ? <p className="err">Pada laju proyeksi (UTJ dikurangi batal), stok Open habis di bulan ke-{stokHabis} dan kurang sekitar {stokKurang} unit dalam 12 bulan. Proyeksi di atas mengasumsikan unit tersedia; unit belum dibangun (Close) perlu dibangun.</p> : <p className="muted">Stok cukup untuk seluruh 12 bulan proyeksi.</p>}
            <table><thead><tr><th>Tipe</th><th className="n">Open</th><th className="n">Belum dibangun</th></tr></thead><tbody>{stockByType(stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}</tbody></table></div>}
          {makro && <div className="card"><h2>Konteks ekonomi</h2>
            <table><thead><tr><th>Indikator</th><th className="n">Terakhir</th><th className="n">Korelasi UTJ</th></tr></thead><tbody>{makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.nilaiTerakhir === null ? "-" : m.nilaiTerakhir.toLocaleString("id-ID", { maximumFractionDigits: 2 })}<span className="muted"> ({m.terakhir ?? "-"})</span></td><td className="n">{m.korelasi === null ? "-" : m.korelasi.toLocaleString("id-ID")}</td></tr>)}</tbody></table>
            <p className="muted" style={{ fontSize: 12 }}>Korelasi bulanan lemah (di bawah 0,3): hanya konteks, bukan penggerak proyeksi.</p></div>}
        </div>
      </div>
    </div>
  );
}
