import type { BarisTim, Mutu } from "@/lib/marketing";
import { Tumpuk } from "./Grafik";

const KELAS: Record<Mutu, string> = { Bagus: "ok", Cukup: "", "Perlu perhatian": "neg", "Sampel kecil": "" };

function Tabel({ judul, baris }: { judul: string; baris: BarisTim[] }) {
  return (
    <div className="card"><h2>{judul}</h2>
      <table className="compact"><thead><tr><th>Nama</th><th className="n">UTJ</th><th className="n">Akad</th><th className="n">Batal</th><th className="n">Proses</th><th className="n">% Akad</th><th className="n">% Batal</th><th>Mutu berkas</th></tr></thead>
        <tbody>{baris.slice(0, 12).map((b) => (
          <tr key={b.nama}><td>{b.nama}</td><td className="n">{b.utj}</td><td className="n">{b.akad}</td><td className="n">{b.batal}</td><td className="n">{b.outstanding}</td><td className="n">{b.persenAkad}%</td><td className="n">{b.persenBatal}%</td>
            <td><span className={"tgt-badge " + KELAS[b.mutu]}>{b.mutu}</span></td></tr>))}</tbody></table>
    </div>
  );
}

/** Performa marketing dan agent: banyak UTJ, batal rendah, akad banyak = berkas bagus. */
export function PerformaTim({ marketing, agent, rataAkad, rataBatal }: { marketing: BarisTim[]; agent: BarisTim[]; rataAkad: number; rataBatal: number }) {
  const bagus = (xs: BarisTim[]) => xs.filter((b) => b.mutu === "Bagus").sort((a, b) => b.utj - a.utj).slice(0, 3).map((b) => b.nama);
  const bm = bagus(marketing), ba = bagus(agent);
  return (
    <section className="stack"><h2>Performa marketing dan agent</h2>
      <p className="muted" style={{ margin: 0 }}>Berkas bagus = UTJ banyak, batal rendah, akad banyak. Pembanding: rata-rata seluruh tim akad {rataAkad}% dan batal {rataBatal}%. Nama dengan UTJ kurang dari 5 ditandai sampel kecil.
        {bm.length ? <> Marketing dengan berkas bagus: <b>{bm.join(", ")}</b>.</> : null}{ba.length ? <> Agent: <b>{ba.join(", ")}</b>.</> : null}</p>
      <div className="pair">
        <div className="card"><h2>Hasil UTJ per marketing</h2><Tumpuk baris={marketing.slice(0, 8).map((b) => ({ label: b.nama, nilai: [b.akad, b.batal, b.outstanding] }))} seri={["Akad", "Batal", "Proses"]} />
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>8 marketing dengan UTJ terbanyak. Makin panjang bagian gelap (akad), makin bagus.</p></div>
        <div className="card"><h2>Hasil UTJ per agent</h2><Tumpuk baris={agent.slice(0, 8).map((b) => ({ label: b.nama, nilai: [b.akad, b.batal, b.outstanding] }))} seri={["Akad", "Batal", "Proses"]} />
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>8 agent dengan UTJ terbanyak.</p></div>
      </div>
      <div className="grid"><Tabel judul="Per marketing" baris={marketing} /><Tabel judul="Per agent" baris={agent} /></div>
    </section>
  );
}
