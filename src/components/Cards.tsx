import type { cards } from "@/lib/insights";
import { f1 } from "@/lib/format";
type K = ReturnType<typeof cards>;
export function Cards({ k }: { k: K }) {
  const { funnel: f } = k;
  const p = (a: number) => (f.utj ? Math.round((a / f.utj) * 100) : 0);
  return (
    <div className="cards">
      <div className="card"><h2>Funnel penjualan</h2><table className="mini"><tbody>
        <tr><td>UTJ</td><td className="n">{f.utj}</td></tr><tr><td>SPR & PPJB</td><td className="n">{f.spr} ({p(f.spr)}%)</td></tr>
        <tr><td>Akad</td><td className="n">{f.akad} ({p(f.akad)}%)</td></tr><tr><td>Batal</td><td className="n">{f.batal} ({p(f.batal)}%)</td></tr><tr><td>Pencairan</td><td className="n">{f.cair}</td></tr></tbody></table></div>
      <div className="card"><h2>Penjualan per tipe rumah</h2><table><thead><tr><th>Tipe</th><th className="n">UTJ</th><th className="n">Akad</th></tr></thead><tbody>{k.byType.map((x) => <tr key={x.tipe}><td>{x.tipe}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td></tr>)}</tbody></table></div>
      <div className="card"><h2>Performa agent</h2><table><thead><tr><th>Agent</th><th className="n">UTJ</th><th className="n">Akad</th><th className="n">Konversi</th></tr></thead><tbody>{k.byAgent.map((x) => <tr key={x.agent}><td>{x.agent}</td><td className="n">{x.utj}</td><td className="n">{x.akad}</td><td className="n">{x.konversi}%</td></tr>)}</tbody></table><p className="muted" style={{ fontSize: 12 }}>Sampel per agent kecil: baca sebagai hipotesis.</p></div>
      <div className="card"><h2>Sumber leads (porsi UTJ)</h2><p className="muted" style={{ fontSize: 12 }}>Dari kolom Asal Leads di PENJUALAN; terisi hanya untuk sebagian kecil UTJ.</p><table><tbody>{k.leads.map((x) => <tr key={x.sumber}><td>{x.sumber}</td><td className="n">{x.utj} ({x.porsi}%)</td></tr>)}</tbody></table></div>
      <div className="card"><h2>Proses bank</h2><table><thead><tr><th>Bank</th><th className="n">Berkas</th><th className="n">Approve</th><th className="n">Hari</th></tr></thead><tbody>{k.bank.map((x) => <tr key={x.bank}><td>{x.bank}</td><td className="n">{x.berkas}</td><td className="n">{x.approve}%</td><td className="n">{x.hari === null ? "-" : f1(x.hari)}</td></tr>)}</tbody></table></div>
      <div className="card"><h2>Alasan batal</h2><p className="muted" style={{ fontSize: 12 }}>Tercatat untuk {k.alasan.tercatat} dari {k.alasan.total} kasus batal.</p><table><tbody>{k.alasan.rinci.map((x) => <tr key={x.alasan}><td>{x.alasan}</td><td className="n">{x.jml}</td></tr>)}</tbody></table></div>
    </div>
  );
}
