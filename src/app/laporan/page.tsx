import { Nav, badge } from "@/components/Nav";
import { Chart } from "@/components/Chart";
import { ReportPage, Note, Kpi, Kpis, Hl } from "@/components/ReportPage";
import { getData, f1, labelBulan, labelPanjang } from "@/lib/data";
import { forecast, parseMetode, METODE_NAMA, METODE_PENJELASAN } from "@/lib/forecast";
import { MetodeSelect } from "@/components/Metode";
import { UnduhPdf } from "@/components/UnduhPdf";
import { persen, statusTarget } from "@/lib/target";
import { sesiSaatIni } from "@/lib/auth";
import { jendelaLaporan, daftarBulan, selisihBulan } from "@/lib/periode";
import { tampilLabel } from "@/lib/format";
import { stockByType, stockoutMonth, stockShortfall } from "@/lib/stock";
import { avgNetPrice, priceByType, rekomendasiDari, ringkasanDetail, RingkasInput } from "@/lib/laporan";
import { describeScenario, parseScenario } from "@/lib/whatif";
import { analisisSkenario } from "@/lib/analisis";
import { referensiDari } from "@/lib/referensi";
import { cariNarasi, claudeConfigured, narasiLaporan } from "@/lib/claude";
import { filterMarketing, marketingInsights } from "@/lib/marketing";
import { applyFilter, cards } from "@/lib/insights";

