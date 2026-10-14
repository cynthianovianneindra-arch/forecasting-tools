import type { Filter } from "@/lib/insights";
import { labelPenuh } from "@/lib/format";
import { MetodeSelect } from "./Metode";
import type { Metode } from "@/lib/forecast";
interface Opts { tipe: string[]; agent: string[]; marketing: string[]; cluster: string[]; tahap: string[]; tahun: string[]; bulan: string[] }
const sel = (name: string, label: string, vals: string[], cur?: string) => (
  <label className="field">{label}
    <select name={name} defaultValue={cur ?? ""} className="inp" style={{ minWidth: 130 }}>
      <option value="">Semua</option>{vals.map((v) => <option key={v}>{v}</option>)}</select></label>
);
const bln = { minWidth: 160 } as const;
export function FilterBar({ opts, cur, metode, terbaik }: { opts: Opts; cur: Filter; metode: Metode; terbaik: Metode }) {
  if (!opts.tipe.length) return null;
  return (
    <form method="get" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      {sel("tahun", "Periode: tahun (pintasan)", opts.tahun, cur.tahun)}
<label className="field">Periode: dari bulan
        <select className="inp" name="dari" defaultValue={cur.dari ?? ""} style={bln}><option value="">Awal data</option>{opts.bulan.map((b) => <option key={b} value={b}>{labelPenuh(b)}</option>)}</select></label>
      <label className="field">sampai bulan
        <select className="inp" name="sampai" defaultValue={cur.sampai ?? ""} style={bln}><option value="">Akhir data</option>{opts.bulan.map((b) => <option key={b} value={b}>{labelPenuh(b)}</option>)}</select></label>
      {sel("cluster", "Cluster", opts.cluster, cur.cluster)}{sel("tahap", "Tahap", opts.tahap, cur.tahap)}{sel("tipe", "Tipe rumah", opts.tipe, cur.tipe)}{sel("agent", "Agent", opts.agent, cur.agent)}{sel("marketing", "Marketing", opts.marketing, cur.marketing)}
      <MetodeSelect metode={metode} terbaik={terbaik} />
      <button className="btn" type="submit">Terapkan</button><a className="btn alt" href="/">Reset filter</a>
    </form>
  );
}
