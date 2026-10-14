export function ReportPage({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="page">
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #24467C", paddingBottom: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{title}</h2><span className="muted" style={{ fontSize: 12 }}>Hlm {n} / 12</span>
      </div>
      {children}
      <p className="muted" style={{ fontSize: 11, marginTop: 24 }}>Semua angka dihitung oleh mesin forecast dari data penjualan; teks hanya merangkum angka tersebut.</p>
    </section>
  );
}
export const Note = ({ children }: { children: React.ReactNode }) => <p style={{ background: "#FCEBD2", color: "#7A4A00", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>{children}</p>;
