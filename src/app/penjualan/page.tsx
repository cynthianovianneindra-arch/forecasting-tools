import { Nav, badge } from "@/components/Nav";
import { PerformaTim } from "@/components/PerformaTim";
import { BandingMetodeCard } from "@/components/Metode";
import { BatangH, Corong, Donat, Temuan } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { cards } from "@/lib/insights";
import { performaTim } from "@/lib/marketing";
import { f1 } from "@/lib/format";

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
          <div className="card"><h2>Penjualan per tipe rumah</h2><BatangH baris={k.byType.slice(0, 10).map((t) => ({ label: t.tipe, value: t.akad, catatan: `dari ${t.utj} UTJ` }))} />
            <p className="muted" style={{ fontSize: 12 }}>Batang = jumlah akad.</p></div>
          <div className="card"><h2>Sumber leads yang jadi UTJ</h2>{k.leads.length ? <BatangH baris={k.leads.map((l) => ({ label: l.sumber, value: l.porsi, catatan: `${l.utj} UTJ` }))} satuan="%" /> : <p className="muted">Asal leads belum terisi.</p>}
            <p className="muted" style={{ fontSize: 12 }}>Dari kolom Asal Leads di PENJUALAN; terisi hanya untuk sebagian UTJ.</p></div>
        </div></>}
      {pm && pa && <PerformaTim marketing={pm.baris} agent={pa.baris} rataAkad={pm.rataAkad} rataBatal={pm.rataBatal} />}
      <div className="card"><h2>Proyeksi 12 bulan ke depan</h2>
        <table className="compact"><thead><tr><th>Bulan</th><th className="n">UTJ</th><th className="n">Batal</th><th className="n">SPR & PPJB</th><th className="n">Akad</th><th className="n">Penerimaan (Rp M)</th></tr></thead>
          <tbody>{d.f.rows.map((r) => <tr key={r.bulan}><td>{r.bulan}</td><td className="n">{r.utjInt}</td><td className="n">{r.batalInt ?? Math.round(r.batal)}</td><td className="n">{r.spr ?? "-"}</td><td className="n">{r.akadInt}</td><td className="n">{f1(r.akadInt * d.netPrice)}</td></tr>)}</tbody></table></div>
      <BandingMetodeCard banding={d.f.banding} metode={d.f.metode} origins={d.f.bt.origins} />
    </main></>);
}
