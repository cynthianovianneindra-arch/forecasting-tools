import { Nav, badge } from "@/components/Nav";
import { Garis, Temuan } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { dayaBeli, sinyalPasar } from "@/lib/analisaLanjut";
import { labelBulan, f1 } from "@/lib/format";

export const dynamic = "force-dynamic";
const rp = (v: number | null) => (v === null ? "-" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
const infl = (v: number | null) => (v === null ? null : Math.abs(v) <= 0.2 ? v * 100 : v);

export default async function Page() {
  const d = await getData();
  const macro = d.macroRows;
  const net = d.netPrice;
  const db = dayaBeli(macro, net);
  const sinyal = sinyalPasar(macro);
  const seri = (k: "emas" | "ihsg" | "inflasi" | "birate" | "ihpr" | "umkSda" | "umkSby") => (macro ?? []).filter((m) => m[k] !== null && m[k] !== undefined).slice(-36);
  const g = (k: "emas" | "ihsg" | "inflasi" | "birate" | "ihpr" | "umkSda" | "umkSby", nama: string, fmt?: (v: number) => string, ubah?: (v: number) => number) => {
    const s = seri(k);
    return { labels: s.map((m) => labelBulan(m.bulan)), deret: [{ nama, nilai: s.map((m) => (ubah ? ubah(m[k] as number) : (m[k] as number))) }], fmt };
  };
  const bi = g("birate", "BI Rate"), inf = g("inflasi", "Inflasi tahunan (%)", undefined, (v) => infl(v) ?? v), ihsg = g("ihsg", "IHSG"), emas = g("emas", "Emas (USD/oz)"), ihpr = g("ihpr", "IHPR"), umk = g("umkSda", "UMK Sidoarjo", (v) => `${(v / 1e6).toFixed(1)} jt`);
  type Kunci = "emas" | "ihsg" | "inflasi" | "birate" | "ihpr" | "umkSda" | "umkSby";
  const nilaiSeri = (k: Kunci) => (macro ?? []).filter((m) => m[k] !== null && m[k] !== undefined).map((m) => ({ bulan: m.bulan, v: k === "inflasi" ? (infl(m[k] as number) ?? 0) : (m[k] as number) }));
  const tile = (k: Kunci, nama: string, satuan: string, selisih: "poin" | "persen") => {
    const s = nilaiSeri(k), a = s[s.length - 1], b = s[s.length - 2];
    if (!a) return null;
    const d2 = b ? (selisih === "persen" ? ((a.v - b.v) / Math.abs(b.v || 1)) * 100 : a.v - b.v) : null;
    return { k, nama, nilai: `${a.v.toLocaleString("id-ID", { maximumFractionDigits: selisih === "persen" ? 0 : 2 })}${satuan}`, bulan: labelBulan(a.bulan), d: d2 === null ? null : `${d2 >= 0 ? "+" : ""}${d2.toFixed(selisih === "persen" ? 1 : 2)}${selisih === "persen" ? "%" : " poin"} vs bulan sebelumnya`, naik: d2 !== null && d2 >= 0 };
  };
  const tiles = [tile("birate", "BI Rate", "%", "poin"), tile("inflasi", "Inflasi tahunan", "%", "poin"), tile("ihsg", "IHSG", "", "persen"), tile("emas", "Harga emas (USD/oz)", "", "persen")].filter((x): x is NonNullable<typeof x> => !!x);
  const adaUpah = !!db && (db.acuan !== null || db.ihpr !== null);
  const grafik: { judul: string; g: ReturnType<typeof g>; fmt?: (v: number) => string }[] = ([
    { judul: "BI Rate (%)", g: bi }, { judul: "Inflasi tahunan (%)", g: inf }, { judul: "IHSG", g: ihsg }, { judul: "Harga emas (USD/oz)", g: emas }, { judul: "IHPR (Indeks Harga Properti Residensial)", g: ihpr }, { judul: "UMK Sidoarjo", g: umk, fmt: (v) => `${(v / 1e6).toFixed(1)}jt` },
  ] as { judul: string; g: ReturnType<typeof g>; fmt?: (v: number) => string }[]).filter((x) => x.g.labels.length >= 2);
  const warnaStatus = db?.status === "Tertekan" ? "neg" : db?.status === "Waspada" ? "mid" : "ok";
  return (<><Nav active="/pasar" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} />
    <main className="wrap stack"><p>{badge(d.source)}</p>
      <div><h1>Pasar &amp; Ekonomi</h1><p className="muted" style={{ maxWidth: 680 }}>Daya beli masyarakat dan kondisi ekonomi yang memengaruhi pembelian rumah. Korelasi dengan UTJ lemah, jadi ini konteks untuk membaca risiko, bukan penggerak proyeksi.</p></div>
      {!macro?.length ? <p className="warn">Belum ada data ekonomi. Jalankan sinkron ekonomi (admin) atau unggah Excel yang memuat sheet INSTRUMEN EKONOMI.</p> : !adaUpah ? null : <>
        <Temuan judul={`Daya beli saat ini: ${db.status}`} isi={db.tahunUpah !== null ? `Satu rumah dengan harga bersih rata-rata Rp ${f1(net)} miliar setara ${db.tahunUpah} tahun upah ${db.acuan?.nama ?? "minimum"}. Perkiraan tahun depan ${db.tahunUpahDepan ?? "-"} tahun upah (UMK naik ${db.pertumbuhanUmk ?? "-"}%/tahun, harga mengikuti IHPR).` : "Data upah minimum belum tersedia."} aksi={db.status === "Cukup sehat" ? "pertahankan strategi; pantau BI Rate dan inflasi tiap bulan." : "perkuat skema cicilan ringan (subsidi angsuran, KPR dengan uang muka kecil) dan fokus ke tipe terjangkau."} />
        <div className="kpis">
          <div className="kpi-card accent"><small>{db.acuan?.nama ?? "UMK"}</small><span className="big">{rp(db.acuan?.nilai ?? null)}</span>{db.pertumbuhanUmk !== null && <span className="chg">{db.pertumbuhanUmk >= 0 ? "+" : ""}{db.pertumbuhanUmk}% vs tahun lalu</span>}</div>
          <div className="kpi-card gold"><small>BI Rate</small><span className="big">{db.biRate ? `${db.biRate.nilai}%` : "-"}</span><span className="sub">{db.biRate ? labelBulan(db.biRate.bulan) : ""}</span></div>
          <div className="kpi-card"><small>Inflasi tahunan</small><span className="big">{db.inflasi ? `${f1(db.inflasi.nilai)}%` : "-"}</span><span className="sub">{db.inflasi ? labelBulan(db.inflasi.bulan) : ""}</span></div>
          <div className="kpi-card"><small>Status daya beli</small><span className="big"><span className={"tgt-badge " + warnaStatus} style={{ fontSize: 16 }}>{db.status}</span></span><span className="sub">dari inflasi, BI Rate, dan kenaikan upah</span></div>
        </div></>}
      {sinyal.length > 0 && <div className="card"><h2>Isu terkini yang bisa memengaruhi penjualan</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Dibaca dari perubahan data ekonomi beberapa bulan terakhir, bukan dari berita.</p>
        {sinyal.map((s) => <div key={s.judul} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid #DEDDDB", alignItems: "baseline" }}>
          <span className={"sinyal-b tgt-badge " + (s.arah === "menekan" ? "neg" : s.arah === "mendukung" ? "ok" : "")} style={{ flex: "none" }}>{s.arah === "menekan" ? "Menekan" : s.arah === "mendukung" ? "Mendukung" : "Netral"}</span>
          <div><b>{s.judul}</b><div style={{ fontSize: 13 }}>{s.keterangan}</div></div></div>)}</div>}
      {tiles.length > 0 && <div className="kpis">{tiles.map((t, i) => <div key={t.k} className={"kpi-card" + (i === 0 ? " accent" : i === 1 ? " gold" : "")}><small>{t.nama}</small><span className="big">{t.nilai}</span><span className="sub">{t.bulan}{t.d ? ` · ${t.d}` : ""}</span></div>)}</div>}
      {grafik.length > 0 && <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
        {grafik.map((x) => <div key={x.judul} className="card"><h2>{x.judul}</h2><Garis labels={x.g.labels} deret={x.g.deret} format={x.fmt} judul={x.judul} lebar={460} tinggi={200} /></div>)}
      </div>}
      {macro?.length && !adaUpah ? <p className="muted" style={{ fontSize: 12 }}>Data upah (UMK) dan IHPR belum ada, jadi analisis daya beli belum tampil. Unggah Excel yang memuat sheet INSTRUMEN EKONOMI untuk melengkapinya.</p> : null}
      {db && adaUpah && <div className="card"><h2>Data kependudukan dan upah</h2>
        <table className="compact"><tbody>
          <tr><td>UMR Jawa Timur</td><td className="n">{rp(db.umrJatim)}</td></tr>
          <tr><td>UMK Surabaya</td><td className="n">{rp(db.umkSby)}</td></tr>
          <tr><td>UMK Sidoarjo</td><td className="n">{rp(db.umkSda)}</td></tr>
          <tr><td>Jumlah pernikahan (tahunan, termasuk nikah di luar KUA bila ada di data)</td><td className="n">{db.pernikahan === null ? "-" : db.pernikahan.toLocaleString("id-ID")}</td></tr>
          <tr><td>Angka kelahiran (rate)</td><td className="n">{db.kelahiran ?? "-"}</td></tr>
          <tr><td>IHPR terakhir</td><td className="n">{db.ihpr ? `${db.ihpr.nilai}${db.ihpr.tumbuh !== null ? ` (${db.ihpr.tumbuh >= 0 ? "+" : ""}${db.ihpr.tumbuh}% vs tahun lalu)` : ""}` : "-"}</td></tr></tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Pernikahan dan kelahiran dipakai sebagai gambaran jumlah calon pembeli rumah pertama. Data tahunan diulang tiap bulan di Excel.</p></div>}
      {d.makro && d.makro.some((m) => m.korelasi !== null) && <div className="card"><h2>Hubungan dengan UTJ</h2>
        <table className="compact"><thead><tr><th>Indikator</th><th className="n">Terakhir</th><th className="n">Korelasi UTJ</th><th className="n">Korelasi (lag 1 bln)</th></tr></thead><tbody>{d.makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.nilaiTerakhir ?? "-"}</td><td className="n">{m.korelasi ?? "-"}</td><td className="n">{m.korelasiLag1 ?? "-"}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Korelasi di bawah 0,3 dianggap lemah: indikator ini konteks, bukan penggerak proyeksi.</p></div>}
    </main></>);
}
