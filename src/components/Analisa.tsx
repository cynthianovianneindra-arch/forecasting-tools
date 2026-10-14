import type { marketingInsights } from "@/lib/marketing";
import { f1, labelBulan } from "@/lib/format";
type MK = ReturnType<typeof marketingInsights>;

/** Analisa hasil integrasi data marketing (LEADS, EVENT MARKETING): ringkasan, sumber, temuan dan tindakan. */
export function Analisa({ mk }: { mk: MK }) {
  const s = mk.stats;
  return (
    <div className="cards">
      <div className="card"><h2>Efektivitas marketing</h2>
        <p className="muted" style={{ fontSize: 12 }}>Periode {s.periode} ({s.jumlahBulan} bulan)</p>
        <table className="mini"><tbody>
          <tr><td>Biaya event</td><td className="n">Rp {f1(s.biayaJuta)} juta</td></tr>
          <tr><td>Leads</td><td className="n">{s.leads}</td></tr>
          <tr><td>UTJ</td><td className="n">{s.utj}</td></tr>
          <tr><td>Per lead</td><td className="n">{s.biayaPerLeadRibu === null ? "-" : `Rp ${f1(s.biayaPerLeadRibu)} ribu`}</td></tr>
          <tr><td>Per UTJ</td><td className="n">{s.biayaPerUtjJuta === null ? "-" : `Rp ${f1(s.biayaPerUtjJuta)} juta`}</td></tr>
          <tr><td>Leads tanpa status</td><td className="n">{f1(s.persenLeadsTanpaStatus)}%</td></tr></tbody></table>
        <table style={{ marginTop: 8 }}><thead><tr><th>Bulan</th><th className="n">Biaya (jt)</th><th className="n">Leads</th><th className="n">UTJ</th></tr></thead>
          <tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelBulan(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Korelasi biaya–leads {s.korelasiBiayaLeads ?? "-"} dan biaya–UTJ {s.korelasiBiayaUtj ?? "-"} dari {s.jumlahBulan} bulan: pola awal, bukan sebab-akibat.</p></div>
      <div className="card"><h2>Sumber leads</h2>
        <table><thead><tr><th>Database</th><th className="n">Leads</th><th className="n">Survey/leads</th><th className="n">Porsi UTJ</th></tr></thead>
          <tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Porsi UTJ mencakup seluruh riwayat: bandingkan porsi, bukan konversi.</p>
        <h2 style={{ marginTop: 12 }}>Struktur biaya</h2>
        <table><tbody>{mk.kategori.map((x) => <tr key={x.kategori}><td>{x.kategori}</td><td className="n">Rp {f1(x.biaya / 1e6)} jt ({f1(x.porsi)}%)</td></tr>)}</tbody></table></div>
      <div className="card" style={{ gridColumn: "1 / -1" }}><h2>Temuan dan tindakan marketing</h2>
        {mk.findings.length === 0 ? <p className="muted">Tidak ada temuan yang melewati ambang aturan pada periode ini.</p> : mk.findings.map((f, i) => (
          <div key={f.id} style={{ borderTop: i ? "1px solid #DEDDDB" : "none", padding: "8px 0" }}>
            <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 12 }}>· prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis (sampel kecil)" : "dari data"}</span>
            <div style={{ fontSize: 13 }}><b>Temuan:</b> {f.temuan}</div><div style={{ fontSize: 13 }}><b>Tindakan:</b> {f.tindakan}</div><div style={{ fontSize: 13 }}><b>Ukuran berhasil:</b> {f.ukuran}</div></div>))}</div>
    </div>
  );
}
