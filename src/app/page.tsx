import { Nav, badge } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { FilterBar } from "@/components/FilterBar";
import { Cards } from "@/components/Cards";
import { Analisa } from "@/components/Analisa";
import { getData } from "@/lib/data";
import { parseMetode } from "@/lib/forecast";
import { BandingMetodeCard } from "@/components/Metode";
import { rentangPeriode } from "@/lib/insights";
import { labelPenuh } from "@/lib/format";
import { TargetCard } from "@/components/TargetCard";
import { hitungCapaian } from "@/lib/target";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const filter = { tipe: q.tipe || undefined, agent: q.agent || undefined, marketing: q.marketing || undefined, cluster: q.cluster || undefined, tahap: q.tahap || undefined, tahun: q.tahun || undefined, dari: q.dari || undefined, sampai: q.sampai || undefined, bulan: q.bulan || undefined };
  const metode = parseMetode(q.metode);
  const d = await getData("kalender", filter, metode);
  const r = rentangPeriode(filter);
  const periode = r.dari || r.sampai ? (r.dari === r.sampai ? labelPenuh(r.dari!) : `${r.dari ? labelPenuh(r.dari) : "awal data"} s.d. ${r.sampai ? labelPenuh(r.sampai) : "akhir data"}`) : "seluruh periode";
  const capaian = !d.filtered && !d.periodeAktif && d.source !== "demo" ? hitungCapaian(d.targets, d.monthly, d.f.rows, d.end.slice(0, 4), d.end) : null;
  return (<><Nav active="/" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} /><main className="wrap stack"><p>{badge(d.source)}</p>
    <FilterBar opts={d.opts} cur={filter} metode={metode} terbaik={d.f.banding.terbaik} />
    {d.periodeAktif && <p className="warn">Proyeksi dan grafik mengikuti periode: dihitung hanya dari data {labelPenuh(d.periodeAktif.start)} s.d. {labelPenuh(d.periodeAktif.end)} ({d.periodeAktif.n} bulan), lalu diproyeksikan 12 bulan setelah {labelPenuh(d.periodeAktif.end)}.{d.periodeAktif.n < 12 ? " Periode kurang dari 12 bulan: rentang proyeksi diperkirakan dan kurang andal." : ""}{!d.stok && d.units ? " Kartu stok disembunyikan karena stok adalah kondisi terkini." : ""}</p>}
    {d.filtered && <p className="warn">Filter aktif: proyeksi dihitung ulang dari {d.nTxn} UTJ saja. Sampel kecil, rentang tidak andal.</p>}
    {d.filtered && d.monthly.slice(-12).every((m) => m.utj === 0) && <p className="err">Tidak ada UTJ pada 12 bulan terakhir untuk filter ini (mungkin stok habis atau tidak dijual lagi). Proyeksi 0 hanya hasil hitungan, bukan ramalan.</p>}
    {capaian && <TargetCard c={capaian} />}
    <Dashboard metode={metode} monthly={d.monthly} rows={d.f.rows} netPrice={d.netPrice} divergent={d.f.trendDivergent} stok={d.stok} stokHabis={d.stokHabis} stokKurang={d.stokKurang} makro={d.makro} outstanding={d.open} />
    <BandingMetodeCard banding={d.f.banding} metode={metode} origins={d.f.bt.origins} />
    {d.kartu && <section className="stack"><h2>Data aktual ({periode})</h2><Cards k={d.kartu} /></section>}
    {!d.mk && d.mkAda && <p className="muted">Tidak ada data marketing (leads dan biaya event) pada periode ini; data marketing tersedia mulai Okt 2025.</p>}
    {d.mk && <section className="stack"><h2>Analisa marketing ({periode})</h2><Analisa mk={d.mk} /></section>}</main></>);
}
