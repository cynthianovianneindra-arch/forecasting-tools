const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
import type { TargetRow } from "@/lib/target";

/** Form target satu tahun (admin). Tanpa JavaScript: ganti tahun lewat form GET, simpan lewat POST /api/target. */
export function TargetForm({ tahun, tahunPilihan, ada }: { tahun: string; tahunPilihan: string[]; ada: TargetRow[] }) {
  const tMap = new Map(ada.map((t) => [t.bulan, t]));
  const mm = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="card"><h2>Target penjualan</h2>
      <p className="muted">Isi target UTJ dan akad per bulan untuk satu tahun, atau cukup isi <b>total setahun</b> dan sistem membaginya rata ke 12 bulan (hanya dipakai bila kolom bulanan kosong). Dipakai untuk kartu "Target vs realisasi" di Dashboard dan perbandingan di laporan.</p>
      <form method="get" action="/data" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 }}>
        <label className="field">Tahun<select className="inp" name="tahun" defaultValue={tahun}>{tahunPilihan.map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
        <button className="btn alt" type="submit">Tampilkan</button>
      </form>
      <form method="post" action="/api/target" key={tahun}>
        <input type="hidden" name="tahun" value={tahun} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <label className="field">Total UTJ setahun<input className="inp" name="total_utj" inputMode="numeric" placeholder="mis. 120" /></label>
          <label className="field">Total akad setahun<input className="inp" name="total_akad" inputMode="numeric" placeholder="mis. 80" /></label>
        </div>
        <table className="compact"><thead><tr><th>Bulan</th><th className="n">Target UTJ</th><th className="n">Target akad</th></tr></thead><tbody>
          {NAMA_BULAN.map((nama, i) => { const t = tMap.get(`${tahun}-${mm(i)}`); return <tr key={nama}><td>{nama} {tahun}</td>
            <td className="n"><input className="inp tgt" name={`utj_${mm(i)}`} inputMode="numeric" defaultValue={t?.utj ?? ""} aria-label={`Target UTJ ${nama}`} /></td>
            <td className="n"><input className="inp tgt" name={`akad_${mm(i)}`} inputMode="numeric" defaultValue={t?.akad ?? ""} aria-label={`Target akad ${nama}`} /></td></tr>; })}</tbody></table>
        <p style={{ marginTop: 12 }}><button className="btn" type="submit">Simpan target {tahun}</button></p>
      </form>
    </div>
  );
}