const th = (...c: string[]) => <thead><tr>{c.map((x, i) => <th key={x} className={i ? "n" : ""}>{x}</th>)}</tr></thead>;
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ jenis?: string; s?: string; narasi?: string; bulan?: string; tahun?: string; metode?: string }> }) {
  const { s: sRaw, narasi: buatNarasi, metode: metodeRaw, ...qp } = await searchParams;
  const admin = (await sesiSaatIni())?.rl === "admin";
  const metode = parseMetode(metodeRaw);
  const d = await getData("kalender", {}, metode);
  const txns = d.txns;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const refData = referensiDari(d);
  const net = refData.netPriceMiliar;
  const bt = d.f.bt;
  const first = d.monthly[0].bulan;

  // ---- Rentang waktu laporan: bulanan = 1 bulan, tahunan = 12 bulan; boleh bulan/tahun apa saja (aktual atau proyeksi) ----
  const w = jendelaLaporan(qp, d.end);
  const jenis = w.jenis;
  const hz = Math.max(0, Math.min(36, selisihBulan(d.end, w.sampai)));          // bulan proyeksi yang dibutuhkan dari data terakhir
  const fr = hz > 12 ? forecast(txns, first, d.end, hz, metode).rows : d.f.rows;       // baris proyeksi mulai bulan setelah data terakhir
  const frMap = new Map(fr.map((x) => [x.bulan, x]));
  const aktualMap = new Map(d.monthly.map((m) => [m.bulan, m]));
  // Grafik: bulan laporan ditambah konteks sebelumnya sampai kira-kira 12 batang.
  const ctxDari0 = w.n < 12 ? daftarBulan(first, w.dari).slice(-(12 - w.n + 1))[0] ?? w.dari : w.dari;
  const dariGrafik = ctxDari0 < first ? first : ctxDari0;
  const bulanGrafik = daftarBulan(dariGrafik, w.sampai).slice(-36);
  type Baris = { batal?: number; spr?: number; bulan: string; aktual: boolean; utj: number; akad: number; lo?: number; hi?: number; trend?: number; dalam: boolean };
  const baris: Baris[] = bulanGrafik.flatMap((m): Baris[] => {
    const dalam = m >= w.dari && m <= w.sampai;
    if (m <= d.end) { const a = aktualMap.get(m); return a ? [{ bulan: m, aktual: true, utj: a.utj, akad: a.akad, dalam }] : []; }
    const f = frMap.get(m);
    return f ? [{ bulan: m, aktual: false, utj: f.utjInt, akad: f.akadInt, batal: f.batalInt, spr: f.spr, lo: f.utjLoInt, hi: f.utjHiInt, trend: f.trend, dalam }] : [];
  });
  const dalamJendela = baris.filter((x) => x.dalam);
  const aktualBulan = dalamJendela.filter((x) => x.aktual).length, proyeksiBulan = dalamJendela.length - aktualBulan;
  const half = Math.floor(Math.sqrt(sum(dalamJendela.filter((x) => !x.aktual).map((x) => (((x.hi ?? 0) - (x.lo ?? 0)) / 2) ** 2))));
  const utjTot = sum(dalamJendela.map((x) => x.utj)), akadTot = sum(dalamJendela.map((x) => x.akad));
  const tot = { utj: utjTot, akad: akadTot, lo: proyeksiBulan ? Math.max(0, utjTot - half) : utjTot, hi: proyeksiBulan ? utjTot + half : utjTot, pen: akadTot * net };
  const n = w.n;
  // Target (bila sudah diisi admin) untuk bulan-bulan di dalam rentang laporan
  const targetMap = new Map(d.targets.map((t) => [t.bulan, t]));
  const bulanBerTarget = dalamJendela.filter((x) => targetMap.has(x.bulan));
  const tg = bulanBerTarget.length ? {
    n: bulanBerTarget.length,
    tUtj: sum(bulanBerTarget.map((x) => targetMap.get(x.bulan)!.utj)), tAkad: sum(bulanBerTarget.map((x) => targetMap.get(x.bulan)!.akad)),
    hUtj: sum(bulanBerTarget.map((x) => x.utj)), hAkad: sum(bulanBerTarget.map((x) => x.akad)),
  } : null;
  const stTxt = (h: number, t: number) => { const s = statusTarget(h, t); return s === "tercapai" ? "sesuai atau di atas target" : s === "mendekati" ? "mendekati target" : s === "di bawah" ? "di bawah target" : ""; };
  const pembanding = d.monthly.slice(-n);                                       // n bulan aktual terakhir sebagai pembanding
  const l12 = { utj: sum(pembanding.map((m) => m.utj)), akad: sum(pembanding.map((m) => m.akad)) };
  const bars = baris.map((x) => ({ label: labelBulan(x.bulan), showLabel: tampilLabel(x.bulan), utj: x.utj, akad: x.akad, proj: !x.aktual, lo: x.lo, hi: x.hi, trend: x.trend }));
  const years = new Map<string, { utj: number; akad: number }>();
  for (const m of d.monthly) { const y = years.get(m.bulan.slice(0, 4)) ?? { utj: 0, akad: 0 }; y.utj += m.utj; y.akad += m.akad; years.set(m.bulan.slice(0, 4), y); }

  // ---- Data dasar untuk funnel, tipe, bank, marketing: bulan aktual di dalam rentang; bila belum ada, pakai n bulan aktual terakhir ----
  const dasarDari = aktualBulan ? (w.dari < first ? first : w.dari) : pembanding[0].bulan;
  const dasarSampai = aktualBulan ? (w.sampai > d.end ? d.end : w.sampai) : d.end;
  const dasarLabel = `${labelPanjang(dasarDari)}${dasarDari === dasarSampai ? "" : " – " + labelPanjang(dasarSampai)}`;
  const fDasar = { dari: dasarDari, sampai: dasarSampai };
  const txDasar = applyFilter(txns, fDasar, false);
  const k = cards(txDasar);
  const pot = (e: number) => Math.round((e / Math.max(1, k.funnel.utj)) * 100);
  const mkData = d.report?.marketing ? filterMarketing(d.report.marketing, fDasar) : null;
  const mk = mkData && mkData.leads.length ? marketingInsights(mkData, txDasar) : null;

  // ---- Stok: kondisi terkini terhadap proyeksi sampai akhir rentang ----
  const stRows = fr.slice(0, hz);
  const stokHabis = d.stok && hz > 0 ? stockoutMonth(stRows.map((x) => x.utj), d.stok.open, 0, stRows.map((x) => x.batal)) : null;
  const stokKurang = d.stok && hz > 0 ? stockShortfall(stRows.map((x) => x.utj), d.stok.open, stRows.map((x) => x.batal)) : null;

  const periodeProyeksi = `${labelPanjang(w.dari)}${w.dari === w.sampai ? "" : " – " + labelPanjang(w.sampai)}`;
  const r12 = d.f.rows;  // skenario what-if memakai proyeksi dasar 12 bulan ke depan

  const inp: RingkasInput = {
    jenis, periodeProyeksi, akhirData: labelPanjang(d.end), tot, l12, bt, k, mk, makro: d.makro, trendBerubah: d.f.trendDivergent,
    nBulan: n, aktualBulan, proyeksiBulan, horizon: hz,
    stok: d.stok ? { open: d.stok.open, belumDibangun: d.stok.belumDibangun, total: d.stok.total, perTipe: d.stok.perTipe, belumDibangunPerTipe: d.stok.belumDibangunPerTipe, habis: stokHabis, kurang: stokKurang } : null,
  };
  const detail = ringkasanDetail(inp);
  const rekom = rekomendasiDari(inp);

  const skenario = parseScenario(sRaw);
  const an = skenario ? analisisSkenario({ base: r12, s: skenario, ref: refData.ref, stokOpen: d.stok?.open ?? 0, belumDibangunPerTipe: d.stok?.belumDibangunPerTipe ?? [], netPriceMiliar: net, korelasiEkonomi: refData.korelasi }) : null;

  // Claude hanya dipanggil bila tombol "Buat narasi" ditekan (?narasi=1) dan belum ada narasi tersimpan untuk data dan rentang yang sama.
  const inputNarasi = {
    periode: periodeProyeksi, jenis, metodeUtj: METODE_NAMA[metode], dataSampai: labelPanjang(d.end), bulanAktual: aktualBulan, bulanPerkiraan: proyeksiBulan,
    hasilPeriode: { utj: tot.utj, utjRendah: tot.lo, utjTinggi: tot.hi, akad: tot.akad, penerimaanMiliarRp: +tot.pen.toFixed(1) },
    pembandingBulanTerakhir: { bulan: n, ...l12 },
    ujiMundur: { titik: bt.origins, galatUtjRataRata: +bt.utjMae13.toFixed(1), galatUtjRataRata12Bln: +bt.utjMae13Ma12.toFixed(1), galatAkadTotal3Bln: +bt.akadMaeTotal3.toFixed(1) },
    dataDasar: dasarLabel,
    funnel: { ...k.funnel, persenBatal: pot(k.funnel.batal) }, alasanBatalTercatat: k.alasan,
    bank: k.bank.map((b) => ({ bank: b.bank, berkas: b.berkas, persenApprove: b.approve, rataHari: b.hari === null ? null : Math.round(b.hari) })),
    stok: d.stok ? { unitOpen: d.stok.open, unitBelumDibangun: d.stok.belumDibangun, totalUnit: d.stok.total, bulanStokHabis: stokHabis, kekuranganUnit: stokKurang } : null,
    ekonomi: d.makro ? d.makro.map((m) => ({ indikator: m.indikator, korelasiDenganUtj: m.korelasi, bulanTerakhir: m.terakhir, nilai: m.nilaiTerakhir })) : null,
    marketing: mk ? { ...mk.stats, kategori: mk.kategori.slice(0, 5), temuan: mk.findings.map((f) => ({ judul: f.judul, temuan: f.temuan, label: f.label })) } : null,
    ringkasanMesin: detail, rekomendasiMesin: rekom,
    peringatan: ["Korelasi bulanan variabel ekonomi dengan UTJ lemah; hanya konteks, bukan penggerak proyeksi", "Alasan batal baru tercatat sebagian", "Sampel per agent kecil", "UTJ dan akad dibulatkan ke bawah per bulan"],
  };
  const narasi = buatNarasi === "1" && admin ? await narasiLaporan(inputNarasi) : await cariNarasi(inputNarasi);
  const linkBuat = `/laporan?${new URLSearchParams({ jenis, bulan: w.bulan, tahun: w.tahun, metode, ...(sRaw ? { s: sRaw } : {}), narasi: "1" }).toString()}`;
  const harga = priceByType(txDasar);
  const net2 = net.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const real = d.source !== "demo";
  const tahunPilihan = Array.from({ length: +d.end.slice(0, 4) + 4 - +first.slice(0, 4) }, (_, i) => String(+first.slice(0, 4) + i));

  // Daftar halaman: nomor halaman dan daftar isi dibuat dari urutan ini.
  const P: string[] = ["Sampul", "Daftar isi", "Ringkasan", "Hasil dan perkiraan periode", "Dari UTJ sampai akad", "Stok rumah", "Tipe, harga, dan agent", "Proses bank dan ekonomi", "Hasil marketing", "Temuan marketing", "Skenario \"bagaimana jika\"", "Rekomendasi", "Cara menghitung dan batasannya"];
  const T = P.length, no = (j: string) => P.findIndex((x) => x === j) + 1;
  const pg = (j: string, children: React.ReactNode) => <ReportPage key={j} n={no(j)} total={T} title={j}>{children}</ReportPage>;
  const tanggal = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const selisih = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}% vs ${n} bln terakhir` : undefined);
  const MAKS_BUTIR = 3;
  const kartu = (b: { judul: string; butir: string[] }) => <div key={b.judul} className="rp-card"><b>{b.judul}</b><ul>{b.butir.slice(0, MAKS_BUTIR).map((x) => <li key={x}><Hl t={x} /></li>)}</ul></div>;

  return (<><Nav active="/laporan" updated="Pratinjau laporan" />
    <div className="wrap noprint">
      <form method="get" action="/laporan" className="card" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <label className="field">Jenis laporan
          <select className="inp" name="jenis" defaultValue={jenis}><option value="bulanan">Bulanan (1 bulan)</option><option value="tahunan">Tahunan (12 bulan)</option></select></label>
        <label className="field">Bulan (untuk tahunan: bulan mulai)
          <select className="inp" name="bulan" defaultValue={w.bulan}>{NAMA_BULAN.map((nm, i) => <option key={nm} value={String(i + 1).padStart(2, "0")}>{nm}</option>)}</select></label>
        <label className="field">Tahun
          <select className="inp" name="tahun" defaultValue={w.tahun}>{tahunPilihan.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <MetodeSelect metode={metode} terbaik={d.f.banding.terbaik} />
        {sRaw ? <input type="hidden" name="s" value={sRaw} /> : null}
        <button className="btn" type="submit">Terapkan</button>
        <UnduhPdf nama={`Laporan ${jenis} ${periodeProyeksi}`} />
        <p className="muted" style={{ fontSize: 12, flexBasis: "100%", margin: 0 }}>Bulanan = laporan satu bulan. Tahunan = 12 bulan berturut-turut mulai dari bulan dan tahun yang dipilih (pilih Januari untuk satu tahun kalender). Bulan yang sudah lewat memakai data nyata, bulan ke depan memakai proyeksi (sampai 36 bulan setelah data terakhir).</p>
      </form></div>

    <div className="wrap noprint"><p>{badge(d.source)}</p><p className="muted">Laporan {jenis}, {T} halaman. Periode: <b>{periodeProyeksi}</b> ({aktualBulan} bulan data nyata, {proyeksiBulan} bulan perkiraan{w.dipotong ? "; dipotong sampai batas 36 bulan setelah data terakhir" : ""}). Klik "Unduh PDF" untuk mengunduh file PDF (A4) dari pilihan yang sedang diterapkan; pilihan di form baru berlaku setelah "Terapkan". Narasi Claude: {!claudeConfigured() ? "nonaktif (ANTHROPIC_API_KEY belum diset)" : narasi ? "aktif (tersimpan; membuka ulang tidak memanggil Claude lagi)" : buatNarasi === "1" ? "gagal dibuat atau gagal divalidasi" : admin ? <>belum dibuat. <a href={linkBuat}><b>Buat narasi dengan Claude</b></a> (memanggil Claude satu kali, hasilnya disimpan)</> : "belum dibuat (minta admin membuatnya)"}.</p></div>

    <section className="page cover">
      <div className="c-top">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logo.png" alt="Logo" className="c-logo" /><br /><span className="c-brand">Shaistanaya City · PT Neo Pudji Jaya</span>
        <h1>Laporan<br />Proyeksi<br />Penjualan</h1><span className="c-bar" />
        <p className="c-sub">{jenis === "tahunan" ? "Tahunan" : "Bulanan"} · {periodeProyeksi}</p></div>
      <div className="c-bottom"><h4>INFORMASI</h4>
        <div className="c-grid">
          <div><b>Tanggal cetak</b><br />{tanggal}</div><div><b>Data penjualan sampai</b><br />{labelPanjang(d.end)}</div>
          <div><b>Cara hitung UTJ</b><br />{METODE_NAMA[metode]}</div><div><b>Cara hitung akad</b><br />Dari UTJ yang sedang berjalan</div>
          <div><b>Sumber data</b><br />{real ? "Penjualan, unit, leads, event, ekonomi" : "Data demo"}</div><div><b>Pembulatan</b><br />UTJ dan akad dibulatkan ke bawah</div>
        </div></div></section>

    <section className="page rp">
      <div className="rp-top"><span className="rp-brand"><img src="/logo.png" alt="" />Laporan Proyeksi Penjualan · Shaistanaya City</span><span>02 / {String(T).padStart(2, "0")}</span></div>
      <h2 className="rp-title">Daftar isi</h2><span className="rp-bar" />
      <div className="toc">
        <div className="toc-side">
          <div><small>UTJ periode ini</small><b>{tot.utj}</b><span>{proyeksiBulan ? `kemungkinan besar ${tot.lo}–${tot.hi}` : "data nyata"}</span></div>
          <div><small>Akad</small><b>{tot.akad}</b><span>unit</span></div>
          <div><small>Uang masuk</small><b>Rp {f1(tot.pen)} M</b><span>akad × harga rata-rata</span></div>
          <div><small>Periode</small><span style={{ display: "block", fontSize: 13, fontWeight: 700, marginTop: 2 }}>{periodeProyeksi}</span></div>
        </div>
        <div>{P.map((x, i) => i < 2 ? null : <div key={x} className="toc-row"><i>{String(i + 1).padStart(2, "0")}</i><span>{x}</span></div>)}</div>
      </div>
      <div className="rp-foot">Semua angka dihitung mesin forecast dari data penjualan.</div></section>

    {pg("Ringkasan", <>
      <Kpis>
        <Kpi a l="UTJ periode ini" v={tot.utj} s={proyeksiBulan ? `kemungkinan besar ${tot.lo}–${tot.hi}` : "data nyata"} />
        <Kpi l="Akad periode ini" v={tot.akad} s={selisih(tot.akad, l12.akad)} />
        <Kpi l="Uang masuk" v={`Rp ${f1(tot.pen)} M`} s={`harga rata-rata Rp ${net2} M/unit`} />
        <Kpi l={`UTJ ${n} bln terakhir`} v={l12.utj} s={`akad ${l12.akad}`} />
        {d.stok && <Kpi l="Stok Open" v={d.stok.open} s={hz <= 0 ? "kondisi terkini" : stokHabis === null ? `cukup ${hz} bulan` : `habis bulan ke-${stokHabis}`} />}
      </Kpis>
      {narasi?.ringkasan && <p className="rp-quote"><Hl t={narasi.ringkasan} /></p>}
      <h3>Sorotan</h3>
      <div className="rp-cols">{detail.map(kartu)}</div>
      {jenis === "tahunan" && <><h3 style={{ margin: "10px 0 4px" }}>Antar tahun (data nyata)</h3><table className="compact">{th("Tahun", "UTJ", "Akad")}<tbody>{[...years].map(([y, v]) => <tr key={y}><td>{y}{y === "2022" ? " (mulai Apr)" : y === d.end.slice(0, 4) ? " (s.d. " + labelBulan(d.end) + ")" : ""}</td><td className="n">{v.utj}</td><td className="n">{v.akad}</td></tr>)}</tbody></table></>}</>)}

    {pg("Hasil dan perkiraan periode", <>
      <Kpis>
        <Kpi a l="UTJ" v={tot.utj} s={proyeksiBulan ? `kemungkinan besar ${tot.lo}–${tot.hi}` : "data nyata"} />
        <Kpi l="Akad" v={tot.akad} s={selisih(tot.akad, l12.akad)} />
        <Kpi l="Uang masuk" v={`Rp ${f1(tot.pen)} M`} />
        <Kpi l="Bulan" v={`${aktualBulan} + ${proyeksiBulan}`} s="data nyata + perkiraan" />
      </Kpis>
      {tg && (tg.tUtj > 0 || tg.tAkad > 0) && <Note>{`Target periode${tg.n < dalamJendela.length ? ` (${tg.n} dari ${dalamJendela.length} bulan yang punya target)` : ""}: UTJ ${tg.tUtj}, akad ${tg.tAkad}. Hasil ${proyeksiBulan ? "dan perkiraan " : ""}periode ini: UTJ ${tg.hUtj}${persen(tg.hUtj, tg.tUtj) !== null ? ` (${persen(tg.hUtj, tg.tUtj)}% dari target, ${stTxt(tg.hUtj, tg.tUtj)})` : ""}, akad ${tg.hAkad}${persen(tg.hAkad, tg.tAkad) !== null ? ` (${persen(tg.hAkad, tg.tAkad)}% dari target, ${stTxt(tg.hAkad, tg.tAkad)})` : ""}.`}</Note>}
      {proyeksiBulan > 0 && <Note>{`Cara membaca rentang: angka besar (${tot.utj}) adalah perkiraan terbaik. Rentang ${tot.lo}–${tot.hi} artinya **8 dari 10 kemungkinan**, hasil sebenarnya ada di antara dua angka itu. Rentangnya lebar karena penjualan naik-turun tiap bulan.`}</Note>}
      <Chart bars={bars} title="UTJ dan akad" />
      <table className="compact" style={{ marginTop: 8 }}><thead><tr><th>Bulan</th><th>Status</th><th className="n">UTJ</th><th className="n">Rentang UTJ</th><th className="n">Batal</th><th className="n">SPR & PPJB</th><th className="n">Akad</th><th className="n">Uang masuk (Rp M)</th></tr></thead><tbody>{(n < 12 ? baris.slice(-6) : dalamJendela).map((x) => <tr key={x.bulan} style={x.dalam ? { fontWeight: 700 } : { color: "#5B6670" }}><td>{labelPanjang(x.bulan)}</td><td>{x.aktual ? "Data nyata" : "Perkiraan"}</td><td className="n">{x.utj}</td><td className="n">{x.aktual ? "-" : `${x.lo}–${x.hi}`}</td><td className="n">{x.batal ?? "-"}</td><td className="n">{x.spr ?? "-"}</td><td className="n">{x.akad}</td><td className="n">{f1(x.akad * net)}</td></tr>)}
        {n > 1 && <tr><td><b>Total periode</b></td><td /><td className="n"><b>{tot.utj}</b></td><td className="n"><b>{proyeksiBulan ? `${tot.lo}–${tot.hi}` : "-"}</b></td><td /><td /><td className="n"><b>{tot.akad}</b></td><td className="n"><b>{f1(tot.pen)}</b></td></tr>}</tbody></table>
      {proyeksiBulan > 0 && <Note>Saat dicoba ke data lama ({bt.origins} kali), perkiraan UTJ rata-rata meleset {f1(bt.utjMae13)} unit per bulan dan perkiraan akad 3 bulan meleset {f1(bt.akadMaeTotal3)} unit.</Note>}
      {proyeksiBulan > 0 && d.f.trendDivergent && <Note>Arah penjualan mungkin berubah: garis tren berbeda cukup jauh dari proyeksi.</Note>}</>)}

    {pg("Dari UTJ sampai akad", <>
      <Note>Data dasar: {dasarLabel}{aktualBulan ? "" : ` (periode laporan belum punya data nyata, jadi dipakai ${n} bulan terakhir)`}.</Note>
      {[["UTJ", k.funnel.utj], ["SPR & PPJB", k.funnel.spr], ["Akad", k.funnel.akad], ["Pencairan", k.funnel.cair], ["Batal", k.funnel.batal]].map(([a, b]) => (
        <div key={a as string} className="rp-fbar"><span className="l">{a}</span><span className="t"><i style={{ width: `${Math.min(100, pot(b as number))}%`, background: a === "Batal" ? "#C0584F" : undefined }} /></span><span className="v"><b>{b}</b> ({pot(b as number)}%)</span></div>))}
      <h3>Alasan batal</h3>
      <table>{th("Alasan batal", "Jumlah")}<tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table>
      <Note>Alasan batal baru tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus, jadi polanya masih dugaan.</Note></>)}

    {pg("Stok rumah", !d.stok ? <Note>Data unit (sheet UNIT) belum ada di unggahan ini.</Note> : <>
      <Kpis><Kpi a l="Stok Open" v={d.stok.open} s="tersedia dijual" /><Kpi l="Belum dibangun" v={d.stok.belumDibangun} s="status Close" /><Kpi l="Total unit" v={d.stok.total} /><Kpi l="Stok habis" v={hz <= 0 ? "-" : stokHabis === null ? "-" : `bulan ke-${stokHabis}`} s={hz <= 0 ? "kondisi terkini" : stokKurang ? `kurang ${stokKurang} unit` : `cukup ${hz} bulan`} /></Kpis>
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

    {pg("Hasil marketing", !mk ? <Note>Data LEADS dan EVENT MARKETING belum ada untuk periode ini (datanya baru ada sejak Okt 2025).</Note> : <>
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
          <li>UTJ: {METODE_NAMA[metode]}. {METODE_PENJELASAN[metode]} Hasilnya dibulatkan ke bawah; bulan yang sudah lewat memakai data nyata.</li>
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
      <h3>Metode mana yang paling mendekati?</h3>
      <table>{th("Metode", "UTJ meleset / bulan", "Akad meleset (3 bln)")}<tbody>{d.f.banding.baris.map((b) => <tr key={b.metode} style={b.metode === metode ? { fontWeight: 700 } : undefined}><td>{METODE_NAMA[b.metode]}{b.metode === metode ? " (dipakai)" : ""}{b.metode === d.f.banding.terbaik ? " ★" : ""}</td><td className="n">{f1(b.utjMae13)} unit</td><td className="n">{f1(b.akadMaeTotal3)} unit</td></tr>)}</tbody></table>
      <Note>{`Tiap metode dicoba meramal ke data lama (${bt.origins} kali). Makin kecil angka meleset, makin mendekati kenyataan. ★ = paling mendekati untuk UTJ: **${METODE_NAMA[d.f.banding.terbaik]}**. Selisih antarmetode kecil karena penjualan naik-turun tiap bulan.`}</Note>
      <h3>Langkah berikutnya</h3>
      <ul style={{ paddingLeft: 16, fontSize: 12 }}><li>Lengkapi alasan batal dan status leads.</li><li>Cocokkan angka skenario dengan data event, promo, dan harga setelah datanya cukup.</li><li>Rencanakan bangun unit Close supaya stok tidak menghambat penjualan.</li></ul></>)}
  </>);
}
