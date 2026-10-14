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
// Sorot angka (beserta satuannya) dan kata kunci penting supaya mudah dipindai.
const SOROT = /(Rp\s?[\d.,]+(?:\s?(?:miliar|juta|ribu))?|[+−]?\d[\d.,]*\s?(?:%|unit|UTJ|akad|bulan|hari|leads|poin|berkas)|\bhabis\b|\bkurang\b|\bnaik\b|\bturun\b|\bmeleset\b)/gi;
export function hl(t: React.ReactNode): React.ReactNode {
  if (typeof t === "string") return t.split(SOROT).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
  if (Array.isArray(t)) return t.map((x, i) => <span key={i}>{hl(x)}</span>);
  return t;
}
export const Hl = ({ t }: { t: React.ReactNode }) => <>{hl(t)}</>;
export const Note = ({ children }: { children: React.ReactNode }) => <p className="rp-note">{hl(children)}</p>;
export const Kpi = ({ l, v, s, a }: { l: string; v: React.ReactNode; s?: React.ReactNode; a?: boolean }) => (
  <div className={"rp-kpi" + (a ? " acc" : "")}><small>{l}</small><b>{v}</b>{s ? <span>{s}</span> : null}</div>
);
export const Kpis = ({ children }: { children: React.ReactNode }) => <div className="rp-kpis">{children}</div>;
