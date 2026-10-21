import { Nav, badge } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { FilterBar } from "@/components/FilterBar";
import { getData } from "@/lib/data";
import { parseMetode } from "@/lib/forecast";
import { labelPenuh, labelPanjang, f1 } from "@/lib/format";
import { addMonths } from "@/lib/forecast";
import { Temuan, Donat } from "@/components/Grafik";
import { cards } from "@/lib/insights";
import Link from "next/link";
import { TargetCard } from "@/components/TargetCard";
import { hitungCapaian } from "@/lib/target";
import { sumberExcel } from "@/lib/sinkronExcel";
import { sesiSaatIni } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LINK = [["/pasar", "Pasar & Ekonomi", "daya beli dan kondisi ekonomi"], ["/marketing", "Marketing & Leads", "efektivitas promo, harga, event"], ["/bank", "Proses Bank", "persetujuan dan lama proses"], ["/produk", "Produk & Stok", "unit diminati dan order bangun"], ["/penjualan", "Penjualan", "corong, tipe, tim"]];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const filter = { tipe: q.tipe || undefined, agent: q.agent || undefined, marketing: q.marketing || undefined, cluster: q.cluster || undefined, tahap: q.tahap || undefined, tahun: q.tahun || undefined, dari: q.dari || undefined, sampai: q.sampai || undefined };
  const metode = parseMetode(q.metode);
  const d = await getData("kalender", filter, metode);
  const admin = (await sesiSaatIni())?.rl === "admin";
  const diperbarui = d.uploadInfo ? new Date(d.uploadInfo.uploaded_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const ringkas = d.source !== "demo" && !d.filtered ? cards(d.txns) : null;
  const capaian = !d.filtered && !d.periodeAktif && d.source !== "demo" ? hitungCapaian(d.targets, d.monthly, d.f.rows, d.end.slice(0, 4), d.end) : null;
  // Temuan utama: tiga hal yang paling perlu dibaca, dihitung dari data (bukan oleh Claude)
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const utjP = sum(d.f.rows.map((r) => r.utjInt)), akadP = sum(d.f.rows.map((r) => r.akadInt));
  const utjA = sum(d.monthly.slice(-12).map((m) => m.utj));
  const delta = utjA > 0 ? Math.round(((utjP - utjA) / utjA) * 100) : null;
  const temuan: { judul: string; isi?: string; aksi?: string }[] = [
    { judul: `UTJ 12 bulan ke depan sekitar ${utjP}${delta === null ? "" : delta >= 0 ? `, naik ${delta}%` : `, turun ${Math.abs(delta)}%`} dari 12 bulan terakhir`, isi: `Akad sekitar ${akadP} unit dengan penerimaan Rp ${f1(akadP * d.netPrice)} miliar.`, aksi: delta !== null && delta <= -10 ? "cari tambahan UTJ lewat promo atau event sebelum angka ini terjadi." : undefined },
  ];
  if (d.stokHabis !== null && d.stokHabis !== undefined) temuan.push({ judul: `Stok Open habis di bulan ke-${d.stokHabis} (${labelPanjang(addMonths(d.end, d.stokHabis))})`, isi: "Pada laju proyeksi (UTJ dikurangi batal).", aksi: "siapkan order bangun, lihat rekomendasinya di Produk & Stok." });
  if (d.source !== "demo" && d.open > 0) temuan.push({ judul: `${d.open} berkas outstanding, potensi Rp ${f1(d.open * d.netPrice)} miliar`, isi: "UTJ yang belum akad dan belum batal.", aksi: "dorong penyelesaian berkas yang sedang diproses bank." });
  return (<><Nav active="/" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} /><main className="wrap stack"><p>{badge(d.source)}</p>
    {q.ok && <p className="ok">{q.ok}</p>}{q.err && <p className="err">{q.err}</p>}
    {admin && (sumberExcel()
      ? <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}><span>Sumber data: <b>{sumberExcel() === "Apps Script" ? "data dikirim skrip (Apps Script atau Office Script)" : `Excel di ${sumberExcel()}`}</b>, {sumberExcel() === "Apps Script" ? "dikirim saat skrip dijalankan" : "diperbarui otomatis di latar belakang"}{diperbarui ? <> (terakhir dibaca {diperbarui})</> : null}.</span>
          {sumberExcel() !== "Apps Script" && <form action="/api/sync" method="post"><button className="btn alt" type="submit">Sinkron Excel sekarang</button></form>}</div>
      : <p className="muted" style={{ fontSize: 13 }}>Sumber data: <b>file Excel yang diunggah</b> (diperbarui lewat menu /data setiap ada data baru).</p>)}
    <FilterBar opts={d.opts} cur={filter} metode={metode} terbaik={d.f.banding.terbaik} />
    {d.periodeAktif && <p className="warn">Proyeksi dan grafik mengikuti periode: dihitung hanya dari data {labelPenuh(d.periodeAktif.start)} s.d. {labelPenuh(d.periodeAktif.end)} ({d.periodeAktif.n} bulan), lalu diproyeksikan 12 bulan setelah {labelPenuh(d.periodeAktif.end)}.</p>}
    {d.filtered && <p className="warn">Filter aktif: proyeksi dihitung ulang dari {d.nTxn} UTJ saja. Sampel kecil, rentang tidak andal.</p>}
    {d.filtered && d.monthly.slice(-12).every((m) => m.utj === 0) && <p className="err">Tidak ada UTJ pada 12 bulan terakhir untuk filter ini (mungkin stok habis atau tidak dijual lagi). Proyeksi 0 hanya hasil hitungan, bukan ramalan.</p>}
    {capaian && <TargetCard c={capaian} />}
    <Dashboard metode={metode} monthly={d.monthly} rows={d.f.rows} netPrice={d.netPrice} divergent={d.f.trendDivergent} stok={d.stok} stokHabis={d.stokHabis} stokKurang={d.stokKurang} makro={d.makro} outstanding={d.open} />
    {ringkas && <div className="grid">
      <div className="card"><h2>Hasil UTJ sejauh ini</h2><Donat data={[{ label: "Akad", value: ringkas.funnel.akad }, { label: "Batal", value: ringkas.funnel.batal }, { label: "Masih proses", value: Math.max(0, ringkas.funnel.utj - ringkas.funnel.akad - ringkas.funnel.batal) }]} tengah={String(ringkas.funnel.utj)} sub="UTJ" />
        <p className="muted" style={{ fontSize: 12 }}>{Math.round((ringkas.funnel.akad / Math.max(1, ringkas.funnel.utj)) * 100)}% UTJ sudah akad, {Math.round((ringkas.funnel.batal / Math.max(1, ringkas.funnel.utj)) * 100)}% batal.</p></div>
      <div className="card"><h2>Tipe paling laku (akad)</h2><Donat data={ringkas.byType.slice(0, 5).map((t) => ({ label: t.tipe, value: t.akad }))} tengah={String(ringkas.funnel.akad)} sub="akad" />
        <p className="muted" style={{ fontSize: 12 }}>Lima tipe teratas dari seluruh riwayat penjualan.</p></div></div>}
    <section className="stack" aria-label="Temuan utama"><h2>Temuan utama</h2>{temuan.map((t) => <Temuan key={t.judul} judul={t.judul} isi={t.isi} aksi={t.aksi} />)}</section>
    <section className="stack"><h2>Lihat lebih dalam</h2>
      <div className="linkgrid">{LINK.map(([h, n, s]) => <Link key={h} href={h} className="linkcard"><b>{n}</b><span>{s}</span></Link>)}</div></section>
  </main></>);
}
