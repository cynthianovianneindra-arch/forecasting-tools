import { Nav, badge } from "@/components/Nav";
import { Analisa } from "@/components/Analisa";
import { PerformaTim } from "@/components/PerformaTim";
import { BatangH, Donat, Garis, Temuan } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { analisaPromo, type VonisPromo } from "@/lib/analisaLanjut";
import { performaTim, pearson } from "@/lib/marketing";
import { labelBulan, f1 } from "@/lib/format";

export const dynamic = "force-dynamic";
const nama = (c: string) => (c.length <= 2 ? `Promo ${c}` : c);
const KELAS: Record<VonisPromo, string> = { Efektif: "ok", Cukup: "", "Perlu diubah": "neg", "Sampel kecil": "" };

export default async function Page() {
  const d = await getData();
  const tx = d.txns;
  const hasil = d.source === "demo" ? null : analisaPromo(tx);
  const pm = tx.length && d.source !== "demo" ? performaTim(tx, "marketing") : null, pa = tx.length && d.source !== "demo" ? performaTim(tx, "agent") : null;
  const efektif = hasil?.baris.filter((b) => b.vonis === "Efektif") ?? [], ubah = hasil?.baris.filter((b) => b.vonis === "Perlu diubah") ?? [];
  // Harga: diskon rata-rata per bulan dan hubungannya dengan UTJ
  const perBulan = new Map<string, { n: number; dis: number[] }>();
  for (const t of tx) { const e = perBulan.get(t.utj) ?? { n: 0, dis: [] }; e.n++; if (t.harga && t.diskon !== undefined) e.dis.push((t.diskon / t.harga) * 100); perBulan.set(t.utj, e); }
  const bulan = [...perBulan.keys()].sort().slice(-24);
  const disBulan = bulan.map((b) => { const e = perBulan.get(b)!; return e.dis.length ? e.dis.reduce((a, c) => a + c, 0) / e.dis.length : null; });
  const pasangan = bulan.map((b, i) => ({ u: perBulan.get(b)!.n, x: disBulan[i] })).filter((p): p is { u: number; x: number } => p.x !== null);
  const rDis = pearson(pasangan.map((p) => p.x), pasangan.map((p) => p.u));
  const disRata = pasangan.length ? pasangan.reduce((a, p) => a + p.x, 0) / pasangan.length : null;
  const mk = d.mk;
  // Hubungan leads dengan UTJ: total leads dan jumlah UTJ per bulan (12 bulan terakhir), dibandingkan sebagai indeks (rata-rata = 100)
  const leadsRaw = d.marketing?.leads ?? [];
  const bulanLeads = [...new Set(leadsRaw.map((l) => l.bulan))].sort().slice(-12);
  const leadBulan = bulanLeads.map((b) => leadsRaw.filter((l) => l.bulan === b).reduce((a, l) => a + l.n, 0));
  const utjBulan = bulanLeads.map((b) => perBulan.get(b)?.n ?? 0);
  const rata = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const idx = (a: number[]) => { const r = rata(a); return a.map((v) => (r ? (v / r) * 100 : 0)); };
  const rLead = bulanLeads.length >= 4 ? pearson(leadBulan, utjBulan) : null;
  const rLead1 = bulanLeads.length >= 5 ? pearson(leadBulan.slice(0, -1), utjBulan.slice(1)) : null; // leads bulan ini vs UTJ bulan depan
  const leadUtj = bulanLeads.length > 1 && rata(leadBulan) > 0 ? { labels: bulanLeads.map(labelBulan), leadRata: rata(leadBulan), utjRata: rata(utjBulan), per100: (rata(utjBulan) / rata(leadBulan)) * 100, deret: [{ nama: "Leads (indeks)", nilai: idx(leadBulan) }, { nama: "UTJ (indeks)", nilai: idx(utjBulan) }] } : null;
  const sumber = mk?.sumber.map((x) => ({ label: x.database, value: Math.round(x.porsiLeads * 10) / 10 })) ?? [];
  return (<><Nav active="/marketing" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} />
    <main className="wrap stack"><p>{badge(d.source)}</p>
      <div><h1>Marketing &amp; Leads</h1><p className="muted" style={{ maxWidth: 680 }}>Apakah promo, harga, dan event saat ini sudah efektif, atau perlu diubah? Semua angka dari data penjualan, leads, dan biaya event.</p></div>
      {!hasil ? <p className="warn">Belum ada data transaksi. Unggah Excel dulu.</p> : <>
        <Temuan judul={efektif.length ? `Promo paling efektif: ${efektif.slice(0, 3).map((b) => nama(b.promo)).join(", ")}` : "Belum ada promo yang jelas lebih baik dari rata-rata"}
          isi={`Dinilai dari persen batal pada UTJ yang sudah selesai (rata-rata seluruh penjualan ${hasil.rataBatal}%). UTJ tanpa promo batal ${hasil.tanpaPromo.persenBatal ?? "-"}% (${hasil.tanpaPromo.utj} UTJ).${ubah.length ? ` Perlu ditinjau: ${ubah.slice(0, 3).map((b) => nama(b.promo)).join(", ")}.` : ""}`}
          aksi={efektif.length ? `pertahankan promo berlabel Efektif${ubah.length ? " dan ubah atau hentikan yang Perlu diubah" : ""}; ukur ulang tiap bulan.` : "uji satu promo per periode agar efeknya bisa dibandingkan."} />
        <div className="grid">
          <div className="card"><h2>Promo: kualitas pembeli</h2>
            <table className="compact"><thead><tr><th>Promo</th><th className="n">UTJ</th><th className="n">% Batal</th><th className="n">Diskon</th><th>Penilaian</th></tr></thead>
              <tbody>{hasil.baris.slice(0, 10).map((b) => <tr key={b.promo}><td>{nama(b.promo)}{b.ppn ? " ★" : ""}</td><td className="n">{b.utj}</td><td className="n">{b.persenBatal === null ? "-" : `${b.persenBatal}%`}</td><td className="n">{b.diskonPersen === null ? "-" : `${b.diskonPersen}%`}</td><td><span className={"tgt-badge " + KELAS[b.vonis]}>{b.vonis}</span></td></tr>)}</tbody></table>
            <p className="muted" style={{ fontSize: 12 }}>★ = promo PPN DTP. % Batal dihitung hanya dari UTJ yang sudah akad atau batal. Diskon = rata-rata diskon terhadap harga.</p></div>
          <div className="card"><h2>UTJ per promo</h2><BatangH baris={hasil.baris.slice(0, 8).map((b) => ({ label: nama(b.promo), value: b.utj }))} /></div>
        </div>
        <div className="stack">
          <div className="card"><h2>Harga dan diskon</h2>
            <Temuan judul={disRata === null ? "Data diskon belum tersedia" : `Diskon rata-rata ${f1(disRata)}% dari harga`} isi={rDis === null ? undefined : `Hubungan diskon bulanan dengan UTJ: ${rDis.toFixed(2)} (${Math.abs(rDis) < 0.3 ? "lemah: diskon lebih besar belum terbukti menaikkan UTJ" : rDis > 0 ? "searah: diskon besar diikuti UTJ lebih banyak" : "berlawanan"}).`} aksi={rDis !== null && Math.abs(rDis) < 0.3 ? "jangan menaikkan diskon dulu; uji paket non-harga (subsidi angsuran, hadiah) yang biayanya lebih ringan." : undefined} />
            <Garis labels={bulan.map(labelBulan)} deret={[{ nama: "Diskon rata-rata (%)", nilai: disBulan }]} judul="Diskon rata-rata per bulan" lebar={720} tinggi={190} /></div>
        </div></>}
      {sumber.length > 0 && <div className="card"><h2>Sumber leads</h2>
        <div className="dua-sisi">
          <Donat data={sumber} tengah={String(mk?.stats.leads ?? "")} sub="leads" satuan="%" persen={false} />
          {leadUtj && <div><b style={{ fontSize: 13 }}>Leads dibanding UTJ per bulan</b>
            <Garis labels={leadUtj.labels} deret={leadUtj.deret} judul="Leads dibanding UTJ per bulan (indeks, rata-rata = 100)" lebar={480} tinggi={200} area={false} format={(v) => String(Math.round(v))} />
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Indeks 100 = rata-rata 12 bulan terakhir: {Math.round(leadUtj.leadRata).toLocaleString("id-ID")} leads dan {f1(leadUtj.utjRata)} UTJ per bulan, sekitar {f1(leadUtj.per100)} UTJ per 100 leads.
              {rLead !== null ? ` Hubungan bulan yang sama ${rLead.toFixed(2)} (${Math.abs(rLead) < 0.3 ? "lemah" : Math.abs(rLead) < 0.6 ? "sedang" : "kuat"})` : ""}{rLead1 !== null ? `; leads bulan ini dengan UTJ bulan depan ${rLead1.toFixed(2)}` : ""}. Korelasi bukan bukti sebab-akibat.</p></div>}
        </div></div>}
      {pm && pa && <PerformaTim marketing={pm.baris} agent={pa.baris} rataAkad={pm.rataAkad} rataBatal={pm.rataBatal} />}
      {mk && <section className="stack"><h2>Efektivitas event dan leads ({mk.stats.periode})</h2><Analisa mk={mk} /></section>}
      {!mk && d.mkAda && <p className="muted">Tidak ada data marketing pada periode ini.</p>}
    </main></>);
}
