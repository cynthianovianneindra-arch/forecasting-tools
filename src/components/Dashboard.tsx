"use client";
import { useState } from "react";
import Link from "next/link";
import { Chart, Legend, Bar } from "./Chart";
import { Garis, BatangH } from "./Grafik";
import { f1, labelBulan, labelPenuh, tampilLabel } from "@/lib/format";
import { stockByType } from "@/lib/stock";
import { METODE_NAMA, Metode } from "@/lib/forecast";

interface Row { batalInt?: number; spr?: number; proses?: number; bulan: string; utj: number; utjInt: number; utjLoInt: number; utjHiInt: number; akad: number; akadInt: number; trend: number }
interface Makro { indikator: string; korelasi: number | null; terakhir: string | null; nilaiTerakhir: number | null }
interface Props {
  metode?: Metode;
  monthly: { bulan: string; utj: number; akad: number }[]; rows: Row[]; netPrice: number; divergent: boolean;
  stok?: { open: number; total: number; belumDibangun: number; perTipe: { tipe: string; n: number }[]; belumDibangunPerTipe: { tipe: string; n: number }[] } | null;
  stokHabis?: number | null; stokKurang?: number | null; makro?: Makro[] | null; outstanding?: number;
  bawahKiri?: React.ReactNode; // kartu tambahan di bawah kolom kiri (mis. donat hasil UTJ dan tipe laku)
}

