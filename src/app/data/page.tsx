import { Nav, badge } from "@/components/Nav";
import { getData } from "@/lib/data";
import { ARTI_STATUS } from "@/lib/stock";
import { listDatasets, storeConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const q = await searchParams;
  const d = await getData();
  const hist = await listDatasets();
  const total = d.monthly.reduce((s, m) => ({ u: s.u + m.utj, a: s.a + m.akad }), { u: 0, a: 0 });
  return (<><Nav active="/data" updated="Integrasi belum tersambung" /><main className="wrap stack"><h1>Data &amp; Integrasi</h1><p>{badge(d.source)}</p>
    {q.ok && <p className="ok">{q.ok}</p>}{q.err && <p className="err">{q.err}</p>}
    <div className="card"><h2>Isi data: unggah Excel</h2>
      <p className="muted">Unggah <b>FORECASTING UPDATE.xlsx</b> (sheet PENJUALAN). Hanya transaksi anonim yang disimpan (tanggal UTJ/akad/batal, tipe, agent, marketing, bank, harga); nama pembeli dan nomor telepon tidak dibaca. Data terbaru langsung dipakai Dashboard, Simulasi, dan Laporan.</p>
      {storeConfigured() ? (
        <form action="/api/upload" method="post" encType="multipart/form-data" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <label style={{ fontSize: 13 }}>File .xlsx (maks 4 MB)<br /><input type="file" name="file" accept=".xlsx" required style={{ minHeight: 44 }} /></label>
          <label style={{ fontSize: 13 }}>Batas tutup bulan<br /><select name="mode" defaultValue="kalender" style={{ minHeight: 44 }}><option value="kalender">Kalender</option><option value="excel">Ikuti Excel lama (±2 hari)</option></select></label>
          <label style={{ fontSize: 13 }}>Token unggah<br /><input type="password" name="token" required autoComplete="off" style={{ minHeight: 44 }} /></label>
          <button className="btn" type="submit">Unggah dan proses</button>
        </form>
      ) : <p className="err">Penyimpanan belum disambungkan: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan UPLOAD_TOKEN di server.</p>}
      {d.storeError && <p className="err">Gagal membaca penyimpanan: {d.storeError}</p>}
      {hist.length > 0 && <table style={{ marginTop: 12 }}><thead><tr><th>Diunggah</th><th>File</th><th className="n">UTJ</th><th className="n">Akad</th><th className="n">Batal</th></tr></thead><tbody>{hist.map((h) => <tr key={h.id}><td>{new Date(h.uploaded_at).toLocaleString("id-ID")}</td><td>{h.filename}</td><td className="n">{h.utj}</td><td className="n">{h.akad}</td><td className="n">{h.batal}</td></tr>)}</tbody></table>}
    </div>
    <div className="card"><h2>Pemeriksaan data</h2><table><tbody>
      <tr><td>Total UTJ (target 284)</td><td className="n">{total.u} {total.u === 284 ? "✓" : "✗"}</td></tr>
      <tr><td>Total akad (target 188)</td><td className="n">{total.a} {total.a === 188 ? "✓" : "✗"}</td></tr>
      <tr><td>Bulan terakhir</td><td className="n">{d.end}</td></tr></tbody></table></div>
    {d.report && <div className="card"><h2>Hasil impor Excel</h2><p>{d.report.rows} baris dibaca, {d.report.utj} UTJ, {d.report.akad} akad, {d.report.batal} batal.</p>{d.report.warnings.length > 0 ? <><p className="err">{d.report.warnings.length} peringatan kualitas data</p><ul>{d.report.warnings.slice(0, 20).map((w) => <li key={w}>{w}</li>)}</ul></> : <p>Tidak ada peringatan.</p>}</div>}
    {d.stok && <div className="card"><h2>Master unit (sheet UNIT)</h2><p className="muted">Stok tersedia dijual = status Open. Close = belum dibangun; Margal dan Sold = sudah terjual; Proses = sudah dipesan.</p><table><tbody>{d.stok.status.map((x) => <tr key={x.status}><td>{x.status} <span className="muted">({ARTI_STATUS[x.status] ?? "-"})</span></td><td className="n">{x.n}</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{d.stok.total}</b></td></tr></tbody></table></div>}
    {d.makro && <div className="card"><h2>Data ekonomi dari Excel (INSTRUMEN EKONOMI)</h2><table><thead><tr><th>Indikator</th><th className="n">Data terakhir</th><th className="n">Nilai</th><th className="n">Korelasi dengan UTJ</th></tr></thead><tbody>{d.makro.map((m) => <tr key={m.indikator}><td>{m.indikator}</td><td className="n">{m.terakhir ?? "-"}</td><td className="n">{m.nilaiTerakhir === null ? "-" : m.nilaiTerakhir.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td><td className="n">{m.korelasi ?? "-"}</td></tr>)}</tbody></table><p className="muted">Riwayat dari Excel; data live (di bawah) menimpa bulan yang sama.</p></div>}
    <div className="card"><h2>Pembaruan otomatis data ekonomi</h2>
      <table><thead><tr><th>Indikator</th><th>Sumber</th><th className="n">Bulan terakhir</th><th className="n">Nilai</th><th className="n">Diambil</th></tr></thead><tbody>
        {([["ihsg", "IHSG", "Yahoo Finance (^JKSE)"], ["emas", "Emas USD/oz", "Yahoo Finance (GC=F)"], ["inflasi", "Inflasi tahunan (%)", "bps.go.id"], ["birate", "BI Rate (%)", "bi.go.id"]] as const).map(([k, nama, src]) => { const ls = d.liveStatus.find((x) => x.indikator === k)!; return <tr key={k}><td>{nama}</td><td>{src}</td><td className="n">{ls.bulan ?? "-"}</td><td className="n">{ls.nilai ?? "belum pernah diambil"}</td><td className="n">{ls.diambil ? new Date(ls.diambil).toLocaleString("id-ID") : "-"}</td></tr>; })}</tbody></table>
      <p className="muted">Jika satu sumber gagal, data terakhir tetap dipakai dan alasan gagal tampil di atas halaman. Inflasi dan BI Rate dibaca dari halaman web lalu diekstrak Claude (angka wajib muncul di teks halaman); format halaman bisa berubah, jadi periksa hasilnya.</p>
      {storeConfigured() && <form action="/api/macro-sync" method="post" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}><label style={{ fontSize: 13 }}>Token unggah<br /><input type="password" name="token" required autoComplete="off" style={{ minHeight: 44 }} /></label><button className="btn" type="submit">Sinkron data ekonomi sekarang</button></form>}</div>
    
    <div className="card"><h2>Google Drive</h2>
      {d.driveInfo ? <p>{d.driveInfo.name}, diubah {d.driveInfo.modifiedTime}, diambil {d.driveInfo.fetchedAt}.</p> : <p className="muted">Belum tersambung. Set <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> dan share folder Drive ke email service account (Viewer).</p>}
      {d.driveError && <p className="err">Gagal mengambil dari Drive: {d.driveError}. Memakai data lokal/demo.</p>}
      <form action="/api/sync" method="post"><button className="btn" type="submit">Sinkron semua sekarang</button></form>
      <label>Batas tutup bulan: <select defaultValue="kalender"><option value="kalender">Kalender (tgl 1 – akhir bulan)</option><option value="excel">Ikuti Excel lama (jendela bergeser ±2 hari)</option></select></label></div>
  </main></>);
}
