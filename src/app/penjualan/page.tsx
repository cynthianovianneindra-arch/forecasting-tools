import { Nav, badge } from "@/components/Nav";
import { PerformaTim } from "@/components/PerformaTim";
import { BandingMetodeCard } from "@/components/Metode";
import { BatangH, Corong, Donat, Garis, Temuan, Tumpuk } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { cards } from "@/lib/insights";
import { performaTim } from "@/lib/marketing";
import { f1, labelBulan } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await getData();
  const demo = d.source === "demo";
  const k = demo ? null : cards(d.txns);
  const pm = !demo && d.txns.length ? performaTim(d.txns, "marketing") : null, pa = !demo && d.txns.length ? performaTim(d.txns, "agent") : null;
  const f = k?.funnel;
  const persen = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const bocor = f ? persen(f.batal, f.utj) : 0;
  const alasan = k?.alasan.rinci.map((a) => ({ label: a.alasan, value: a.jml })) ?? [];
  // Data untuk grafik tambahan
  const batalBulan = new Map<string, number>();
  for (const t of d.txns) if (t.batal) batalBulan.set(t.batal, (batalBulan.get(t.batal) ?? 0) + 1);
  const bulan24 = d.monthly.slice(-24);
  const perTahun = new Map<string, { utj: number; akad: number }>();
  for (const m of d.monthly) { const y = m.bulan.slice(0, 4), e = perTahun.get(y) ?? { utj: 0, akad: 0 }; e.utj += m.utj; e.akad += m.akad; perTahun.set(y, e); }
  const tahunList = [...perTahun].sort((a, b) => a[0].localeCompare(b[0])).slice(-5);
  const tipeBaris = k ? k.byType.slice(0, 10).map((t) => { const batal = d.txns.filter((x) => x.tipe === t.tipe && x.batal).length; return { label: t.tipe, nilai: [t.akad, batal, Math.max(0, t.utj - t.akad - batal)], utj: t.utj, akad: t.akad }; }) : [];
  const konversiTipe = tipeBaris.filter((t) => t.utj >= 5).map((t) => ({ label: t.label, value: persen(t.akad, t.utj), catatan: `(${t.utj} UTJ)` })).sort((a, b) => b.value - a.value);
  return (<><Nav active="/penjualan" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} />
    <main className="wrap stack"><p>{badge(d.source)}</p>
      <div><h1>Penjualan</h1><p className="muted" style={{ maxWidth: 680 }}>Dari UTJ sampai akad: di mana pembeli berhenti, tipe apa yang laku, dan siapa yang berkinerja baik.</p></div>
      {!k || !f ? <p className="warn">Belum ada data transaksi. Unggah Excel dulu.</p> : <>
        <Temuan judul={`${persen(f.akad, f.utj)}% UTJ sampai akad, ${bocor}% batal`} isi={`Dari ${f.utj} UTJ: ${f.spr} sampai SPR & PPJB, ${f.akad} akad, ${f.batal} batal${alasan[0] ? `. Alasan batal terbanyak: ${alasan[0].label} (${alasan[0].value} kasus)` : ""}.`}
          aksi={bocor >= 25 ? "tinjau kelayakan KPR calon pembeli sebelum menerima UTJ untuk menekan batal." : "pertahankan proses saat ini."} />
        <div className="grid">
          <div className="card"><h2>Corong penjualan</h2><Corong tahap={[{ label: "UTJ", value: f.utj }, { label: "SPR & PPJB", value: f.spr }, { label: "Akad", value: f.akad }, { label: "Batal", value: f.batal }, { label: "Pencairan", value: f.cair }]} /></div>
          <div className="card"><h2>Alasan batal</h2>{alasan.length ? <Donat data={alasan} tengah={String(f.batal)} sub="batal" /> : <p className="muted">Alasan batal belum tercatat.</p>}
            <p className="muted" style={{ fontSize: 12 }}>Tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus batal.</p></div>
        </div>
        <div className="grid">
          <div className="card"><h2>UTJ, akad, dan batal per bulan</h2><Garis labels={bulan24.map((m) => labelBulan(m.bulan))} deret={[{ nama: "UTJ", nilai: bulan24.map((m) => m.utj) }, { nama: "Akad", nilai: bulan24.map((m) => m.akad) }, { nama: "Batal", nilai: bulan24.map((m) => batalBulan.get(m.bulan) ?? 0), putus: true }]} judul="UTJ, akad, dan batal per bulan" lebar={640} tinggi={220} area={false} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>24 bulan terakhir. Akad dan batal dihitung pada bulan kejadiannya.</p></div>
          <div className="card"><h2>Penjualan per tahun</h2><BatangH baris={tahunList.map(([y, e]) => ({ label: y, value: e.akad, catatan: `akad dari ${e.utj} UTJ` }))} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Batang = jumlah akad per tahun UTJ.</p></div>
        </div>
        <div className="pair">
          <div className="card"><h2>Hasil UTJ per tipe rumah</h2><Tumpuk baris={tipeBaris.map((t) => ({ label: t.label, nilai: t.nilai }))} seri={["Akad", "Batal", "Proses"]} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>10 tipe dengan UTJ terbanyak.</p></div>
          <div className="card"><h2>Konversi UTJ ke akad per tipe</h2>{konversiTipe.length ? <BatangH baris={konversiTipe} satuan="%" maks={100} /> : <p className="muted">Belum ada tipe dengan 5 UTJ atau lebih.</p>}
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Hanya tipe dengan 5 UTJ atau lebih. Angka dalam kurung = jumlah UTJ.</p></div>
        </div>
        <div className="pair">
          <div className="card"><h2>Sumber leads yang jadi UTJ</h2>{k.leads.length ? <BatangH baris={k.leads.map((l) => ({ label: l.sumber, value: l.porsi, catatan: `${l.utj} UTJ` }))} satuan="%" /> : <p className="muted">Asal leads belum terisi.</p>}
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Dari kolom Asal Leads di PENJUALAN; terisi hanya untuk sebagian UTJ.</p></div>
          <div className="card"><h2>Proyeksi 12 bulan: UTJ, akad, dan batal</h2><Garis labels={d.f.rows.map((r) => labelBulan(r.bulan))} deret={[{ nama: "UTJ", nilai: d.f.rows.map((r) => r.utjInt) }, { nama: "Akad", nilai: d.f.rows.map((r) => r.akadInt) }, { nama: "Batal", nilai: d.f.rows.map((r) => r.batalInt ?? Math.round(r.batal)), putus: true }]} judul="Proyeksi UTJ, akad, dan batal 12 bulan" lebar={420} tinggi={200} area={false} />
            <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Angka lengkap ada di tabel proyeksi di bawah.</p></div>
        </div></>}
      {pm && pa && <PerformaTim marketing={pm.baris} agent={pa.baris} rataAkad={pm.rataAkad} rataBatal={pm.rataBatal} />}
      <div className="card"><h2>Proyeksi 12 bulan ke depan</h2>
        <table className="compact"><thead><tr><th>Bulan</th><th className="n">UTJ</th><th className="n">Batal</th><th className="n">SPR & PPJB</th><th className="n">Akad</th><th className="n">Penerimaan (Rp M)</th></tr></thead>
          <tbody>{d.f.rows.map((r) => <tr key={r.bulan}><td>{r.bulan}</td><td className="n">{r.utjInt}</td><td className="n">{r.batalInt ?? Math.round(r.batal)}</td><td className="n">{r.spr ?? "-"}</td><td className="n">{r.akadInt}</td><td className="n">{f1(r.akadInt * d.netPrice)}</td></tr>)}</tbody></table></div>
      <BandingMetodeCard banding={d.f.banding} metode={d.f.metode} origins={d.f.bt.origins} />
    </main></>);
}
