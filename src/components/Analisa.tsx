import type { marketingInsights } from "@/lib/marketing";
import { f1, labelBulan } from "@/lib/format";
import { Garis, BatangH } from "./Grafik";
type MK = ReturnType<typeof marketingInsights>;

/** Analisa hasil integrasi data marketing (LEADS, EVENT MARKETING): ringkasan, sumber, temuan dan tindakan. */
export function Analisa({ mk }: { mk: MK }) {
  const s = mk.stats;
  return (
    <div className="stack">
      <div className="kolom3">
        <div className="stack">
          <div className="card"><h2>Efektivitas marketing</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Periode {s.periode} ({s.jumlahBulan} bulan)</p>
            <table className="mini"><tbody>
              <tr><td>Biaya event</td><td className="n">Rp {f1(s.biayaJuta)} juta</td></tr>
              <tr><td>Leads</td><td className="n">{s.leads}</td></tr>
              <tr><td>UTJ</td><td className="n">{s.utj}</td></tr>
              <tr><td>Per lead</td><td className="n">{s.biayaPerLeadRibu === null ? "-" : `Rp ${f1(s.biayaPerLeadRibu)} ribu`}</td></tr>
              <tr><td>Per UTJ</td><td className="n">{s.biayaPerUtjJuta === null ? "-" : `Rp ${f1(s.biayaPerUtjJuta)} juta`}</td></tr>
              <tr><td>Leads tanpa status</td><td className="n">{f1(s.persenLeadsTanpaStatus)}%</td></tr></tbody></table>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Korelasi biaya–leads {s.korelasiBiayaLeads ?? "-"} dan biaya–UTJ {s.korelasiBiayaUtj ?? "-"} dari {s.jumlahBulan} bulan: pola awal, bukan sebab-akibat.</p></div>
          {mk.perBulan.length > 1 && <div className="card"><h2>Biaya event per bulan (Rp juta)</h2>
            <Garis labels={mk.perBulan.map((x) => labelBulan(x.bulan))} deret={[{ nama: "Biaya (jt)", nilai: mk.perBulan.map((x) => x.biaya / 1e6) }]} judul="Biaya event per bulan" lebar={380} tinggi={180} />
            <details style={{ marginTop: 8 }}><summary className="muted" style={{ fontSize: 12, cursor: "pointer" }}>Tabel per bulan</summary>
              <table style={{ marginTop: 6 }}><thead><tr><th>Bulan</th><th className="n">Biaya (jt)</th><th className="n">Leads</th><th className="n">UTJ</th></tr></thead>
                <tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelBulan(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table></details></div>}
        </div>
        <div className="stack">
          <div className="card"><h2>Sumber leads</h2>
            <table><thead><tr><th>Database</th><th className="n">Leads</th><th className="n">Survey/leads</th><th className="n">Porsi UTJ</th></tr></thead>
              <tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Porsi UTJ mencakup seluruh riwayat: bandingkan porsi, bukan konversi.</p></div>
          <div className="card"><h2>Leads yang jadi UTJ</h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Dicocokkan lewat nama dan marketing (atau nomor telepon bila ada kolom nomor di sheet PENJUALAN). Nama dan nomor tidak disimpan. Banyak lead hanya bernama depan atau tanpa nama, jadi angka ini batas bawah.</p>
            <table><thead><tr><th>Database</th><th className="n">Leads</th><th className="n">UTJ pasti</th><th className="n">Kemungkinan</th><th className="n">Konversi</th></tr></thead>
              <tbody>{mk.konversiLeads.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td><td className="n">{x.kira}</td><td className="n">{f1(x.persen)}%</td></tr>)}</tbody></table>
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Total: {mk.leadsJadiUtj.pasti} pasti dan {mk.leadsJadiUtj.kira} kemungkinan dari {s.leads} leads. Kualitas nomor telepon: {mk.telepon.ada ? `${f1(mk.telepon.persenValid)}% valid setelah diseragamkan ke format 62, ${mk.telepon.ganda} nomor ganda (${f1(mk.telepon.persenGanda)}%)` : "tidak ada data nomor"}.</p></div>
        </div>
        <div className="stack">
          <div className="card"><h2>Struktur biaya</h2>
            <BatangH baris={mk.kategori.map((x) => ({ label: x.kategori, value: +(x.biaya / 1e6).toFixed(1), catatan: `jt · ${f1(x.porsi)}%` }))} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Biaya event per kategori, Rp juta dan porsinya dari total.</p></div>
          {mk.perBulan.length > 1 && <div className="card"><h2>Leads per bulan</h2>
            <Garis labels={mk.perBulan.map((x) => labelBulan(x.bulan))} deret={[{ nama: "Leads", nilai: mk.perBulan.map((x) => x.leads) }]} judul="Leads per bulan" lebar={380} tinggi={180} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>UTJ per bulan ada di tabel per bulan (kolom kiri); angkanya jauh lebih kecil dari leads sehingga tidak digambar di grafik yang sama.</p></div>}
        </div>
      </div>
      <div className="card"><h2>Temuan dan tindakan marketing</h2>
        {mk.findings.length === 0 ? <p className="muted">Tidak ada temuan yang melewati ambang aturan pada periode ini.</p> : mk.findings.map((f, i) => (
          <div key={f.id} style={{ borderTop: i ? "1px solid #DEDDDB" : "none", padding: "8px 0" }}>
            <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 12 }}>· prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis (sampel kecil)" : "dari data"}</span>
            <div style={{ fontSize: 13 }}><b>Temuan:</b> {f.temuan}</div><div style={{ fontSize: 13 }}><b>Tindakan:</b> {f.tindakan}</div><div style={{ fontSize: 13 }}><b>Ukuran berhasil:</b> {f.ukuran}</div></div>))}</div>
    </div>
  );
}
