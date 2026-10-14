import { Nav, DEMO_BADGE } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { getData, f1, labelBulan, labelPanjang } from "@/lib/data";
export default async function Page({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  const { jenis = "bulanan" } = await searchParams;
  const d = getData();
  const r = d.f.rows;
  const sum = (k: "utj" | "akad") => r.reduce((s, x) => s + x[k], 0);
  const last12 = d.monthly.slice(-12);
  const bars = [...last12.map((m) => ({ label: labelBulan(m.bulan), utj: m.utj, akad: m.akad, proj: false })), ...r.map((x) => ({ label: labelBulan(x.bulan), utj: x.utj, akad: x.akad, proj: true, lo: x.utjLo, hi: x.utjHi }))];
  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint"><p>{DEMO_BADGE}</p><p className="muted">Pratinjau laporan {jenis}. Cetak ke PDF dari browser (Ctrl/Cmd+P, ukuran A4). Render PDF server-side dan narasi Claude (<code>/api/narasi</code>) belum dihubungkan ke semua halaman; versi ini baru memuat sampul, ringkasan, dan proyeksi.</p></div>
    <section className="page"><h1>Laporan Proyeksi Penjualan {jenis === "tahunan" ? "Tahunan" : "Bulanan"}</h1><p className="muted">Shaistanaya City · PT Neo Pudji Jaya</p>
      <table><tbody><tr><td>UTJ 12 bulan ke depan</td><td className="n">{f1(sum("utj"))}</td></tr><tr><td>Akad 12 bulan ke depan</td><td className="n">{f1(sum("akad"))}</td></tr><tr><td>Penerimaan (Rp miliar)</td><td className="n">{f1(sum("akad") * d.netPrice)}</td></tr></tbody></table></section>
    <section className="page"><h2>Proyeksi UTJ dan akad</h2><Chart bars={bars} title="Proyeksi UTJ dan akad" />
      <table><thead><tr><th>Periode</th><th className="n">UTJ (rentang)</th><th className="n">Akad</th><th className="n">Penerimaan (Rp M)</th></tr></thead><tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.utj)} ({f1(x.utjLo)}–{f1(x.utjHi)})</td><td className="n">{f1(x.akad)}</td><td className="n">{f1(x.akad * d.netPrice)}</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 24 }}>Keterbatasan data</h2><ul><li>Penjualan berfluktuasi; galat tipikal ±3 unit per bulan.</li><li>Variabel ekonomi hanya konteks; korelasi bulanan lemah (±0,2).</li><li>Versi ini memakai data demo, belum transaksi asli.</li></ul></section>
  </>);
}
