import { Nav, badge } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { ReportPage, Note } from "@/components/ReportPage";
import { getData, f1, labelBulan, labelPanjang } from "@/lib/data";
import { stockByType } from "@/lib/stock";
import { avgNetPrice, priceByType, rekomendasiDari, ringkasanDetail, RingkasInput } from "@/lib/laporan";
import { describeScenario, parseScenario } from "@/lib/whatif";
import { analisisSkenario } from "@/lib/analisis";
import { referensiDari } from "@/lib/referensi";
import { cariNarasi, claudeConfigured, narasiLaporan } from "@/lib/claude";
import { marketingInsights } from "@/lib/marketing";
import { cards } from "@/lib/insights";

const th = (...c: string[]) => <thead><tr>{c.map((x, i) => <th key={x} className={i ? "n" : ""}>{x}</th>)}</tr></thead>;
const Cara = ({ children }: { children: React.ReactNode }) => <p className="muted" style={{ fontSize: 12 }}><b>Cara membaca:</b> {children}</p>;
const Narasi = ({ teks }: { teks?: string }) => (teks ? <p>{teks}</p> : null);

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ jenis?: string; s?: string; narasi?: string }> }) {
  const { jenis = "bulanan", s: sRaw, narasi: buatNarasi } = await searchParams;
  const d = await getData();
  const txns = d.txns;
  const k = cards(txns);
  const pot = (e: number) => Math.round((e / Math.max(1, k.funnel.utj)) * 100);
  const r = d.f.rows, bt = d.f.bt;
  const refData = referensiDari(d);
  const net = refData.netPriceMiliar;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const half = Math.floor(Math.sqrt(sum(r.map((x) => ((x.utjHiInt - x.utjLoInt) / 2) ** 2))));
  const utjTot = sum(r.map((x) => x.utjInt)), akadTot = sum(r.map((x) => x.akadInt));
  const tot = { utj: utjTot, akad: akadTot, lo: Math.max(0, utjTot - half), hi: utjTot + half, pen: akadTot * net };
  const last12 = d.monthly.slice(-12);
  const l12 = { utj: sum(last12.map((m) => m.utj)), akad: sum(last12.map((m) => m.akad)) };
  const bars = [...last12.map((m) => ({ label: labelBulan(m.bulan), utj: m.utj, akad: m.akad, proj: false })), ...r.map((x) => ({ label: labelBulan(x.bulan), utj: x.utjInt, akad: x.akadInt, proj: true, lo: x.utjLoInt, hi: x.utjHiInt, trend: x.trend }))];
  const q = [0, 1, 2, 3].map((i) => ({ q: `Kuartal ${i + 1} (${labelPanjang(r[i * 3].bulan)} – ${labelPanjang(r[i * 3 + 2].bulan)})`, utj: sum(r.slice(i * 3, i * 3 + 3).map((x) => x.utjInt)), akad: sum(r.slice(i * 3, i * 3 + 3).map((x) => x.akadInt)) }));
  const years = new Map<string, { utj: number; akad: number }>();
  for (const m of d.monthly) { const y = years.get(m.bulan.slice(0, 4)) ?? { utj: 0, akad: 0 }; y.utj += m.utj; y.akad += m.akad; years.set(m.bulan.slice(0, 4), y); }
  const mk = d.mk ?? (d.marketing && d.marketing.leads.length ? marketingInsights(d.marketing, txns) : null);
  const periodeProyeksi = `${labelPanjang(r[0].bulan)} – ${labelPanjang(r[11].bulan)}`;

  const inp: RingkasInput = {
    jenis, periodeProyeksi, akhirData: labelPanjang(d.end), tot, l12, bt, k, mk, makro: d.makro, trendBerubah: d.f.trendDivergent,
    stok: d.stok ? { open: d.stok.open, belumDibangun: d.stok.belumDibangun, total: d.stok.total, perTipe: d.stok.perTipe, belumDibangunPerTipe: d.stok.belumDibangunPerTipe, habis: d.stokHabis, kurang: d.stokKurang } : null,
  };
  const detail = ringkasanDetail(inp);
  const rekom = rekomendasiDari(inp);

  const skenario = parseScenario(sRaw);
  const an = skenario ? analisisSkenario({ base: r, s: skenario, ref: refData.ref, stokOpen: d.stok?.open ?? 0, belumDibangunPerTipe: d.stok?.belumDibangunPerTipe ?? [], netPriceMiliar: net, korelasiEkonomi: refData.korelasi }) : null;

  // Claude hanya dipanggil bila tombol "Buat narasi" ditekan (?narasi=1) dan belum ada narasi tersimpan untuk data yang sama.
  const inputNarasi = {
    periode: periodeProyeksi, jenis, dataSampai: labelPanjang(d.end),
    proyeksi12Bulan: { utj: tot.utj, utjRendah: tot.lo, utjTinggi: tot.hi, akad: tot.akad, penerimaanMiliarRp: +tot.pen.toFixed(1) },
    duabelasBulanTerakhir: l12, kuartal: q.map((x) => ({ utj: x.utj, akad: x.akad })),
    ujiMundur: { titik: bt.origins, galatUtjRataRata: +bt.utjMae13.toFixed(1), galatUtjRataRata12Bln: +bt.utjMae13Ma12.toFixed(1), galatAkadTotal3Bln: +bt.akadMaeTotal3.toFixed(1) },
    funnel: { ...k.funnel, persenBatal: pot(k.funnel.batal) }, alasanBatalTercatat: k.alasan,
    bank: k.bank.map((b) => ({ bank: b.bank, berkas: b.berkas, persenApprove: b.approve, rataHari: b.hari === null ? null : Math.round(b.hari) })),
    stok: d.stok ? { unitOpen: d.stok.open, unitBelumDibangun: d.stok.belumDibangun, totalUnit: d.stok.total, bulanStokHabis: d.stokHabis, kekuranganUnit: d.stokKurang } : null,
    ekonomi: d.makro ? d.makro.map((m) => ({ indikator: m.indikator, korelasiDenganUtj: m.korelasi, bulanTerakhir: m.terakhir, nilai: m.nilaiTerakhir })) : null,
    marketing: mk ? { ...mk.stats, kategori: mk.kategori.slice(0, 5), temuan: mk.findings.map((f) => ({ judul: f.judul, temuan: f.temuan, label: f.label })) } : null,
    ringkasanMesin: detail, rekomendasiMesin: rekom,
    peringatan: ["Korelasi bulanan variabel ekonomi dengan UTJ lemah; hanya konteks, bukan penggerak proyeksi", "Alasan batal baru tercatat sebagian", "Sampel per agent kecil", "UTJ dan akad dibulatkan ke bawah per bulan"],
  };
  const narasi = buatNarasi === "1" ? await narasiLaporan(inputNarasi) : await cariNarasi(inputNarasi);
  const linkBuat = `/laporan?${new URLSearchParams({ jenis, ...(sRaw ? { s: sRaw } : {}), narasi: "1" }).toString()}`;
  const harga = priceByType(txns);
  const net2 = net.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const real = d.source !== "demo";

  // Daftar halaman: nomor halaman dan daftar isi dibuat dari urutan ini.
  const P: { judul: string; isi: string }[] = [
    { judul: "Sampul", isi: "Angka utama dan informasi laporan" },
    { judul: "Daftar isi", isi: "Isi laporan dan nomor halaman" },
    { judul: "Ringkasan manajemen: hasil utama dan kinerja", isi: "Proyeksi 12 bulan, perbandingan dengan 12 bulan terakhir, akurasi metode, funnel" },
    { judul: "Ringkasan manajemen: stok, marketing, ekonomi, rekomendasi", isi: "Stok dan kapasitas, marketing, kondisi ekonomi, risiko, rekomendasi prioritas" },
    { judul: "Kinerja 12 bulan terakhir", isi: "Grafik dan tabel bulanan UTJ dan akad" },
    { judul: "Proyeksi UTJ", isi: "Grafik proyeksi, tabel per bulan beserta kisaran, ringkasan per kuartal" },
    { judul: "Akad dan penerimaan", isi: "Proyeksi akad dari pipeline UTJ dan penerimaan per bulan" },
    { judul: "Funnel penjualan dan pembatalan", isi: "Tahapan UTJ sampai pencairan dan alasan batal" },
    { judul: "Stok dan kapasitas penjualan", isi: "Stok Open, unit belum dibangun, kebutuhan unit per tipe" },
    { judul: "Tipe rumah dan harga", isi: "Penjualan per tipe dan harga bersih rata-rata" },
    { judul: "Agent dan sumber leads", isi: "Performa kanal penjualan" },
    { judul: "Proses bank dan kondisi ekonomi", isi: "Persetujuan dan durasi bank, indikator ekonomi sebagai konteks" },
    { judul: "Efektivitas marketing", isi: "Biaya, leads, UTJ per bulan, struktur biaya, sumber leads" },
    { judul: "Temuan dan tindakan marketing", isi: "Temuan berbasis aturan, tindakan, ukuran berhasil" },
    { judul: "Skenario what-if dan analisis", isi: "Skenario dari menu Simulasi beserta analisisnya" },
    { judul: "Cara angka dibuat, keterbatasan, langkah berikutnya", isi: "Metodologi, keterbatasan data, tindak lanjut" },
  ];
  const T = P.length, no = (j: string) => P.findIndex((x) => x.judul === j) + 1;
  const pg = (j: string, children: React.ReactNode) => <ReportPage key={j} n={no(j)} total={T} title={j}>{children}</ReportPage>;
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const blok = (b: { judul: string; butir: string[] }) => <div key={b.judul}><h2 style={{ marginTop: 12 }}>{b.judul}</h2><ul style={{ margin: "4px 0", paddingLeft: 20 }}>{b.butir.map((x) => <li key={x} style={{ fontSize: 13, marginBottom: 3 }}>{x}</li>)}</ul></div>;

  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint"><p>{badge(d.source)}</p><p className="muted">Laporan {jenis}, {T} halaman. Cetak ke PDF dari browser (Ctrl/Cmd+P, A4, tanpa margin). Narasi Claude: {!claudeConfigured() ? "nonaktif (ANTHROPIC_API_KEY belum diset); memakai teks dari mesin" : narasi ? "aktif (tersimpan; membuka ulang tidak memanggil Claude lagi)" : buatNarasi === "1" ? "gagal dibuat atau gagal divalidasi; memakai teks dari mesin" : <>belum dibuat; memakai teks dari mesin. <a href={linkBuat}><b>Buat narasi dengan Claude</b></a> (memanggil Claude satu kali, hasilnya disimpan)</>}.</p></div>

    <section className="page"><h1>Laporan Proyeksi Penjualan {jenis === "tahunan" ? "Tahunan" : "Bulanan"}</h1><p className="muted">Shaistanaya City · PT Neo Pudji Jaya</p>
      <h2 style={{ marginTop: 24 }}>Angka utama proyeksi 12 bulan ({periodeProyeksi})</h2>
      <table><tbody><tr><td>UTJ</td><td className="n">{tot.utj} unit (kisaran {tot.lo}–{tot.hi})</td></tr><tr><td>Akad</td><td className="n">{tot.akad} unit</td></tr><tr><td>Penerimaan</td><td className="n">Rp {f1(tot.pen)} miliar</td></tr></tbody></table>
      <h2 style={{ marginTop: 24 }}>Informasi laporan</h2>
      <table><tbody>
        <tr><td>Jenis laporan</td><td className="n">{jenis === "tahunan" ? "Tahunan (dengan perbandingan antar tahun)" : "Bulanan"}</td></tr>
        <tr><td>Tanggal cetak</td><td className="n">{tanggal}</td></tr>
        <tr><td>Data penjualan sampai</td><td className="n">{labelPanjang(d.end)}</td></tr>
        <tr><td>Sumber data</td><td className="n">{real ? "Data penjualan, unit, leads, event, dan indikator ekonomi" : "Data demo"}</td></tr>
        <tr><td>Metode UTJ</td><td className="n">Exponential smoothing</td></tr>
        <tr><td>Metode akad</td><td className="n">Pipeline UTJ (peluang akad dan batal per umur UTJ)</td></tr>
        <tr><td>Pembulatan</td><td className="n">UTJ dan akad dibulatkan ke bawah per bulan</td></tr>
        <tr><td>Jumlah halaman</td><td className="n">{T}</td></tr></tbody></table>
      <Note>Semua angka dihitung oleh mesin forecast dari data penjualan; teks narasi hanya merangkum angka tersebut dan setiap angkanya diperiksa terhadap data.</Note></section>

    {pg("Daftar isi", <><table>{th("Halaman", "Bagian")}<tbody>{P.map((x, i) => <tr key={x.judul}><td className="n" style={{ width: 70, textAlign: "left" }}>{i + 1}</td><td><b>{x.judul}</b><br /><span className="muted" style={{ fontSize: 12 }}>{x.isi}</span></td></tr>)}</tbody></table></>)}

    {pg("Ringkasan manajemen: hasil utama dan kinerja", <>
      <Narasi teks={narasi?.ringkasan} />{narasi && <p className="muted" style={{ fontSize: 11 }}>Narasi ditulis Claude dari angka mesin; setiap angka di teks sudah dicek ada di data.</p>}
      {blok(detail[0])}{blok(detail[1])}
      <Note>Penerimaan = akad × harga bersih rata-rata (Rp {net2} miliar{real ? ", dari akad nyata" : ", angka acuan"}). Jadwal penerimaan bertahap belum dimodelkan.</Note></>)}

    {pg("Ringkasan manajemen: stok, marketing, ekonomi, rekomendasi", <>
      {detail.slice(2).map(blok)}
      <h2 style={{ marginTop: 12 }}>Rekomendasi prioritas</h2>
      <Narasi teks={narasi?.rekomendasi} />
      {rekom.length === 0 ? <p className="muted">Tidak ada rekomendasi yang melewati ambang aturan pada data ini.</p> : <table>{th("Prioritas", "Tindakan dan alasan")}<tbody>{rekom.map((x, i) => <tr key={i}><td style={{ width: 80 }}><b>{x.prioritas}</b></td><td style={{ fontSize: 13 }}><b>{x.tindakan}</b><br /><span className="muted">{x.alasan}</span></td></tr>)}</tbody></table>}</>)}

    {pg("Kinerja 12 bulan terakhir", <><Chart bars={bars.slice(0, 12)} title="12 bulan terakhir" />
      <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{l12.utj}</b></td><td className="n"><b>{l12.akad}</b></td></tr></tbody></table>
      <Cara>batang biru adalah UTJ dan oranye adalah akad. Akad tertinggal dari UTJ karena sebagian UTJ baru menjadi akad beberapa bulan kemudian, dan sebagian batal.</Cara>
      {jenis === "tahunan" && <><h2 style={{ marginTop: 16 }}>Perbandingan antar tahun</h2><table>{th("Tahun", "UTJ", "Akad")}<tbody>{[...years].map(([y, v]) => <tr key={y}><td>{y}{y === "2022" ? " (mulai Apr)" : y === d.end.slice(0, 4) ? " (s.d. " + labelBulan(d.end) + ")" : ""}</td><td className="n">{v.utj}</td><td className="n">{v.akad}</td></tr>)}</tbody></table></>}</>)}

    {pg("Proyeksi UTJ", <><Narasi teks={narasi?.proyeksi} /><Chart bars={bars} title="Proyeksi UTJ dan akad" />
      <table>{th("Bulan", "UTJ", "Kisaran 10–90%")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{x.utjInt}</td><td className="n">{x.utjLoInt}–{x.utjHiInt}</td></tr>)}</tbody></table>
      <table style={{ marginTop: 12 }}>{th("Kuartal", "UTJ", "Akad")}<tbody>{q.map((x) => <tr key={x.q}><td>{x.q}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table>
      <Cara>latar abu-abu adalah kisaran UTJ yang masuk akal (10–90%); makin jauh bulannya, makin lebar. Garis hijau adalah tren regresi linear sebagai pembanding.</Cara>
      {d.f.trendDivergent && <Note>Garis tren berjauhan dari proyeksi utama: arah penjualan mungkin berubah.</Note>}</>)}

    {pg("Akad dan penerimaan", <><p>Akad diproyeksikan dari UTJ yang sedang berjalan ({d.open} UTJ belum akad atau batal) ditambah UTJ baru, memakai peluang akad dan batal per umur UTJ dari data historis. Penerimaan dihitung dari akad × harga bersih rata-rata Rp {net2} miliar.</p>
      <table>{th("Bulan", "Akad", "Penerimaan (Rp M)")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{x.akadInt}</td><td className="n">{f1(x.akadInt * net)}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{tot.akad}</b></td><td className="n"><b>{f1(tot.pen)}</b></td></tr></tbody></table>
      <p className="muted">Uji mundur ({bt.origins} titik): galat total akad 3 bulan {f1(bt.akadMaeTotal3)} unit, dibanding {f1(bt.akadMaeMa12)} unit bila memakai rata-rata 12 bulan. Untuk UTJ, galat 1–3 bulan exponential smoothing {f1(bt.utjMae13)} unit dibanding {f1(bt.utjMae13Ma12)} unit untuk rata-rata 12 bulan.</p></>)}

    {pg("Funnel penjualan dan pembatalan", <><Narasi teks={narasi?.funnel} /><table>{th("Tahap", "Jumlah", "% dari UTJ")}<tbody>
      {[["UTJ", k.funnel.utj], ["SPR & PPJB", k.funnel.spr], ["Akad", k.funnel.akad], ["Pencairan", k.funnel.cair], ["Batal", k.funnel.batal]].map(([a, b]) => <tr key={a as string}><td>{a}</td><td className="n">{b}</td><td className="n">{pot(b as number)}%</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Alasan batal</h2><p className="muted">Alasan tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus batal.</p>
      <table><tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table>
      <Note>Alasan batal baru terisi sebagian, jadi pola di atas bersifat hipotesis.</Note></>)}

    {pg("Stok dan kapasitas penjualan", !d.stok ? <Note>Data unit (sheet UNIT) belum ada di unggahan ini.</Note> : <>
      <Narasi teks={narasi?.stok} />
      <table><tbody><tr><td>Stok tersedia dijual (Open)</td><td className="n">{d.stok.open} unit</td></tr><tr><td>Belum dibangun (Close)</td><td className="n">{d.stok.belumDibangun} unit</td></tr><tr><td>Total unit</td><td className="n">{d.stok.total} unit</td></tr>
        <tr><td>Stok Open habis</td><td className="n">{d.stokHabis === null ? "tidak dalam 12 bulan" : `bulan ke-${d.stokHabis}`}</td></tr><tr><td>Kekurangan unit 12 bulan</td><td className="n">{d.stokKurang ? `${d.stokKurang} unit` : "tidak ada"}</td></tr></tbody></table>
      <h2 style={{ marginTop: 16 }}>Stok per tipe</h2><table>{th("Tipe", "Open (tersedia)", "Belum dibangun")}<tbody>{stockByType(d.stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{d.stok.open}</b></td><td className="n"><b>{d.stok.belumDibangun}</b></td></tr></tbody></table>
      <Cara>pemakaian unit dihitung sebagai UTJ dikurangi batal, karena UTJ yang batal mengembalikan unitnya ke stok. Status: Open = tersedia dijual, Close = belum dibangun, Proses = sudah dipesan, Sold dan Margal = terjual.</Cara></>)}

    {pg("Tipe rumah dan harga", <><table>{th("Tipe", "UTJ", "Akad")}<tbody>{k.byType.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table>
      {harga.length > 0 && <><h2 style={{ marginTop: 16 }}>Harga bersih rata-rata (akad)</h2><table>{th("Tipe", "Akad", "Rata-rata (Rp M)", "Porsi nilai")}<tbody>{harga.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.akad}</td><td className="n">{(x.rata / 1e9).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="n">{x.porsi}%</td></tr>)}</tbody></table></>}</>)}

    {pg("Agent dan sumber leads", <><table>{th("Agent", "UTJ", "Akad", "Konversi")}<tbody>{k.byAgent.map((x) => <tr key={x.agent}><td>{x.agent}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td><td className="n">{x.konversi}%</td></tr>)}</tbody></table>
      <Note>Sampel per agent kecil; konversi dibaca sebagai hipotesis. Sumber leads rinci ada di halaman efektivitas marketing.</Note></>)}

    {pg("Proses bank dan kondisi ekonomi", <><Narasi teks={narasi?.bank} /><table>{th("Bank", "Berkas", "Approve", "Rata-rata hari")}<tbody>{k.bank.map((x) => <tr key={x.bank}><td>{x.bank}</td><td className="n">{x.berkas}</td><td className="n">{x.approve}%</td><td className="n">{x.hari === null ? "-" : f1(x.hari)}</td></tr>)}</tbody></table>
      {d.makro ? <><h2 style={{ marginTop: 16 }}>Kondisi ekonomi (konteks)</h2><table>{th("Indikator", "Data terakhir", "Nilai", "Korelasi dengan UTJ")}<tbody>{d.makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.terakhir ?? "-"}</td><td className="n">{m.nilaiTerakhir === null ? "-" : m.nilaiTerakhir.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td><td className="n">{m.korelasi === null ? "-" : m.korelasi.toLocaleString("id-ID")}</td></tr>)}</tbody></table>
      <Note>Korelasi bulanan dengan UTJ lemah (semuanya di bawah 0,3 dalam nilai mutlak) dan data baru 4 tahun, jadi hanya dipakai sebagai konteks, bukan penggerak proyeksi.</Note></> : <Note>Data ekonomi belum ada di unggahan ini (sheet INSTRUMEN EKONOMI).</Note>}</>)}

    {pg("Efektivitas marketing", !mk ? <Note>Data LEADS dan EVENT MARKETING belum ada di unggahan ini.</Note> : <>
      <Narasi teks={narasi?.marketing} />
      <p className="muted">Periode {mk.stats.periode} ({mk.stats.jumlahBulan} bulan): biaya Rp {f1(mk.stats.biayaJuta)} juta, {mk.stats.leads} leads, {mk.stats.utj} UTJ. Rp {mk.stats.biayaPerLeadRibu === null ? "-" : f1(mk.stats.biayaPerLeadRibu)} ribu per lead dan Rp {mk.stats.biayaPerUtjJuta === null ? "-" : f1(mk.stats.biayaPerUtjJuta)} juta per UTJ.</p>
      <table>{th("Bulan", "Biaya (Rp juta)", "Leads", "UTJ")}<tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Struktur biaya</h2><table>{th("Kategori", "Rp juta", "Porsi")}<tbody>{mk.kategori.map((x) => <tr key={x.kategori}><td>{x.kategori}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{f1(x.porsi)}%</td></tr>)}</tbody></table>
      <h2 style={{ marginTop: 16 }}>Porsi leads, survey, dan UTJ per sumber</h2><table>{th("Sumber (database)", "Porsi leads", "Survey per leads", "Porsi UTJ")}<tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table>
      <Note>Biaya dan leads hanya ada untuk {mk.stats.jumlahBulan} bulan; korelasi biaya-leads {mk.stats.korelasiBiayaLeads ?? "-"} dan biaya-UTJ {mk.stats.korelasiBiayaUtj ?? "-"} adalah pola awal, bukan sebab-akibat. Porsi UTJ per sumber mencakup seluruh riwayat, jadi bandingkan porsi, bukan konversi.</Note></>)}

    {pg("Temuan dan tindakan marketing", !mk ? <Note>Menunggu data marketing.</Note> : <>{mk.findings.length === 0 ? <p>Tidak ada temuan yang melewati ambang aturan pada data ini.</p> : mk.findings.map((f, i) => (
      <div key={f.id} style={{ border: "1px solid #E1E5EB", borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 11 }}>· Prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis (sampel kecil)" : "dari data"}</span>
        <p style={{ margin: "6px 0" }}><b>Temuan:</b> {f.temuan}</p><p style={{ margin: "6px 0" }}><b>Tindakan:</b> {f.tindakan}</p><p style={{ margin: "6px 0" }}><b>Ukuran berhasil:</b> {f.ukuran}</p></div>))}
      <Note>Data yang perlu ditambahkan: kode kampanye atau organik-berbayar per lead, status wajib diisi, alasan batal wajib diisi, dan ID event agar biaya, leads, UTJ bisa dikaitkan.</Note></>)}

    {pg("Skenario what-if dan analisis", !skenario || !an ? <p className="muted">Tidak ada skenario yang dipilih. Buat di menu Simulasi lalu pilih "Cetak skenario di laporan".</p> : <>
      <table>{th("Variabel diubah", "Nilai")}<tbody>{describeScenario(skenario, refData.ref).map((x) => <tr key={x.label}><td>{x.label}</td><td className="n">{x.nilai}</td></tr>)}</tbody></table>
      <table style={{ marginTop: 8 }}>{th("12 bulan", "Dasar", "Skenario", "Selisih")}<tbody>
        <tr><td>UTJ</td><td className="n">{an.totals.utjBase}</td><td className="n">{an.totals.utjScn}</td><td className="n">{an.totals.utjScn - an.totals.utjBase}</td></tr>
        <tr><td>Akad</td><td className="n">{an.totals.akadBase}</td><td className="n">{an.totals.akadScn}</td><td className="n">{an.totals.akadScn - an.totals.akadBase}</td></tr>
        <tr><td>Penerimaan (Rp M)</td><td className="n">{f1(an.totals.penBase)}</td><td className="n">{f1(an.totals.penScn)}</td><td className="n">{f1(an.totals.penScn - an.totals.penBase)}</td></tr></tbody></table>
      <h2 style={{ marginTop: 14 }}>Analisis skenario</h2>
      {an.ringkasan.map((x) => <p key={x} style={{ margin: "4px 0", fontSize: 13 }}>{x}</p>)}
      <table style={{ marginTop: 8 }}>{th("Kelompok variabel", "Pengaruh pada UTJ 12 bulan")}<tbody>{an.kontribusi.map((x) => <tr key={x.kelompok}><td>{x.kelompok}</td><td className="n">{x.selisihUtj > 0 ? "+" : ""}{x.selisihUtj}</td></tr>)}</tbody></table>
      <p style={{ margin: "8px 0", fontSize: 13 }}><b>Stok:</b> {an.stok}</p>
      <ul style={{ paddingLeft: 20 }}>{an.peringatan.map((x) => <li key={x} style={{ fontSize: 12 }}>{x}</li>)}</ul>
      <Note>Proyeksi dasar di halaman lain tidak berubah oleh skenario.</Note></>)}

    {pg("Cara angka dibuat, keterbatasan, langkah berikutnya", <>
      <Narasi teks={narasi?.risiko} />
      <h2>Cara angka dibuat</h2><ul style={{ paddingLeft: 20, fontSize: 13 }}>
        <li>UTJ: exponential smoothing (level) atas deret UTJ bulanan; UTJ dibulatkan ke bawah per bulan karena berupa cacah unit.</li>
        <li>Akad: pipeline UTJ. Peluang akad dan batal dihitung per umur UTJ dari data historis, lalu diterapkan ke UTJ yang sedang berjalan dan UTJ baru hasil proyeksi; akad dibulatkan ke bawah per bulan.</li>
        <li>Kisaran 10–90%: kuantil galat uji mundur ({bt.origins} titik uji, galat UTJ rata-rata {f1(bt.utjMae13)} unit per bulan); bila riwayat terlalu pendek dipakai rumus cadangan.</li>
        <li>Penerimaan: akad × harga bersih rata-rata. Stok: UTJ dikurangi batal dibanding unit berstatus Open.</li>
        <li>Skenario: pengali sederhana pada proyeksi dasar dengan koefisien ilustrasi yang belum dikalibrasi.</li></ul>
      <h2 style={{ marginTop: 12 }}>Keterbatasan</h2><ul style={{ paddingLeft: 20, fontSize: 13 }}><li>Penjualan berfluktuasi; satu angka tidak menjamin hasil.</li><li>Variabel ekonomi hanya konteks (korelasi lemah).</li><li>Data marketing baru sejak Okt 2025; temuan marketing bersifat hipotesis.</li><li>Alasan batal dan status leads baru terisi sebagian.</li><li>Penerimaan memakai harga bersih rata-rata, bukan jadwal termin.</li></ul>
      <h2 style={{ marginTop: 12 }}>Langkah berikutnya</h2><ul style={{ paddingLeft: 20, fontSize: 13 }}><li>Lengkapi alasan batal dan status leads di sumber data.</li><li>Kalibrasi koefisien skenario dari data event, promo, dan harga setelah datanya cukup.</li><li>Rencanakan order bangun dari unit Close agar stok tidak menjadi pembatas penjualan.</li></ul></>)}
  </>);
}
