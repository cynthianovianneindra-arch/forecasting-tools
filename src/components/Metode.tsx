import { METODE_LIST, METODE_NAMA, METODE_PENJELASAN, Metode } from "@/lib/forecast";
import type { BandingMetode } from "@/lib/forecast";

const f2 = (n: number) => n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dropdown metode proyeksi UTJ; label menandai metode yang paling mendekati kenyataan pada uji mundur. */
export function MetodeSelect({ metode, terbaik, name = "metode" }: { metode: Metode; terbaik: Metode; name?: string }) {
  return (
    <label className="field">Metode proyeksi
      <select className="inp" name={name} defaultValue={metode} style={{ minWidth: 230 }}>
        {METODE_LIST.map((m) => <option key={m} value={m}>{METODE_NAMA[m]}{m === terbaik ? " (paling mendekati)" : ""}</option>)}
      </select></label>
  );
}

/** Perbandingan tiga metode: makin kecil angka meleset, makin dekat dengan kenyataan saat dicoba ke data lama. */
export function BandingMetodeCard({ banding, metode, origins }: { banding: { baris: BandingMetode[]; terbaik: Metode }; metode: Metode; origins: number }) {
  const terbaik = banding.terbaik;
  const akadTerbaik = [...banding.baris].sort((a, b) => a.akadMaeTotal3 - b.akadMaeTotal3)[0].metode;
  return (
    <div className="card">
      <h2>Metode mana yang paling mendekati?</h2>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>Tiap metode dicoba meramal ke data lama ({origins} kali) lalu dibandingkan dengan kenyataan. Makin kecil angka meleset, makin dekat.</p>
      <table>
        <thead><tr><th>Metode</th><th className="n">UTJ meleset / bulan</th><th className="n">Akad meleset (3 bln)</th></tr></thead>
        <tbody>{banding.baris.map((b) => (
          <tr key={b.metode} style={b.metode === metode ? { fontWeight: 700 } : undefined}>
            <td>{METODE_NAMA[b.metode]}{b.metode === metode ? " (dipakai)" : ""}{b.metode === terbaik ? " ★" : ""}</td>
            <td className="n">{f2(b.utjMae13)} unit</td><td className="n">{f2(b.akadMaeTotal3)} unit</td></tr>))}</tbody>
      </table>
      <p style={{ fontSize: 13, margin: "10px 0 4px" }}>
        <b>{METODE_NAMA[terbaik]}</b> paling mendekati untuk UTJ{akadTerbaik !== terbaik ? <>, sedangkan untuk akad yang paling mendekati adalah <b>{METODE_NAMA[akadTerbaik]}</b></> : " dan akad"}.
        {" "}Selisih antarmetode kecil karena penjualan naik-turun tiap bulan, jadi tidak ada metode yang benar-benar jauh lebih baik.</p>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>{METODE_NAMA[metode]}: {METODE_PENJELASAN[metode]}</p>
    </div>
  );
}