export function Dashboard({ metode = "ets", monthly, rows, netPrice, divergent, stok, stokHabis, stokKurang, makro, outstanding, bawahKiri }: Props) {
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
  const rinci = rows[0]?.spr !== undefined;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const utjP = sum(rows.map((r) => r.utjInt)), akadP = sum(rows.map((r) => r.akadInt));
  const utjA = sum(monthly.slice(-12).map((m) => m.utj)), akadA = sum(monthly.slice(-12).map((m) => m.akad));
  const delta = (p: number, a: number) => (a > 0 ? Math.round(((p - a) / a) * 100) : null);
  const labelRows = rows.map((r) => labelBulan(r.bulan));
  const sisaStok = stok && rinci ? (() => { let sisa = stok.open; return rows.map((r) => (sisa = Math.max(0, sisa - (r.utjInt - (r.batalInt ?? 0))))); })() : null;
  const perTahun = (() => { const m = new Map<string, number>(); for (const x of monthly) m.set(x.bulan.slice(0, 4), (m.get(x.bulan.slice(0, 4)) ?? 0) + x.utj); return [...m].slice(-5).map(([y, v], i, a) => ({ label: y, value: v, catatan: i === a.length - 1 ? "s.d. data terakhir" : undefined })); })();
  const Chg = ({ v }: { v: number | null }) => (v === null ? null : <span className={"chg" + (v < 0 ? " neg" : "")}>{v >= 0 ? "+" : ""}{v}% vs 12 bln terakhir</span>);
  return (
    <div className="stack">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div><h1>Proyeksi Penjualan</h1><p className="muted" style={{ maxWidth: 640 }}>Proyeksi dasar 12 bulan ke depan ({labelBulan(rows[0].bulan)} – {labelBulan(rows[11].bulan)}) dengan metode {METODE_NAMA[metode]}. Garis putus menandai awal proyeksi. Akad dibulatkan ke bawah.</p></div>
        <div className="seg" role="group" aria-label="Tampilan">
          {(["bulanan", "tahunan"] as const).map((m) => <button key={m} className={mode === m ? "on" : ""} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "bulanan" ? "Bulanan" : "Tahunan"}</button>)}
        </div>
      </div>
      <div className="kpis">
        <div className="kpi-card accent"><small>UTJ proyeksi 12 bulan</small><span className="big">{utjP}</span><Chg v={delta(utjP, utjA)} /></div>
        <div className="kpi-card gold"><small>Akad proyeksi 12 bulan</small><span className="big">{akadP}</span><Chg v={delta(akadP, akadA)} /></div>
        <div className="kpi-card"><small>Penerimaan proyeksi</small><span className="big">Rp {f1(akadP * netPrice)} M</span><span className="sub">dari akad × harga bersih rata-rata</span></div>
        <div className="kpi-card"><small>{stok ? "Stok Open" : "UTJ 12 bulan terakhir"}</small><span className="big">{stok ? stok.open : utjA}</span><span className="sub">{stok ? (stokHabis !== null && stokHabis !== undefined ? `habis di bulan ke-${stokHabis}` : "cukup untuk 12 bulan") : `akad ${akadA}`}</span></div>
      </div>
      {divergent && <div className="warn">Arah penjualan mungkin berubah: garis tren berjauhan dari proyeksi utama</div>}
      <div className="grid">
        <div className="stack">
          <div className="card"><h2>UTJ dan akad</h2><Chart bars={bars} title="Grafik UTJ dan akad" /><Legend trend={mode === "bulanan"} />
            <p className="muted" style={{ fontSize: 12 }}>Rentang abu-abu = kemungkinan UTJ (10–90%) dari galat uji mundur; makin jauh makin lebar. Penjualan sangat berfluktuasi, jadi baca rentangnya, bukan hanya satu angka.</p></div>
          <div className="card"><h2>Rincian proyeksi (6 bulan pertama)</h2>
            {rinci ? <table><thead><tr><th>Periode</th><th className="n">UTJ</th><th className="n">Batal</th><th className="n">SPR & PPJB</th><th className="n">Akad</th><th className="n">Proses bank</th><th className="n">Penerimaan (Rp M)</th></tr></thead>
              <tbody>{table.map((r) => <tr key={r.bulan}><td>{labelPenuh(r.bulan)}</td><td className="n">{r.utjInt}</td><td className="n">{r.batalInt}</td><td className="n">{r.spr}</td><td className="n">{r.akadInt}</td><td className="n">{r.proses}</td><td className="n">{f1(r.akadInt * netPrice)}</td></tr>)}</tbody></table>
            : <table><thead><tr><th>Periode</th><th className="n">UTJ (rentang)</th><th className="n">Akad</th><th className="n">Penerimaan (Rp miliar)</th></tr></thead>
              <tbody>{table.map((r) => <tr key={r.bulan}><td>{labelPenuh(r.bulan)}</td><td className="n">{r.utjInt} ({r.utjLoInt}–{r.utjHiInt})</td><td className="n">{r.akadInt}</td><td className="n">{f1(r.akadInt * netPrice)}</td></tr>)}</tbody></table>}
            {rinci && <p className="muted" style={{ fontSize: 12 }}>Rumus seperti di Excel: batal = UTJ x tingkat batal tahun lalu; SPR & PPJB = UTJ - batal; akad = (proses bank bulan lalu + SPR & PPJB) x tingkat akad tahun lalu; proses bank = proses bank lalu + UTJ - batal - akad (dimulai dari 0).</p>}
          </div>
          <div className="pair">
            <div className="card"><h2>Penerimaan proyeksi per bulan</h2><Garis labels={labelRows} deret={[{ nama: "Penerimaan (Rp M)", nilai: rows.map((r) => r.akadInt * netPrice) }]} format={(v) => f1(v)} judul="Penerimaan proyeksi per bulan, Rp miliar" lebar={420} tinggi={190} />
              <p className="muted" style={{ fontSize: 12 }}>Akad proyeksi x harga bersih rata-rata, Rp miliar per bulan.</p></div>
            {rinci && <div className="card"><h2>Berkas di bank (proyeksi)</h2><Garis labels={labelRows} deret={[{ nama: "Proses bank", nilai: rows.map((r) => r.proses ?? 0) }, { nama: "Akad", nilai: rows.map((r) => r.akadInt), putus: true }]} judul="Berkas proses bank dan akad per bulan" lebar={420} tinggi={190} />
              <p className="muted" style={{ fontSize: 12 }}>Proses bank = berkas yang masih menunggu akad; makin tinggi, makin lama uang tertahan.</p></div>}
          </div>
          {bawahKiri}
        </div>
        <div className="stack">
          {outstanding !== undefined && <div className="card"><h2>Berkas outstanding</h2><div className="kpi">{outstanding} berkas</div>
            <p className="muted">UTJ yang belum akad dan belum batal. Bila semuanya akad pada harga bersih rata-rata, pendapatan kotor sekitar <b>Rp {f1(outstanding * netPrice)} miliar</b>.</p></div>}
          <div className="card"><h2>Unduh laporan</h2><Link className="btn" href="/laporan?jenis=bulanan">PDF Bulanan</Link> <Link className="btn alt" href="/laporan?jenis=tahunan">PDF Tahunan</Link></div>
          {stok && <div className="card"><h2>Stok tersedia dijual</h2><div className="kpi">{stok.open} unit</div><p className="muted">status Open dari {stok.total} unit (sheet UNIT). Belum dibangun (Close): {stok.belumDibangun} unit, bisa dijual setelah dibangun.</p>
            {stokHabis !== null && stokHabis !== undefined ? <p className="err">Pada laju proyeksi (UTJ dikurangi batal), stok Open habis di bulan ke-{stokHabis} dan kurang sekitar {stokKurang} unit dalam 12 bulan. Proyeksi di atas mengasumsikan unit tersedia; unit belum dibangun (Close) perlu dibangun.</p> : <p className="muted">Stok cukup untuk seluruh 12 bulan proyeksi.</p>}
            <table><thead><tr><th>Tipe</th><th className="n">Open</th><th className="n">Belum dibangun</th></tr></thead><tbody>{stockByType(stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}</tbody></table></div>}
          {sisaStok && <div className="card"><h2>Sisa stok Open per bulan</h2><Garis labels={labelRows} deret={[{ nama: "Unit Open", nilai: sisaStok }]} judul="Sisa stok Open per bulan pada laju proyeksi" lebar={300} tinggi={170} />
            <p className="muted" style={{ fontSize: 12 }}>Stok Open dikurangi UTJ bersih (UTJ dikurangi batal) tiap bulan.</p></div>}
          {perTahun.length > 1 && <div className="card"><h2>UTJ per tahun</h2><BatangH baris={perTahun} /></div>}
        </div>
      </div>
    </div>
  );
}
