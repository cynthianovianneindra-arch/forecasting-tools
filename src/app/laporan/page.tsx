import { Nav, badge } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { ReportPage, Note, Kpi, Kpis, Hl } from "@/components/ReportPage";
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
  const P: string[] = ["Sampul", "Daftar isi", "Ringkasan", "Penjualan 12 bulan terakhir", "Perkiraan 12 bulan ke depan", "Dari UTJ sampai akad", "Stok rumah", "Tipe, harga, dan agent", "Proses bank dan ekonomi", "Hasil marketing", "Temuan marketing", "Skenario \"bagaimana jika\"", "Rekomendasi", "Cara menghitung dan batasannya"];
  const T = P.length, no = (j: string) => P.findIndex((x) => x === j) + 1;
  const pg = (j: string, children: React.ReactNode) => <ReportPage key={j} n={no(j)} total={T} title={j}>{children}</ReportPage>;
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const selisih = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs 12 bln terakhir` : undefined);
  const MAKS_BUTIR = 3;
  const kartu = (b: { judul: string; butir: string[] }) => <div key={b.judul} className="rp-card"><b>{b.judul}</b><ul>{b.butir.slice(0, MAKS_BUTIR).map((x) => <li key={x}><Hl t={x} /></li>)}</ul></div>;

  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint"><p>{badge(d.source)}</p><p className="muted">Laporan {jenis}, {T} halaman. Cetak ke PDF dari browser (Ctrl/Cmd+P, A4, tanpa margin, aktifkan "Background graphics"). Narasi Claude: {!claudeConfigured() ? "nonaktif (ANTHROPIC_API_KEY belum diset)" : narasi ? "aktif (tersimpan; membuka ulang tidak memanggil Claude lagi)" : buatNarasi === "1" ? "gagal dibuat atau gagal divalidasi" : <>belum dibuat. <a href={linkBuat}><b>Buat narasi dengan Claude</b></a> (memanggil Claude satu kali, hasilnya disimpan)</>}.</p></div>

    <section className="page cover">
      <div className="c-top"><span className="c-brand">Shaistanaya City · PT Neo Pudji Jaya</span>
        <h1>Laporan<br />Proyeksi<br />Penjualan</h1><span className="c-bar" />
        <p className="c-sub">{jenis === "tahunan" ? "Tahunan" : "Bulanan"} · proyeksi {periodeProyeksi}</p></div>
      <div className="c-bottom"><h4>INFORMASI</h4>
        <div className="c-grid">
          <div><b>Tanggal cetak</b><br />{tanggal}</div><div><b>Data penjualan sampai</b><br />{labelPanjang(d.end)}</div>
          <div><b>Cara hitung UTJ</b><br />Pola penjualan per bulan</div><div><b>Cara hitung akad</b><br />Dari UTJ yang sedang berjalan</div>
          <div><b>Sumber data</b><br />{real ? "Penjualan, unit, leads, event, ekonomi" : "Data demo"}</div><div><b>Pembulatan</b><br />UTJ dan akad dibulatkan ke bawah</div>
        </div></div></section>

    <section className="page rp">
      <div className="rp-top"><span>Laporan Proyeksi Penjualan · Shaistanaya City</span><span>02 / {String(T).padStart(2, "0")}</span></div>
      <h2 className="rp-title">Daftar isi</h2><span className="rp-bar" />
      <div className="toc">
        <div className="toc-side">
          <div><small>UTJ 12 bulan ke depan</small><b>{tot.utj}</b><span>kemungkinan besar {tot.lo}–{tot.hi}</span></div>
          <div><small>Akad</small><b>{tot.akad}</b><span>unit</span></div>
          <div><small>Uang masuk</small><b>Rp {f1(tot.pen)} M</b><span>akad × harga rata-rata</span></div>
          <div><small>Periode</small><span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 2 }}>{periodeProyeksi}</span></div>
        </div>
        <div>{P.map((x, i) => i < 2 ? null : <div key={x} className="toc-row"><i>{String(i + 1).padStart(2, "0")}</i><span>{x}</span></div>)}</div>
      </div>
      <div className="rp-foot">Semua angka dihitung mesin forecast dari data penjualan.</div></section>

    {pg("Ringkasan", <>
      <Kpis>
        <Kpi a l="UTJ 12 bulan ke depan" v={tot.utj} s={`kemungkinan besar ${tot.lo}–${tot.hi}`} />
        <Kpi l="Akad 12 bulan ke depan" v={tot.akad} s={selisih(tot.akad, l12.akad)} />
        <Kpi l="Uang masuk" v={`Rp ${f1(tot.pen)} M`} s={`harga rata-rata Rp ${net2} M/unit`} />
        <Kpi l="UTJ 12 bln terakhir" v={l12.utj} s={`akad ${l12.akad}`} />
        {d.stok && <Kpi l="Stok Open" v={d.stok.open} s={d.stokHabis === null ? "cukup 12 bulan" : `habis bulan ke-${d.stokHabis}`} />}
      </Kpis>
      {narasi?.ringkasan && <p className="rp-quote"><Hl t={narasi.ringkasan} /></p>}
      <h3>Sorotan</h3>
      <div className="rp-cols">{detail.map(kartu)}</div></>)}

    {pg("Penjualan 12 bulan terakhir", <>
      <Chart bars={bars.slice(0, 12)} title="12 bulan terakhir" />
      <div className="rp-cols" style={{ marginTop: 10 }}>
        <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.slice(0, 6).map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}</tbody></table>
        <table>{th("Bulan", "UTJ", "Akad")}<tbody>{last12.slice(6).map((m) => <tr key={m.bulan}><td>{labelPanjang(m.bulan)}</td><td className="n">{m.utj}</td><td className="n">{m.akad}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{l12.utj}</b></td><td className="n"><b>{l12.akad}</b></td></tr></tbody></table></div>
      {jenis === "tahunan" && <><h3>Antar tahun</h3><table>{th("Tahun", "UTJ", "Akad")}<tbody>{[...years].map(([y, v]) => <tr key={y}><td>{y}{y === "2022" ? " (mulai Apr)" : y === d.end.slice(0, 4) ? " (s.d. " + labelBulan(d.end) + ")" : ""}</td><td className="n">{v.utj}</td><td className="n">{v.akad}</td></tr>)}</tbody></table></>}</>)}

    {pg("Perkiraan 12 bulan ke depan", <>
      <Kpis><Kpi a l="UTJ 12 bln" v={tot.utj} s={`kemungkinan besar ${tot.lo}–${tot.hi}`} /><Kpi l="Akad 12 bln" v={tot.akad} /><Kpi l="Uang masuk" v={`Rp ${f1(tot.pen)} M`} /></Kpis>
      <Note>{`Cara membaca rentang: angka besar (${tot.utj}) adalah perkiraan terbaik. Rentang ${tot.lo}–${tot.hi} artinya **8 dari 10 kemungkinan**, hasil sebenarnya ada di antara dua angka itu. Rentangnya lebar karena penjualan naik-turun tiap bulan.`}</Note>
      <Chart bars={bars} title="Proyeksi UTJ dan akad" />
      <table style={{ marginTop: 8 }}>{th("Bulan", "UTJ", "Rentang UTJ", "Akad", "Uang masuk (Rp M)")}<tbody>{r.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{x.utjInt}</td><td className="n">{x.utjLoInt}–{x.utjHiInt}</td><td className="n">{x.akadInt}</td><td className="n">{f1(x.akadInt * net)}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{tot.utj}</b></td><td className="n"><b>{tot.lo}–{tot.hi}</b></td><td className="n"><b>{tot.akad}</b></td><td className="n"><b>{f1(tot.pen)}</b></td></tr></tbody></table>
      <Note>Saat dicoba ke data lama ({bt.origins} kali), perkiraan UTJ rata-rata meleset {f1(bt.utjMae13)} unit per bulan dan perkiraan akad 3 bulan meleset {f1(bt.akadMaeTotal3)} unit.</Note>
      {d.f.trendDivergent && <Note>Arah penjualan mungkin berubah: garis tren berbeda cukup jauh dari proyeksi.</Note>}</>)}

    {pg("Dari UTJ sampai akad", <>
      {[["UTJ", k.funnel.utj], ["SPR & PPJB", k.funnel.spr], ["Akad", k.funnel.akad], ["Pencairan", k.funnel.cair], ["Batal", k.funnel.batal]].map(([a, b]) => (
        <div key={a as string} className="rp-fbar"><span className="l">{a}</span><span className="t"><i style={{ width: `${Math.min(100, pot(b as number))}%`, background: a === "Batal" ? "#C0584F" : undefined }} /></span><span className="v"><b>{b}</b> ({pot(b as number)}%)</span></div>))}
      <h3>Alasan batal</h3>
      <table>{th("Alasan batal", "Jumlah")}<tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table>
      <Note>Alasan batal baru tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus, jadi polanya masih dugaan.</Note></>)}

    {pg("Stok rumah", !d.stok ? <Note>Data unit (sheet UNIT) belum ada di unggahan ini.</Note> : <>
      <Kpis><Kpi a l="Stok Open" v={d.stok.open} s="tersedia dijual" /><Kpi l="Belum dibangun" v={d.stok.belumDibangun} s="status Close" /><Kpi l="Total unit" v={d.stok.total} /><Kpi l="Stok habis" v={d.stokHabis === null ? "-" : `bulan ke-${d.stokHabis}`} s={d.stokKurang ? `kurang ${d.stokKurang} unit` : "cukup 12 bulan"} /></Kpis>
      <h3>Per tipe</h3>
      <table>{th("Tipe", "Open", "Belum dibangun")}<tbody>{stockByType(d.stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{d.stok.open}</b></td><td className="n"><b>{d.stok.belumDibangun}</b></td></tr></tbody></table>
      <Note>Unit yang UTJ-nya batal kembali jadi stok, jadi pemakaian stok dihitung UTJ dikurangi batal.</Note></>)}

    {pg("Tipe, harga, dan agent", <>
      <div className="rp-cols">
        <div><h3>Penjualan per tipe</h3><table>{th("Tipe", "UTJ", "Akad")}<tbody>{k.byType.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table></div>
        <div><h3>Harga bersih (akad)</h3>{harga.length > 0 ? <table>{th("Tipe", "Akad", "Rp M", "Porsi")}<tbody>{harga.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.akad}</td><td className="n">{(x.rata / 1e9).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="n">{x.porsi}%</td></tr>)}</tbody></table> : <p className="muted" style={{ fontSize: 12 }}>Data harga belum ada.</p>}</div></div>
      <h3>Performa agent</h3>
      <table>{th("Agent", "UTJ", "Akad", "Jadi akad")}<tbody>{k.byAgent.map((x) => <tr key={x.agent}><td>{x.agent}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td><td className="n">{x.konversi}%</td></tr>)}</tbody></table>
      <Note>Jumlah data per agent masih sedikit, jadi perbandingannya masih dugaan.</Note></>)}

    {pg("Proses bank dan ekonomi", <>
      <h3>Proses bank</h3>
      <table>{th("Bank", "Berkas", "Approve", "Rata-rata hari")}<tbody>{k.bank.map((x) => <tr key={x.bank}><td>{x.bank}</td><td className="n">{x.berkas}</td><td className="n">{x.approve}%</td><td className="n">{x.hari === null ? "-" : f1(x.hari)}</td></tr>)}</tbody></table>
      <h3>Indikator ekonomi</h3>
      {d.makro ? <><table>{th("Indikator", "Data terakhir", "Nilai", "Hubungan dg UTJ")}<tbody>{d.makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.terakhir ?? "-"}</td><td className="n">{m.nilaiTerakhir === null ? "-" : m.nilaiTerakhir.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td><td className="n">{m.korelasi === null ? "-" : m.korelasi.toLocaleString("id-ID")}</td></tr>)}</tbody></table>
      <Note>Hubungan indikator ekonomi dengan UTJ lemah, jadi hanya bahan pertimbangan.</Note></> : <Note>Data ekonomi belum ada di unggahan ini.</Note>}</>)}

    {pg("Hasil marketing", !mk ? <Note>Data LEADS dan EVENT MARKETING belum ada di unggahan ini.</Note> : <>
      <Kpis><Kpi a l="Biaya event (Rp)" v={`${f1(mk.stats.biayaJuta)} jt`} s={mk.stats.periode} /><Kpi l="Leads" v={mk.stats.leads} /><Kpi l="UTJ" v={mk.stats.utj} /><Kpi l="Per lead" v={mk.stats.biayaPerLeadRibu === null ? "-" : `Rp ${f1(mk.stats.biayaPerLeadRibu)} rb`} /><Kpi l="Per UTJ" v={mk.stats.biayaPerUtjJuta === null ? "-" : `Rp ${f1(mk.stats.biayaPerUtjJuta)} jt`} /></Kpis>
      <table>{th("Bulan", "Biaya (Rp jt)", "Leads", "UTJ")}<tbody>{mk.perBulan.map((x) => <tr key={x.bulan}><td>{labelPanjang(x.bulan)}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{x.leads}</td><td className="n">{x.utj}</td></tr>)}</tbody></table>
      <div className="rp-cols">
        <div><h3>Struktur biaya</h3><table>{th("Kategori", "Rp jt", "Porsi")}<tbody>{mk.kategori.map((x) => <tr key={x.kategori}><td>{x.kategori}</td><td className="n">{f1(x.biaya / 1e6)}</td><td className="n">{f1(x.porsi)}%</td></tr>)}</tbody></table></div>
        <div><h3>Per sumber leads</h3><table>{th("Sumber", "Leads", "Survey", "UTJ")}<tbody>{mk.sumber.map((x) => <tr key={x.database}><td>{x.database}</td><td className="n">{f1(x.porsiLeads)}%</td><td className="n">{f1(x.surveyPerLeads)}%</td><td className="n">{f1(x.porsiUtj)}%</td></tr>)}</tbody></table></div></div>
      <Note>Data baru {mk.stats.jumlahBulan} bulan, jadi hubungan biaya dengan leads ({mk.stats.korelasiBiayaLeads ?? "-"}) dan UTJ ({mk.stats.korelasiBiayaUtj ?? "-"}) hanya petunjuk awal, bukan bukti sebab-akibat.</Note></>)}

    {pg("Temuan marketing", !mk ? <Note>Menunggu data marketing.</Note> : <>{mk.findings.length === 0 ? <p>Tidak ada temuan yang melewati ambang aturan pada data ini.</p> : mk.findings.map((f, i) => (
      <div key={f.id} className="rp-card" style={{ marginBottom: 10 }}>
        <b>{i + 1}. {f.judul}</b> <span className="muted" style={{ fontSize: 10.5 }}>· prioritas {f.prioritas} · {f.label === "hipotesis" ? "hipotesis" : "dari data"}</span>
        <ul><li><b>Temuan:</b> <Hl t={f.temuan} /></li><li><b>Yang dilakukan:</b> <Hl t={f.tindakan} /></li><li><b>Tanda berhasil:</b> <Hl t={f.ukuran} /></li></ul></div>))}</>)}

    {pg("Skenario \"bagaimana jika\"", !skenario || !an ? <p className="muted">Tidak ada skenario dipilih. Buat di menu Simulasi, lalu pilih "Cetak skenario di laporan".</p> : <>
      <Kpis><Kpi a l="UTJ skenario" v={an.totals.utjScn} s={`${an.totals.utjScn - an.totals.utjBase >= 0 ? "+" : ""}${an.totals.utjScn - an.totals.utjBase} vs dasar`} /><Kpi l="Akad skenario" v={an.totals.akadScn} s={`${an.totals.akadScn - an.totals.akadBase >= 0 ? "+" : ""}${an.totals.akadScn - an.totals.akadBase} vs dasar`} /><Kpi l="Uang masuk" v={`Rp ${f1(an.totals.penScn)} M`} s={`dasar Rp ${f1(an.totals.penBase)} M`} /></Kpis>
      <div className="rp-cols">
        <div><h3>Variabel diubah</h3><table>{th("Variabel", "Nilai")}<tbody>{describeScenario(skenario, refData.ref).map((x) => <tr key={x.label}><td>{x.label}</td><td className="n">{x.nilai}</td></tr>)}</tbody></table></div>
        <div><h3>Pengaruh per kelompok</h3><table>{th("Kelompok", "Selisih UTJ")}<tbody>{an.kontribusi.map((x) => <tr key={x.kelompok}><td>{x.kelompok}</td><td className="n">{x.selisihUtj > 0 ? "+" : ""}{x.selisihUtj}</td></tr>)}</tbody></table></div></div>
      <h3>Analisis</h3>
      <ul style={{ paddingLeft: 18, margin: 0 }}>{an.ringkasan.map((x) => <li key={x} style={{ fontSize: 12, marginBottom: 3 }}>{x}</li>)}<li style={{ fontSize: 12 }}><b>Stok:</b> {an.stok}</li></ul>
      <Note>Angka pengaruh di skenario masih contoh (belum dicocokkan dengan data). Proyeksi di halaman lain tidak berubah.</Note></>)}

    {pg("Rekomendasi", <>
      {narasi?.rekomendasi && <p className="rp-quote"><Hl t={narasi.rekomendasi} /></p>}
      {rekom.length === 0 ? <p className="muted">Tidak ada rekomendasi yang melewati ambang aturan pada data ini.</p> : <table>{th("Prioritas", "Tindakan dan alasan")}<tbody>{rekom.map((x, i) => <tr key={i}><td style={{ width: 70 }}><b>{x.prioritas}</b></td><td style={{ fontSize: 12 }}><b><Hl t={x.tindakan} /></b><br /><span className="muted">{x.alasan}</span></td></tr>)}</tbody></table>}</>)}

    {pg("Cara menghitung dan batasannya", <>
      {narasi?.risiko && <p className="rp-quote"><Hl t={narasi.risiko} /></p>}
      <div className="rp-cols">
        <div><h3>Cara angka dibuat</h3><ul style={{ paddingLeft: 16, fontSize: 12 }}>
          <li>UTJ: melihat pola UTJ per bulan, lalu dilanjutkan ke 12 bulan ke depan (dibulatkan ke bawah).</li>
          <li>Akad: dari UTJ yang sedang berjalan, dilihat berapa yang biasanya jadi akad atau batal.</li>
          <li>Rentang: dari seberapa jauh perkiraan meleset saat dicoba ke data lama ({bt.origins} kali).</li>
          <li>Uang masuk: akad × harga rata-rata.</li>
          <li>Stok: UTJ dikurangi batal, dibanding unit Open.</li>
          <li>Skenario: contoh perhitungan sederhana.</li></ul></div>
        <div><h3>Batasannya</h3><ul style={{ paddingLeft: 16, fontSize: 12 }}>
          <li>Penjualan naik-turun; satu angka tidak menjamin hasil.</li>
          <li>Kondisi ekonomi hanya bahan pertimbangan.</li>
          <li>Data marketing baru sejak Okt 2025.</li>
          <li>Alasan batal dan status leads baru sebagian terisi.</li>
          <li>Uang masuk memakai harga rata-rata, bukan jadwal bayar bertahap.</li></ul></div></div>
      <h3>Langkah berikutnya</h3>
      <ul style={{ paddingLeft: 16, fontSize: 12 }}><li>Lengkapi alasan batal dan status leads.</li><li>Cocokkan angka skenario dengan data event, promo, dan harga setelah datanya cukup.</li><li>Rencanakan bangun unit Close supaya stok tidak menghambat penjualan.</li></ul></>)}
  </>);
}
