"use client";
import { useState } from "react";
import Link from "next/link";
import { Chart, Legend, Bar } from "./Chart";
import { f1, labelBulan } from "@/lib/format";

interface Row { bulan: string; utj: number; utjLo: number; utjHi: number; akad: number; trend: number }
export function Dashboard({ monthly, rows, netPrice, open, divergent }: { monthly: { bulan: string; utj: number; akad: number }[]; rows: Row[]; netPrice: number; open: number; divergent: boolean }) {
  const [mode, setMode] = useState<"bulanan" | "tahunan">("bulanan");
  let bars: Bar[];
  if (mode === "bulanan") {
    bars = [...monthly.slice(-12).map((m) => ({ label: labelBulan(m.bulan), utj: m.utj, akad: m.akad, proj: false })),
      ...rows.map((r) => ({ label: labelBulan(r.bulan), utj: r.utj, akad: r.akad, proj: true, lo: r.utjLo, hi: r.utjHi, trend: r.trend }))];
  } else {
    const yrs = new Map<string, Bar>();
    for (const m of monthly) { const y = m.bulan.slice(0, 4); const b = yrs.get(y) ?? { label: y, utj: 0, akad: 0, proj: false }; b.utj += m.utj; b.akad += m.akad; yrs.set(y, b); }
    for (const r of rows) { const y = r.bulan.slice(0, 4); const b = yrs.get(y) ?? { label: y, utj: 0, akad: 0, proj: true }; b.utj += r.utj; b.akad += r.akad; b.proj = true; yrs.set(y, b); }
    bars = [...yrs.values()];
  }
  const table = rows.slice(0, 6);
  return (
    <div className="stack">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div><h1>Proyeksi Penjualan</h1><p className="muted" style={{ maxWidth: 640 }}>Proyeksi dasar 12 bulan ke depan ({labelBulan(rows[0].bulan)} – {labelBulan(rows[11].bulan)}). Garis putus menandai awal proyeksi. Untuk skenario, pakai menu <Link href="/simulasi">Simulasi</Link>.</p></div>
        <div className="seg" role="group" aria-label="Tampilan">
          {(["bulanan", "tahunan"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "bulanan" ? "Bulanan" : "Tahunan"}</button>)}
        </div>
      </div>
      {divergent && <div className="warn">Arah penjualan mungkin berubah: garis tren berjauhan dari proyeksi utama</div>}
      <div className="grid">
        <div className="stack">
          <div className="card"><h2>UTJ dan akad</h2><Chart bars={bars} title="Grafik UTJ dan akad" /><Legend trend={mode === "bulanan"} />
            <p className="muted" style={{ fontSize: 12 }}>Rentang abu-abu = kemungkinan UTJ (10–90%) dari galat backtest; makin jauh makin lebar. Penjualan sangat berfluktuasi, jadi baca rentangnya, bukan hanya satu angka.</p></div>
          <div className="card"><h2>Rincian proyeksi (6 bulan pertama)</h2>
            <table><thead><tr><th>Periode</th><th className="n">UTJ (rentang)</th><th className="n">Akad</th><th className="n">Penerimaan (Rp miliar)</th></tr></thead>
              <tbody>{table.map((r) => <tr key={r.bulan}><td>{labelBulan(r.bulan)}</td><td className="n">{f1(r.utj)} ({f1(r.utjLo)}–{f1(r.utjHi)})</td><td className="n">{f1(r.akad)}</td><td className="n">{f1(r.akad * netPrice)}</td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="stack">
          <div className="card"><h2>Mau coba skenario?</h2><p className="muted">Ubah harga, promo, leads, suplai unit, atau kondisi ekonomi dan lihat dampaknya.</p><Link className="btn" href="/simulasi">Buka Simulasi</Link></div>
          <div className="card"><h2>Unduh laporan</h2><Link className="btn" href="/laporan?jenis=bulanan">PDF Bulanan</Link> <Link className="btn alt" href="/laporan?jenis=tahunan">PDF Tahunan</Link></div>
          <div className="card"><h2>Pipeline berjalan</h2><div className="kpi">{open} UTJ</div><p className="muted">belum akad dan belum batal</p></div>
        </div>
      </div>
    </div>
  );
}
