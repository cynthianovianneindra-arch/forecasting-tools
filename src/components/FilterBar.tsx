import type { Filter } from "@/lib/insights";
interface Opts { tipe: string[]; agent: string[]; marketing: string[]; cluster: string[]; tahap: string[]; tahun: string[] }
const sel = (name: string, label: string, vals: string[], cur?: string) => (
  <label style={{ fontSize: 12, color: "#5A6473", display: "flex", flexDirection: "column", gap: 4 }}>{label}
    <select name={name} defaultValue={cur ?? ""} style={{ minHeight: 44, minWidth: 130, borderRadius: 8, border: "1px solid #E1E5EB", padding: "0 8px", fontSize: 14, color: "#141B26" }}>
      <option value="">Semua</option>{vals.map((v) => <option key={v}>{v}</option>)}</select></label>
);
export function FilterBar({ opts, cur }: { opts: Opts; cur: Filter }) {
  if (!opts.tipe.length) return null;
  return (
    <form method="get" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      {sel("tahun", "Periode (kartu)", opts.tahun, cur.tahun)}{sel("cluster", "Cluster", opts.cluster, cur.cluster)}{sel("tahap", "Tahap", opts.tahap, cur.tahap)}{sel("tipe", "Tipe rumah", opts.tipe, cur.tipe)}{sel("agent", "Agent", opts.agent, cur.agent)}{sel("marketing", "Marketing", opts.marketing, cur.marketing)}
      <button className="btn" type="submit">Terapkan</button><a className="btn alt" href="/">Reset filter</a>
    </form>
  );
}
