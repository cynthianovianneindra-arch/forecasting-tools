import { Nav, badge } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { ReportPage, Note } from "@/components/ReportPage";
import { getData, f1, labelBulan, labelPanjang } from "@/lib/data";
import { avgNetPrice, priceByType, ringkasanTeks } from "@/lib/laporan";
import { applyScenario, describeScenario, parseScenario } from "@/lib/whatif";
import { claudeConfigured, narasiLaporan } from "@/lib/claude";
import { marketingInsights } from "@/lib/marketing";
import { cards } from "@/lib/insights";

const th = (...c: string[]) => <thead><tr>{c.map((x, i) => <th key={x} className={i ? "n" : ""}>{x}</th>)}</tr></thead>;

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ jenis?: string; s?: string }> }) {
  const { jenis = "bulanan", s: sRaw } = await searchParams;
  const d = await getData();
  const txns = d.txns;
  const real = d.source !== "demo";
  const k = cards(txns);
  const pot = (e: number) => Math.round((e / Math.max(1, k.funnel.utj)) * 100);
  const r = d.f.rows, bt = d.f.bt;
  const net = (real && avgNetPrice(txns)) ? avgNetPrice(txns)! / 1e9 : d.netPrice;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const tot = { utj: sum(r.map((x) => x.utj)), akad: sum(r.map((x) => x.akad)), lo: sum(r.map((x) => x.utjLo)), hi: sum(r.map((x) => x.utjHi)), penerimaanM: sum(r.map((x) => x.akad)) * net };
  const last12 = d.monthly.slice(-12);
  const l12 = { utj: sum(last12.map((m) => m.utj)), akad: sum(last12.map((m) => m.akad)) };
  const bars = [...last12.map((m) => ({ label: labelBulan(m.bulan), utj: m.utj, akad: m.akad, proj: false })), ...r.map((x) => ({ label: labelBulan(x.bulan), utj: x.utj, akad: x.akad, proj: true, lo: x.utjLo, hi: x.utjHi, trend: x.trend }))];
  const q = [0, 1, 2, 3].map((i) => ({ q: `Kuartal ${i + 1} (${labelPanjang(r[i * 3].bulan)} – ${labelPanjang(r[i * 3 + 2].bulan)})`, utj: sum(r.slice(i * 3, i * 3 + 3).map((x) => x.utj)), akad: sum(r.slice(i * 3, i * 3 + 3).map((x) => x.akad)) }));
  const years = new Map<string, { utj: number; akad: number }>();
  for (const m of d.monthly) { const y = years.get(m.bulan.slice(0, 4)) ?? { utj: 0, akad: 0 }; y.utj += m.utj; y.akad += m.akad; years.set(m.bulan.slice(0, 4), y); }
  const skenario = parseScenario(sRaw);
  const sk = skenario ? applyScenario(r, skenario) : null;
  const skTot = sk ? { utj: sum(sk.rows.map((x) => x.utj)), akad: sum(sk.rows.map((x) => x.akad)), pen: sum(sk.rows.map((x) => x.penerimaan)) } : null;
  const ringkas = ringkasanTeks(tot, k, l12);
  const batalPct = pot(k.funnel.batal);
  const mk = d.marketing && d.marketing.leads.length ? marketingInsights(d.marketing, txns) : null;
  const narasi = await narasiLaporan({
    marketing: mk ? { ...mk.stats, kategori: mk.kategori.slice(0, 5), temuan: mk.findings.map((f) => ({ judul: f.judul, temuan: f.temuan, label: f.label })) } : null,
    periode: `${labelPanjang(r[0].bulan)} - ${labelPanjang(r[11].bulan)}`, jenis,
    proyeksi12Bulan: { utj: Math.round(tot.utj), utjRendah: Math.round(tot.lo), utjTinggi: Math.round(tot.hi), akad: Math.round(tot.akad), penerimaanMiliarRp: +tot.penerimaanM.toFixed(1) },
    duabelasBulanTerakhir: l12,
    kuartal: q.map((x) => ({ utj: Math.round(x.utj), akad: Math.round(x.akad) })),
    ujiMundur: { titik: bt.origins, galatUtjRataRata: +bt.utjMae13.toFixed(1), galatAkadTotal3Bln: +bt.akadMaeTotal3.toFixed(1) },
    funnel: { ...k.funnel, persenBatal: batalPct }, alasanBatalTercatat: k.alasan,
    bank: k.bank.map((b) => ({ bank: b.bank, berkas: b.berkas, persenApprove: b.approve, rataHari: b.hari === null ? null : Math.round(b.hari) })),
    peringatan: ["Variabel ekonomi belum tersambung; korelasi bulanan dengan UTJ lemah (sekitar 0,2)", "Alasan batal baru tercatat sebagian", "Sampel per agent kecil"],
  });
  const harga = priceByType(txns);

  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint"><p>{badge(d.source)}</p><p className="muted">Laporan {jenis}. Cetak ke PDF dari browser (Ctrl/Cmd+P, A4, tanpa margin). narasi Claude: {claudeConfigured() ? (narasi ? "aktif" : "key ada, tetapi narasi gagal divalidasi; memakai teks templat") : "nonaktif (ANTHROPIC_API_KEY belum diset); memakai teks templat"}.</p></div>

    <section className="page"><h1>Laporan Proyeksi Penjualan {jenis === "tahunan" ? "Tahunan" : "Bulanan"}</h1><p className="muted">Shaistanaya City · PT Neo Pudji Jaya · data s.d. {labelPanjang(d.end)}</p>
      <table><tbody><tr><td>UTJ 12 bulan ke depan</td><td className="n">{f1(tot.utj)} ({f1(tot.lo)}–{f1(tot.hi)})</td></tr><tr><td>Akad 12 bulan ke depan</td><td className="n">{f1(tot.akad)}</td></tr><tr><td>Penerimaan (Rp miliar)</td><td className="n">{f1(tot.penerimaanM)}</td></tr></tbody></table>
      <h2 style={{ marginTop: 24 }}>Isi laporan</h2><ol className="muted"><li>Ringkasan manajemen</li><li>Kinerja 12 bulan terakhir</li><li>Proyeksi UTJ</li><li>Akad dan penerimaan</li><li>Funnel dan pembatalan</li><li>Tipe rumah dan harga</li><li>Agent dan sumber leads</li><li>Proses bank dan kondisi ekonomi</li><li>Efektivitas marketing</li><li>Temuan dan tindakan marketing</li><li>Skenario, cara angka dibuat, keterbatasan</li></ol></section>

    <ReportPage n={2} title="Ringkasan manajemen">{narasi ? <><p>{narasi.ringkasan}</p><p className="muted" style={{ fontSize: 11 }}>Ditulis Claude dari angka mesin; setiap angka di teks sudah dicek ada di data.</p></> : ringkas.map((t) => <p key={t}>{t}</p>)}
      <Note>Penerimaan = akad × harga bersih rata-rata (Rp {f1(net)} miliar{real ? ", dari akad nyata" : ", angka SPEC"}). Jadwal penerimaan bertahap belum dimodelkan.</Note></ReportPage>

    <ReportPage n={3} title="Kinerja 12 bulan terakhir"><Chart bars={bars.slice(0, 12)} title="12 bulan terakhir" />
      <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{l12.utj}</b></td><td className="n"><b>{l12.akad}</b></td></tr></tbody></table>
      {jenis === "tahunan" && <><h2 style={{ marginTop: 16 }}>Perbandingan antar tahun</h2><table>{th("Tahun", "UTJ", "Akad")}<tbody>{[...years].map(([y, v]) => <tr key={y}><td>{y}{y === "2022" ? " (mulai Apr)" : y === d.end.slice(0, 4) ? " (s.d. " + labelBulan(d.end) + ")" : ""}</td><td className="n">{v.utj}</td><td className="n">{v.akad}</td></tr>)}</tbody></table></>}</ReportPage>

    <ReportPage n={4} title="Proyeksi UTJ">{narasi && <p>{narasi.proyeksi}</p>}<Chart bars={bars} title="Proyeksi UTJ dan akad" />
      <table>{th("Bulan", "UTJ", "Rentang 10–90%")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.utj)}</td><td className="n">{f1(x.utjLo)}–{f1(x.utjHi)}</td></tr>)}</tbody></table>
      <table style={{ marginTop: 12 }}>{th("Kuartal", "UTJ", "Akad")}<tbody>{q.map((x) => <tr key={x.q}><td>{x.q}</td><td className="n">{f1(x.utj)}</td><td className="n">{f1(x.akad)}</td></tr>)}</tbody></table>
      {d.f.trendDivergent && <Note>Garis tren berjauhan dari proyeksi utama: arah penjualan mungkin berubah.</Note>}</ReportPage>

    <ReportPage n={5} title="Akad dan penerimaan"><p>Akad diproyeksikan dari UTJ yang sedang berjalan ({d.open} UTJ belum akad atau batal) ditambah UTJ baru, memakai peluang akad dan batal per umur UTJ dari data historis.</p>
      <table>{th("Bulan", "Akad", "Penerimaan (Rp M)")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.akad)}</td><td className="n">{f1(x.akad * net)}</td></tr>)}</tbody></table>
      <p className="muted">Uji mundur (26 titik): galat total akad 3 bulan {f1(bt.akadMaeTotal3)} unit, dibanding {f1(bt.akadMaeMa12)} unit bila memakai rata-rata 12 bulan.</p></ReportPage>

    <ReportPage n={6} title="Funnel penjualan dan pembatalan">{narasi && <p>{narasi.funnel}</p>}<table>{th("Tahap", "Jumlah", "% dari UTJ")}<tbody>
      {[["UTJ", k.funnel.utj], ["SPR & PPJB", k.funnel.spr], ["Akad", k.funnel.akad], ["Pencairan", k.funnel.cair], ["Batal", k.funnel.batal]].map(([a, b]) => <tr key={a as string}><td>{a}</td><td className="n">{b}</td><td className="n">{pot(b as number)}%</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Alasan batal</h2><p className="muted">Alasan tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus batal.</p>
      <table><tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table>
      <Note>Alasan batal baru terisi sebagian, jadi pola di atas bersifat hipotesis.</Note></ReportPage>

    <ReportPage n={7} title="Tipe rumah dan harga"><table>{th("Tipe", "UTJ", "Akad")}<tbody>{k.byType.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table>
      {harga.length > 0 && <><h2 style={{ marginTop: 16 }}>Harga bersih rata-rata (akad)</h2><table>{th("Tipe", "Akad", "Rata-rata (Rp M)", "Porsi nilai")}<tbody>{harga.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.akad}</td><td className="n">{(x.rata / 1e9).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="n">{x.porsi}%</td></tr>)}</tbody></table></>}</ReportPage>

    <ReportPage n={8} title="Agent dan sumber leads"><table>{th("Agent", "UTJ", "Akad", "Konversi")}<tbody>{k.byAgent.map((x) => <tr key={x.agent}><td>{x.agent}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td><td className="n">{x.konversi}%</td></tr>)}</tbody></table>
      <Note>Sampel per agent kecil; konversi dibaca sebagai hipotesis. Data leads (sheet LEADS) baru ada sejak Okt 2025 dan belum diimpor; kolom Asal Leads di PENJUALAN hanya terisi sebagian.</Note></ReportPage>

    <ReportPage n={9} title="Proses bank dan kondisi ekonomi">{narasi && <p>{narasi.bank}</p>}<table>{th("Bank", "Berkas", "Approve", "Rata-rata hari")}<tbody>{k.bank.map((x) => <tr key={x.bank}><td>{x.bank}</td><td className="n">{x.berkas}</td><td className="n">{x.approve}%</td><td className="n">{x.hari === null ? "-" : f1(x.hari)}</td></tr>)}</tbody></table>
      <Note>Variabel ekonomi (IHSG, emas, inflasi, BI Rate) belum tersambung. Pada uji data historis, korelasinya dengan UTJ bulanan lemah (sekitar 0,2), sehingga hanya dipakai sebagai konteks, bukan penggerak proyeksi.</Note></ReportPage>

    <ReportPage n={10} title="Efektivitas marketing">{!mk ? <Note>Data LEADS dan EVENT MARKETING belum ada di unggahan ini.</Note> : <>
      {narasi && <p>{narasi.marketing}</p>}
      <p className="muted">Periode {mk.stats.periode} ({mk.stats.jumlahBulan} bulan): biaya Rp {f1(mk.stats.biayaJuta)} juta, {mk.stats.leads} leads, {mk.stats.utj} UTJ. Rp {mk.stats.biayaPerLeadRibu === null ? "-" : f1(mk.stats.biayaPerLeadRibu)} ribu per lead dan Rp {mk.stats.biayaPerUtjJuta === null ? "-" : f1(mk.stats.biayaPerUtjJuta)} juta per UTJ.</p>
      <table>{th("Bulan", "Biaya (Rp juta)", "Leads", "UTJ")}<tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Struktur biaya</h2><table>{th("Kategori", "Rp juta", "Porsi")}<tbody>{mk.kategori.map((x) => <tr key={x.kategori}><td>{x.kategori}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{f1(x.porsi)}%</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Porsi leads, survey, dan UTJ per sumber</h2><table>{th("Sumber (database)", "Porsi leads", "Survey per leads", "Porsi UTJ")}<tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table>
      <Note>Biaya dan leads hanya ada untuk {mk.stats.jumlahBulan} bulan; korelasi biaya-leads {mk.stats.korelasiBiayaLeads ?? "-"} dan biaya-UTJ {mk.stats.korelasiBiayaUtj ?? "-"} adalah pola awal, bukan sebab-akibat. Porsi UTJ per sumber mencakup seluruh riwayat, jadi bandingkan porsi, bukan konversi. Instagram dan Facebook tidak dibedakan organik atau berbayar.</Note></>}</ReportPage>
    <ReportPage n={11} title="Temuan dan tindakan marketing">{!mk ? <Note>Menunggu data marketing.</Note> : mk.findings.length === 0 ? <p>Tidak ada temuan yang melewati ambang aturan pada data ini.</p> : mk.findings.map((f, i) => (
      <div key={f.id} style={{ border: "1px solid #E1E5EB", borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 11 }}>· Prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis (sampel kecil)" : "dari data"}</span>
        <p style={{ margin: "6px 0" }}><b>Temuan:</b> {f.temuan}</p><p style={{ margin: "6px 0" }}><b>Tindakan:</b> {f.tindakan}</p><p style={{ margin: "6px 0" }}><b>Ukuran berhasil:</b> {f.ukuran}</p></div>))}
      <Note>Data yang perlu ditambahkan: kode kampanye atau organik-berbayar per lead, status wajib diisi, alasan batal wajib diisi, dan ID event agar biaya, leads, UTJ bisa dikaitkan.</Note></ReportPage>

    <ReportPage n={12} title="Skenario, cara angka dibuat, dan keterbatasan">
      <h2>Skenario what-if</h2>
      {!skenario || !sk || !skTot ? <p className="muted">Tidak ada skenario yang dipilih. Buat di menu Simulasi lalu pilih "Cetak skenario di laporan".</p> : <>
        <table>{th("Variabel diubah", "Nilai")}<tbody>{describeScenario(skenario).map((x) => <tr key={x.label}><td>{x.label}</td><td className="n">{x.nilai}</td></tr>)}</tbody></table>
        <table style={{ marginTop: 8 }}>{th("12 bulan", "Dasar", "Skenario", "Selisih")}<tbody>
          <tr><td>UTJ</td><td className="n">{f1(tot.utj)}</td><td className="n">{f1(skTot.utj)}</td><td className="n">{f1(skTot.utj - tot.utj)}</td></tr>
          <tr><td>Akad</td><td className="n">{f1(tot.akad)}</td><td className="n">{f1(skTot.akad)}</td><td className="n">{f1(skTot.akad - tot.akad)}</td></tr>
          <tr><td>Penerimaan (Rp M)</td><td className="n">{f1(tot.penerimaanM)}</td><td className="n">{f1(skTot.pen)}</td><td className="n">{f1(skTot.pen - tot.penerimaanM)}</td></tr></tbody></table>
        {sk.stockWarning && <Note>Peringatan: UTJ skenario melebihi stok unit yang tersedia dijual.</Note>}
        <Note>Skenario memakai koefisien ilustrasi yang belum dikalibrasi dari data; baca sebagai gambaran arah, bukan ramalan. Pengaruh variabel ekonomi lemah pada data historis. Proyeksi dasar di halaman lain tidak berubah.</Note></>}
      <h2 style={{ marginTop: 16 }}>Cara angka dibuat</h2><p>UTJ = rata-rata 12 bulan terakhir; akad = pipeline UTJ; rentang dari kuantil galat uji mundur ({bt.origins} titik uji, galat UTJ rata-rata {f1(bt.utjMae13)} unit/bulan).</p>
      <h2>Keterbatasan</h2><ul><li>Penjualan berfluktuasi; satu angka tidak menjamin hasil.</li><li>Variabel ekonomi hanya konteks.</li><li>Skenario di menu Simulasi memakai koefisien ilustrasi dan belum dikalibrasi.</li><li>Penerimaan memakai harga bersih rata-rata, bukan jadwal termin.</li></ul>
      <h2>Langkah berikutnya</h2><ul><li>Lengkapi alasan batal dan status leads di sumber data.</li><li>Impor sheet UNIT (stok nyata) dan sambungkan data ekonomi; kalibrasi koefisien skenario dari data.</li></ul></ReportPage>
  </>);
}
