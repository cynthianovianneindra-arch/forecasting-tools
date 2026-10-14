import { Nav, badge } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { ReportPage, Note, Kpi, Kpis } from "@/components/ReportPage";
import { getData, f1, labelBulan, labelPanjang } from "@/lib/data";
import { tampilLabel } from "@/lib/format";
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
  const bars = [...last12.map((m) => ({ label: labelBulan(m.bulan), showLabel: tampilLabel(m.bulan), utj: m.utj, akad: m.akad, proj: false })), ...r.map((x) => ({ label: labelBulan(x.bulan), showLabel: tampilLabel(x.bulan), utj: x.utjInt, akad: x.akadInt, proj: true, lo: x.utjLoInt, hi: x.utjHiInt, trend: x.trend }))];
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
  const P: string[] = ["Sampul", "Daftar isi", "Ringkasan eksekutif", "Kinerja 12 bulan terakhir", "Proyeksi, akad, dan penerimaan", "Funnel dan pembatalan", "Stok dan kapasitas", "Tipe, harga, dan agent", "Proses bank dan ekonomi", "Efektivitas marketing", "Temuan marketing", "Skenario what-if", "Rekomendasi prioritas", "Metode dan keterbatasan"];
  const T = P.length, no = (j: string) => P.findIndex((x) => x === j) + 1;
  const pg = (j: string, children: React.ReactNode) => <ReportPage key={j} n={no(j)} total={T} title={j}>{children}</ReportPage>;
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const selisih = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs 12 bln terakhir` : undefined);
  const MAKS_BUTIR = 3;
  const kartu = (b: { judul: string; butir: string[] }) => <div key={b.judul} className="rp-card"><b>{b.judul}</b><ul>{b.butir.slice(0, MAKS_BUTIR).map((x) => <li key={x}>{x}</li>)}</ul></div>;

  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint"><p>{badge(d.source)}</p><p className="muted">Laporan {jenis}, {T} halaman. Cetak ke PDF dari browser (Ctrl/Cmd+P, A4, tanpa margin, aktifkan "Background graphics"). Narasi Claude: {!claudeConfigured() ? "nonaktif (ANTHROPIC_API_KEY belum diset)" : narasi ? "aktif (tersimpan; membuka ulang tidak memanggil Claude lagi)" : buatNarasi === "1" ? "gagal dibuat atau gagal divalidasi" : <>belum dibuat. <a href={linkBuat}><b>Buat narasi dengan Claude</b></a> (memanggil Claude satu kali, hasilnya disimpan)</>}.</p></div>

    <section className="page cover">
      <div className="c-top"><span className="c-brand">Shaistanaya City · PT Neo Pudji Jaya</span>
        <h1>Laporan<br />Proyeksi<br />Penjualan</h1><span className="c-bar" />
        <p className="c-sub">{jenis === "tahunan" ? "Tahunan" : "Bulanan"} · proyeksi {periodeProyeksi}</p></div>
      <div className="c-bottom"><h4>INFORMASI</h4>
        <div className="c-grid">
          <div><b>Tanggal cetak</b><br />{tanggal}</div><div><b>Data penjualan sampai</b><br />{labelPanjang(d.end)}</div>
          <div><b>Metode UTJ</b><br />Exponential smoothing</div><div><b>Metode akad</b><br />Pipeline UTJ (peluang akad dan batal per umur)</div>
          <div><b>Sumber data</b><br />{real ? "Penjualan, unit, leads, event, ekonomi" : "Data demo"}</div><div><b>Pembulatan</b><br />UTJ dan akad dibulatkan ke bawah</div>
        </div></div></section>

    <section className="page rp">
      <div className="rp-top"><span>Laporan Proyeksi Penjualan · Shaistanaya City</span><span>02 / {String(T).padStart(2, "0")}</span></div>
      <h2 className="rp-title">Daftar isi</h2><span className="rp-bar" />
      <div className="toc">
        <div className="toc-side">
          <div><small>UTJ 12 bulan ke depan</small><b>{tot.utj}</b><span>kisaran {tot.lo}–{tot.hi}</span></div>
          <div><small>Akad</small><b>{tot.akad}</b><span>unit</span></div>
          <div><small>Penerimaan</small><b>Rp {f1(tot.pen)} M</b><span>akad × harga bersih rata-rata</span></div>
          <div><small>Periode</small><span style={{ fontSize: 12, fontWeight: 700 }}>{periodeProyeksi}</span></div>
        </div>
        <div>{P.map((x, i) => i < 2 ? null : <div key={x} className="toc-row"><i>{String(i - 1).padStart(2, "0")}</i><span>{x}</span><em>hlm {String(i + 1).padStart(2, "0")}</em></div>)}</div>
      </div>
      <div className="rp-foot">Semua angka dihitung mesin forecast dari data penjualan.</div></section>

    {pg("Ringkasan eksekutif", <>
      <Kpis>
        <Kpi a l="UTJ proyeksi 12 bln" v={tot.utj} s={`kisaran ${tot.lo}–${tot.hi}`} />
        <Kpi l="Akad proyeksi" v={tot.akad} s={selisih(tot.akad, l12.akad)} />
        <Kpi l="Penerimaan" v={`Rp ${f1(tot.pen)} M`} s={`harga bersih Rp ${net2} M`} />
        <Kpi l="UTJ 12 bln terakhir" v={l12.utj} s={`akad ${l12.akad}`} />
        {d.stok && <Kpi l="Stok Open" v={d.stok.open} s={d.stokHabis === null ? "cukup 12 bulan" : `habis bulan ke-${d.stokHabis}`} />}
      </Kpis>
      {narasi?.ringkasan && <p className="rp-quote">{narasi.ringkasan}</p>}
      <h3>Sorotan</h3>
      <div className="rp-cols">{detail.map(kartu)}</div></>)}

    {pg("Kinerja 12 bulan terakhir", <>
      <Chart bars={bars.slice(0, 12)} title="12 bulan terakhir" />
      <div className="rp-cols" style={{ marginTop: 10 }}>
        <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.slice(0, 6).map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}</tbody></table>
        <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.slice(6).map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{l12.utj}</b></td><td className="n"><b>{l12.akad}</b></td></tr></tbody></table></div>
      {jenis === "tahunan" && <><h3>Antar tahun</h3><table>{th("Tahun", "UTJ", "Akad")}<tbody>{[...years].map(([y, v]) => <tr key={y}><td>{y}{y === "2022" ? " (mulai Apr)" : y === d.end.slice(0, 4) ? " (s.d. " + labelBulan(d.end) + ")" : ""}</td><td className="n">{v.utj}</td><td className="n">{v.akad}</td></tr>)}</tbody></table></>}</>)}

    {pg("Proyeksi, akad, dan penerimaan", <>
      <Kpis><Kpi a l="UTJ 12 bln" v={tot.utj} s={`kisaran ${tot.lo}–${tot.hi}`} /><Kpi l="Akad 12 bln" v={tot.akad} /><Kpi l="Penerimaan" v={`Rp ${f1(tot.pen)} M`} /></Kpis>
      <Chart bars={bars} title="Proyeksi UTJ dan akad" />
      <table style={{ marginTop: 8 }}>{th("Bulan", "UTJ", "Kisaran 10–90%", "Akad", "Penerimaan (Rp M)")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{x.utjInt}</td><td className="n">{x.utjLoInt}–{x.utjHiInt}</td><td className="n">{x.akadInt}</td><td className="n">{f1(x.akadInt * net)}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{tot.utj}</b></td><td className="n"><b>{tot.lo}–{tot.hi}</b></td><td className="n"><b>{tot.akad}</b></td><td className="n"><b>{f1(tot.pen)}</b></td></tr></tbody></table>
      <div className="rp-cols"><table style={{ marginTop: 8 }}>{th("Kuartal", "UTJ", "Akad")}<tbody>{q.map((x, i) => <tr key={x.q}><td>Kuartal {i + 1}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table>
        <p className="rp-note" style={{ alignSelf: "end" }}>Uji mundur {bt.origins} titik: galat UTJ {f1(bt.utjMae13)} unit/bulan (rata-rata 12 bln: {f1(bt.utjMae13Ma12)}); galat akad 3 bln {f1(bt.akadMaeTotal3)} (rata-rata 12 bln: {f1(bt.akadMaeMa12)}).</p></div>
      {d.f.trendDivergent && <Note>Garis tren berjauhan dari proyeksi utama: arah penjualan mungkin berubah.</Note>}</>)}

    {pg("Funnel dan pembatalan", <>
      {[["UTJ", k.funnel.utj], ["SPR & PPJB", k.funnel.spr], ["Akad", k.funnel.akad], ["Pencairan", k.funnel.cair], ["Batal", k.funnel.batal]].map(([a, b]) => (
        <div key={a as string} className="rp-fbar"><span className="l">{a}</span><span className="t"><i style={{ width: `${Math.min(100, pot(b as number))}%`, background: a === "Batal" ? "#C0584F" : undefined }} /></span><span className="v"><b>{b}</b> ({pot(b as number)}%)</span></div>))}
      <h3>Alasan batal</h3>
      <table>{th("Alasan", "Kasus")}<tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table>
      <Note>Alasan tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus batal; pola bersifat hipotesis.</Note></>)}

    {pg("Stok dan kapasitas", !d.stok ? <Note>Data unit (sheet UNIT) belum ada di unggahan ini.</Note> : <>
      <Kpis><Kpi a l="Stok Open" v={d.stok.open} s="tersedia dijual" /><Kpi l="Belum dibangun" v={d.stok.belumDibangun} s="status Close" /><Kpi l="Total unit" v={d.stok.total} /><Kpi l="Stok habis" v={d.stokHabis === null ? "-" : `bulan ${d.stokHabis}`} s={d.stokKurang ? `kurang ${d.stokKurang} unit` : "cukup 12 bulan"} /></Kpis>
      <h3>Per tipe</h3>
      <table>{th("Tipe", "Open", "Belum dibangun")}<tbody>{stockByType(d.stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{d.stok.open}</b></td><td className="n"><b>{d.stok.belumDibangun}</b></td></tr></tbody></table>
      <Note>Pemakaian unit = UTJ dikurangi batal (batal mengembalikan unit ke stok).</Note></>)}

    {pg("Tipe, harga, dan agent", <>
      <div className="rp-cols">
        <div><h3>Penjualan per tipe</h3><table>{th("Tipe", "UTJ", "Akad")}<tbody>{k.byType.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table></div>
        <div><h3>Harga bersih (akad)</h3>{harga.length > 0 ? <table>{th("Tipe", "Akad", "Rp M", "Porsi")}<tbody>{harga.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.akad}</td><td className="n">{(x.rata / 1e9).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="n">{x.porsi}%</td></tr>)}</tbody></table> : <p className="muted" style={{ fontSize: 12 }}>Data harga belum ada.</p>}</div></div>
      <h3>Performa agent</h3>
      <table>{th("Agent", "UTJ", "Akad", "Konversi")}<tbody>{k.byAgent.map((x) => <tr key={x.agent}><td>{x.agent}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td><td className="n">{x.konversi}%</td></tr>)}</tbody></table>
      <Note>Sampel per agent kecil; konversi dibaca sebagai hipotesis.</Note></>)}

    {pg("Proses bank dan ekonomi", <>
      <h3>Proses bank</h3>
      <table>{th("Bank", "Berkas", "Approve", "Rata-rata hari")}<tbody>{k.bank.map((x) => <tr key={x.bank}><td>{x.bank}</td><td className="n">{x.berkas}</td><td className="n">{x.approve}%</td><td className="n">{x.hari === null ? "-" : f1(x.hari)}</td></tr>)}</tbody></table>
      <h3>Indikator ekonomi</h3>
      {d.makro ? <><table>{th("Indikator", "Data terakhir", "Nilai", "Korelasi UTJ")}<tbody>{d.makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.terakhir ?? "-"}</td><td className="n">{m.nilaiTerakhir === null ? "-" : m.nilaiTerakhir.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td><td className="n">{m.korelasi === null ? "-" : m.korelasi.toLocaleString("id-ID")}</td></tr>)}</tbody></table>
      <Note>Korelasi dengan UTJ lemah: hanya konteks, bukan penggerak proyeksi.</Note></> : <Note>Data ekonomi belum ada di unggahan ini.</Note>}</>)}

    {pg("Efektivitas marketing", !mk ? <Note>Data LEADS dan EVENT MARKETING belum ada di unggahan ini.</Note> : <>
      <Kpis><Kpi a l="Biaya event (Rp)" v={`${f1(mk.stats.biayaJuta)} jt`} s={mk.stats.periode} /><Kpi l="Leads" v={mk.stats.leads} /><Kpi l="UTJ" v={mk.stats.utj} /><Kpi l="Per lead" v={mk.stats.biayaPerLeadRibu === null ? "-" : `Rp ${f1(mk.stats.biayaPerLeadRibu)} rb`} /><Kpi l="Per UTJ" v={mk.stats.biayaPerUtjJuta === null ? "-" : `Rp ${f1(mk.stats.biayaPerUtjJuta)} jt`} /></Kpis>
      <table>{th("Bulan", "Biaya (Rp jt)", "Leads", "UTJ")}<tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table>
      <div className="rp-cols">
        <div><h3>Struktur biaya</h3><table>{th("Kategori", "Rp jt", "Porsi")}<tbody>{mk.kategori.map((x) => <tr key={x.kategori}><td>{x.kategori}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{f1(x.porsi)}%</td></tr>)}</tbody></table></div>
        <div><h3>Per sumber leads</h3><table>{th("Sumber", "Leads", "Survey", "UTJ")}<tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table></div></div>
      <Note>Data hanya {mk.stats.jumlahBulan} bulan; korelasi biaya-leads {mk.stats.korelasiBiayaLeads ?? "-"}, biaya-UTJ {mk.stats.korelasiBiayaUtj ?? "-"} adalah pola awal, bukan sebab-akibat.</Note></>)}

    {pg("Temuan marketing", !mk ? <Note>Menunggu data marketing.</Note> : <>{mk.findings.length === 0 ? <p>Tidak ada temuan yang melewati ambang aturan pada data ini.</p> : mk.findings.map((f, i) => (
      <div key={f.id} className="rp-card" style={{ marginBottom: 10 }}>
        <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 10.5 }}>· prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis" : "dari data"}</span>
        <ul><li><b>Temuan:</b> {f.temuan}</li><li><b>Tindakan:</b> {f.tindakan}</li><li><b>Ukuran berhasil:</b> {f.ukuran}</li></ul></div>))}</>)}

    {pg("Skenario what-if", !skenario || !an ? <p className="muted">Tidak ada skenario dipilih. Buat di menu Simulasi, lalu pilih "Cetak skenario di laporan".</p> : <>
      <Kpis><Kpi a l="UTJ skenario" v={an.totals.utjScn} s={`${an.totals.utjScn - an.totals.utjBase >= 0 ? "+" : ""}${an.totals.utjScn - an.totals.utjBase} vs dasar`} /><Kpi l="Akad skenario" v={an.totals.akadScn} s={`${an.totals.akadScn - an.totals.akadBase >= 0 ? "+" : ""}${an.totals.akadScn - an.totals.akadBase} vs dasar`} /><Kpi l="Penerimaan" v={`Rp ${f1(an.totals.penScn)} M`} s={`dasar Rp ${f1(an.totals.penBase)} M`} /></Kpis>
      <div className="rp-cols">
        <div><h3>Variabel diubah</h3><table>{th("Variabel", "Nilai")}<tbody>{describeScenario(skenario, refData.ref).map((x) => <tr key={x.label}><td>{x.label}</td><td className="n">{x.nilai}</td></tr>)}</tbody></table></div>
        <div><h3>Pengaruh per kelompok</h3><table>{th("Kelompok", "UTJ 12 bln")}<tbody>{an.kontribusi.map((x) => <tr key={x.kelompok}><td>{x.kelompok}</td><td className="n">{x.selisihUtj > 0 ? "+" : ""}{x.selisihUtj}</td></tr>)}</tbody></table></div></div>
      <h3>Analisis</h3>
      <ul style={{ paddingLeft: 18, margin: 0 }}>{an.ringkasan.map((x) => <li key={x} style={{ fontSize: 12, marginBottom: 3 }}>{x}</li>)}<li style={{ fontSize: 12 }}><b>Stok:</b> {an.stok}</li></ul>
      <Note>Koefisien skenario masih ilustrasi (belum dikalibrasi). Proyeksi dasar di halaman lain tidak berubah.</Note></>)}

    {pg("Rekomendasi prioritas", <>
      {narasi?.rekomendasi && <p className="rp-quote">{narasi.rekomendasi}</p>}
      {rekom.length === 0 ? <p className="muted">Tidak ada rekomendasi yang melewati ambang aturan pada data ini.</p> : <table>{th("Prioritas", "Tindakan dan alasan")}<tbody>{rekom.map((x, i) => <tr key={i}><td style={{ width: 70 }}><b>{x.prioritas}</b></td><td style={{ fontSize: 12 }}><b>{x.tindakan}</b><br /><span className="muted">{x.alasan}</span></td></tr>)}</tbody></table>}</>)}

    {pg("Metode dan keterbatasan", <>
      {narasi?.risiko && <p className="rp-quote">{narasi.risiko}</p>}
      <div className="rp-cols">
        <div><h3>Cara angka dibuat</h3><ul style={{ paddingLeft: 16, fontSize: 12 }}>
          <li>UTJ: exponential smoothing atas UTJ bulanan, dibulatkan ke bawah.</li>
          <li>Akad: pipeline UTJ (peluang akad dan batal per umur UTJ).</li>
          <li>Kisaran 10–90%: kuantil galat uji mundur ({bt.origins} titik).</li>
          <li>Penerimaan: akad × harga bersih rata-rata.</li>
          <li>Stok: UTJ dikurangi batal dibanding unit Open.</li>
          <li>Skenario: pengali sederhana dengan koefisien ilustrasi.</li></ul></div>
        <div><h3>Keterbatasan</h3><ul style={{ paddingLeft: 16, fontSize: 12 }}>
          <li>Penjualan berfluktuasi; satu angka tidak menjamin hasil.</li>
          <li>Variabel ekonomi hanya konteks (korelasi lemah).</li>
          <li>Data marketing baru sejak Okt 2025.</li>
          <li>Alasan batal dan status leads baru terisi sebagian.</li>
          <li>Penerimaan memakai harga rata-rata, bukan jadwal termin.</li></ul></div></div>
      <h3>Langkah berikutnya</h3>
      <ul style={{ paddingLeft: 16, fontSize: 12 }}><li>Lengkapi alasan batal dan status leads.</li><li>Kalibrasi koefisien skenario setelah data event, promo, dan harga cukup.</li><li>Rencanakan order bangun unit Close agar stok tidak membatasi penjualan.</li></ul></>)}
  </>);
}
