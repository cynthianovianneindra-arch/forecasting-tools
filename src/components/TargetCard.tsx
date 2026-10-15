import type { Capaian, UkuranCapaian } from "@/lib/target";
import { persen } from "@/lib/target";
import { labelBulan } from "@/lib/format";

const STATUS = { tercapai: ["Diperkirakan tercapai", "ok"], mendekati: ["Mendekati target", "mid"], "di bawah": ["Di bawah target", "neg"] } as const;

function Baris({ nama, u }: { nama: string; u: UkuranCapaian }) {
  const real = persen(u.realisasiSampaiKini, u.target) ?? 0, perk = persen(u.perkiraanAkhirTahun, u.target) ?? 0;
  const st = u.status ? STATUS[u.status] : null;
  return (
    <div className="tgt-row">
      <div className="tgt-head"><b>{nama}</b><span className="muted">target setahun {u.target}</span>{st && <span className={"tgt-badge " + st[1]}>{st[0]}</span>}</div>
      <div className="tgt-bar" role="img" aria-label={`${nama}: realisasi ${real}% dari target, perkiraan akhir tahun ${perk}%`}>
        <i className="perk" style={{ width: `${Math.min(100, perk)}%` }} /><i className="real" style={{ width: `${Math.min(100, real)}%` }} />
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>
        Sampai sekarang <b>{u.realisasiSampaiKini}</b> ({real}% dari target setahun; target sampai bulan ini {u.targetSampaiKini}). Perkiraan akhir tahun <b>{u.perkiraanAkhirTahun}</b> ({perk}%).
        {u.sisaBulan > 0 && u.perluPerBulan !== null ? <> Untuk sisa {u.sisaBulan} bulan, perlu rata-rata <b>{u.perluPerBulan}</b> per bulan; proyeksi saat ini {u.proyeksiPerBulan} per bulan.</> : null}
      </p>
    </div>
  );
}

/** Target vs realisasi dan perkiraan akhir tahun. Tanpa JavaScript klien. */
export function TargetCard({ c }: { c: Capaian }) {
  return (
    <div className="card"><h2>Target vs realisasi {c.tahun}</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Batang gelap = realisasi sampai {labelBulan(c.sampai)}; batang terang = perkiraan akhir tahun (realisasi + proyeksi). Panjang penuh = target setahun.</p>
      <Baris nama="UTJ" u={c.utj} /><Baris nama="Akad" u={c.akad} />
      {!c.lengkap && <p className="warn">Sebagian bulan belum tercakup proyeksi, jadi perkiraan akhir tahun belum lengkap.</p>}
      <details style={{ marginTop: 10 }}><summary style={{ cursor: "pointer", fontWeight: 600 }}>Rincian per bulan</summary>
        <table className="compact" style={{ marginTop: 8 }}><thead><tr><th>Bulan</th><th>Status</th><th className="n">Target UTJ</th><th className="n">UTJ</th><th className="n">Target akad</th><th className="n">Akad</th></tr></thead><tbody>
          {c.baris.map((b) => <tr key={b.bulan}><td>{labelBulan(b.bulan)}</td><td>{b.aktual ? "Realisasi" : "Proyeksi"}</td><td className="n">{b.targetUtj ?? "-"}</td><td className="n">{b.utj ?? "-"}</td><td className="n">{b.targetAkad ?? "-"}</td><td className="n">{b.akad ?? "-"}</td></tr>)}
          <tr><td><b>Total</b></td><td /><td className="n"><b>{c.utj.target}</b></td><td className="n"><b>{c.utj.perkiraanAkhirTahun}</b></td><td className="n"><b>{c.akad.target}</b></td><td className="n"><b>{c.akad.perkiraanAkhirTahun}</b></td></tr></tbody></table>
      </details>
    </div>
  );
}
