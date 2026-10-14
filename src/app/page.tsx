import { Nav, badge } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { FilterBar } from "@/components/FilterBar";
import { Cards } from "@/components/Cards";
import { Analisa } from "@/components/Analisa";
import { getData } from "@/lib/data";
import { rentangPeriode } from "@/lib/insights";
import { labelPenuh } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const filter = { tipe: q.tipe || undefined, agent: q.agent || undefined, marketing: q.marketing || undefined, cluster: q.cluster || undefined, tahap: q.tahap || undefined, tahun: q.tahun || undefined, dari: q.dari || undefined, sampai: q.sampai || undefined, bulan: q.bulan || undefined };
  const d = await getData("kalender", filter);
  const r = rentangPeriode(filter);
  const periode = r.dari || r.sampai ? (r.dari === r.sampai ? labelPenuh(r.dari!) : `${r.dari ? labelPenuh(r.dari) : "awal data"} s.d. ${r.sampai ? labelPenuh(r.sampai) : "akhir data"}`) : "seluruh periode";
  return (<><Nav active="/" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} /><main className="wrap stack"><p>{badge(d.source)}</p>
    <FilterBar opts={d.opts} cur={filter} />
    {d.filtered && <p className="warn">Filter aktif: proyeksi dihitung ulang dari {d.nTxn} UTJ saja. Sampel kecil, rentang tidak andal.</p>}
    {d.filtered && d.monthly.slice(-12).every((m) => m.utj === 0) && <p className="err">Tidak ada UTJ pada 12 bulan terakhir untuk filter ini (mungkin stok habis atau tidak dijual lagi). Proyeksi 0 hanya hasil hitungan, bukan ramalan.</p>}
    <Dashboard monthly={d.monthly} rows={d.f.rows} netPrice={d.netPrice} divergent={d.f.trendDivergent} stok={d.stok} stokHabis={d.stokHabis} stokKurang={d.stokKurang} makro={d.makro} />
    {d.kartu && <section className="stack"><h2>Data aktual ({periode})</h2><Cards k={d.kartu} /></section>}
    {!d.mk && d.mkAda && <p className="muted">Tidak ada data marketing (leads dan biaya event) pada periode ini; data marketing tersedia mulai Okt 2025.</p>}
    {d.mk && <section className="stack"><h2>Analisa marketing ({periode})</h2><Analisa mk={d.mk} /></section>}</main></>);
}
