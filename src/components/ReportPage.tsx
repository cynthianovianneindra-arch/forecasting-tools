export function ReportPage({ n, total, title, children }: { n: number; total: number; title: string; children: React.ReactNode }) {
  return (
    <section className="page rp">
      <div className="rp-top"><span>Laporan Proyeksi Penjualan · Shaistanaya City</span><span>{String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}</span></div>
      <h2 className="rp-title">{title}</h2><span className="rp-bar" />
      {children}
      <div className="rp-foot">Semua angka dihitung mesin forecast dari data penjualan.</div>
    </section>
  );
}
export const Note = ({ children }: { children: React.ReactNode }) => <p className="rp-note">{children}</p>;
export const Kpi = ({ l, v, s, a }: { l: string; v: React.ReactNode; s?: React.ReactNode; a?: boolean }) => (
  <div className={"rp-kpi" + (a ? " acc" : "")}><small>{l}</small><b>{v}</b>{s ? <span>{s}</span> : null}</div>
);
export const Kpis = ({ children }: { children: React.ReactNode }) => <div className="rp-kpis">{children}</div>;
