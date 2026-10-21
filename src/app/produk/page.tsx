import { Nav, badge } from "@/components/Nav";
import { BatangH, Donat, Temuan } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { minatUnit, rekomendasiOrderBangun } from "@/lib/analisaLanjut";
import { priceByType } from "@/lib/laporan";
import { ARTI_STATUS, stockByType } from "@/lib/stock";
import { addMonths } from "@/lib/forecast";
import { labelPanjang, f1 } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await getData();
  const tx = d.txns;
  const demo = d.source === "demo";
  const minat = demo ? null : minatUnit(tx, d.units);
  const utj12 = d.f.rows.reduce((s, r) => s + r.utjInt, 0), batalPersen = tx.length ? Math.round((tx.filter((t) => t.batal).length / tx.length) * 100) : 0;
  const rek = demo ? null : rekomendasiOrderBangun(tx, d.end, utj12, batalPersen, d.units, d.stokHabis ?? null);
  const harga = demo ? [] : priceByType(tx);
  const status = d.stok?.status.map((s) => ({ label: `${s.status[0]}${s.status.slice(1).toLowerCase()}`, value: s.n })) ?? [];
  const top = minat?.perTipe[0];
  const mulai = rek?.mulaiBulan;
  return (<><Nav active="/produk" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} />
    <main className="wrap stack"><p>{badge(d.source)}</p>
      <div><h1>Produk &amp; Stok</h1><p className="muted" style={{ maxWidth: 680 }}>Unit mana yang paling diminati, berapa stok yang tersedia, dan kapan serta apa yang perlu dibangun berikutnya.</p></div>
      {top && <Temuan judul={`Paling diminati: ${minat!.perTipe.slice(0, 3).map((t) => t.tipe).join(", ")}`} isi={`${top.tipe} mendapat ${top.utj} UTJ (${top.persenAkad}% jadi akad)${top.open === 0 ? " dan stok Open-nya habis" : `; sisa stok Open ${top.open}`}.`} aksi={top.open === 0 ? `prioritaskan order bangun tipe ${top.tipe} dan tipe sejenis.` : undefined} />}
      {rek && <div className="card"><h2>Rekomendasi order bangun</h2>
        <Temuan judul={rek.totalBangun > 0 ? `Bangun ${rek.totalBangun} unit dari unit yang belum dibangun (status Close)` : "Tidak ada unit Close yang perlu dibangun saat ini"}
          isi={`Stok Open${rek.stokHabisBulan === null ? " cukup untuk 12 bulan ke depan" : ` habis di bulan ke-${rek.stokHabisBulan} (${labelPanjang(addMonths(d.end, rek.stokHabisBulan))})`}. Lama order bangun sampai siap dijual diasumsikan ${rek.leadBulan} bulan.${rek.kurangTanpaLahan > 0 ? ` Tambahan ${rek.kurangTanpaLahan} unit dibutuhkan tetapi tidak ada unit Close untuk tipe itu (perlu kapling baru).` : ""}`}
          aksi={mulai === null || mulai === undefined ? "tidak mendesak; tinjau lagi tiap bulan." : mulai === 0 ? "mulai order bangun sekarang." : `mulai order bangun paling lambat dalam ${mulai} bulan (${labelPanjang(addMonths(d.end, mulai))}).`} />
        <table className="compact"><thead><tr><th>Tipe</th><th className="n">Porsi UTJ</th><th className="n">Kebutuhan 12 bln</th><th className="n">Stok Open</th><th className="n">Kurang</th><th className="n">Unit Close</th><th className="n">Bangun</th></tr></thead>
          <tbody>{rek.baris.filter((b) => b.kebutuhan > 0 || b.open > 0).map((b) => <tr key={b.tipe} style={b.bangun > 0 ? { fontWeight: 700 } : undefined}><td>{b.tipe}</td><td className="n">{b.porsi}%</td><td className="n">{b.kebutuhan}</td><td className="n">{b.open}</td><td className="n">{b.kurang}</td><td className="n">{b.belum}</td><td className="n">{b.bangun}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Kebutuhan = proyeksi UTJ 12 bulan x porsi UTJ tipe itu di 12 bulan terakhir x (1 − persen batal). Bangun = yang lebih kecil antara kekurangan dan unit Close tersedia. Perkiraan, bukan perintah: sesuaikan dengan kondisi lapangan.</p></div>}
      <div className="grid">
        {minat && <div className="card"><h2>Peminat per tipe (UTJ)</h2><BatangH baris={minat.perTipe.slice(0, 10).map((t) => ({ label: t.tipe, value: t.utj, catatan: `${t.persenAkad}% akad` }))} />
          <p className="muted" style={{ fontSize: 12 }}>UTJ termasuk yang kemudian batal: gambaran minat, bukan penjualan.</p></div>}
        {d.stok && <div className="card"><h2>Status unit</h2><Donat data={status} tengah={String(d.stok.total)} sub="unit" />
          <p className="muted" style={{ fontSize: 12 }}>{Object.entries(ARTI_STATUS).map(([k, v]) => `${k[0]}${k.slice(1).toLowerCase()} = ${v}`).join("; ")}.</p></div>}
      </div>
      {minat && minat.unitTop.length > 0 && <div className="card"><h2>Unit yang paling banyak diminati</h2>
        <table className="compact"><thead><tr><th>Unit</th><th>Tipe</th><th className="n">Peminat (UTJ)</th><th className="n">Jadi akad</th></tr></thead><tbody>{minat.unitTop.map((u) => <tr key={u.unit}><td>{u.unit}</td><td>{u.tipe}</td><td className="n">{u.peminat}</td><td className="n">{u.akad}</td></tr>)}</tbody></table>
        <p className="muted" style={{ fontSize: 12 }}>Unit dengan banyak UTJ biasanya berulang kali dipesan lalu batal: tinjau posisi, hadap, atau harganya.</p></div>}
      <div className="grid">
        {d.stok && <div className="card"><h2>Stok per tipe</h2>
          <table className="compact"><thead><tr><th>Tipe</th><th className="n">Open</th><th className="n">Belum dibangun</th></tr></thead><tbody>{stockByType(d.stok).map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.open}</td><td className="n">{x.belum}</td></tr>)}</tbody></table></div>}
        {harga.length > 0 && <div className="card"><h2>Harga bersih rata-rata per tipe</h2>
          <table className="compact"><thead><tr><th>Tipe</th><th className="n">Akad</th><th className="n">Rata-rata (Rp M)</th></tr></thead><tbody>{harga.map((h) => <tr key={h.tipe}><td>{h.tipe}</td><td className="n">{h.akad}</td><td className="n">{f1(h.rata / 1e9)}</td></tr>)}</tbody></table></div>}
      </div>
      {!d.stok && !demo && <p className="warn">Data unit (sheet UNIT) belum ada. Unggah ulang Excel lengkap.</p>}
    </main></>);
}
