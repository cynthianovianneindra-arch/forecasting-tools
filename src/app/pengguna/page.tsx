import { Nav } from "@/components/Nav";
import { adminSegar } from "@/lib/auth";
import { Pengguna, SQL_TABEL_PENGGUNA, daftarPengguna, usersConfigured } from "@/lib/users";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const q = await searchParams;
  const admin = await adminSegar();
  if (!admin) return (<><Nav active="/pengguna" updated="Pengguna" /><main className="wrap"><p className="err">Halaman ini hanya untuk admin.</p></main></>);
  let list: Pengguna[] = [], galat = "";
  if (usersConfigured()) { try { list = await daftarPengguna(); } catch (e) { galat = e instanceof Error ? e.message : String(e); } }
  const tgl = (s: string | null) => (s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "belum pernah");
  return (<><Nav active="/pengguna" updated="Kelola pengguna" /><main className="wrap stack">
    <h1>Pengguna</h1>
    {q.ok && <p className="ok">{q.ok}</p>}{q.err && <p className="err">{q.err}</p>}
    {!usersConfigured() && <p className="warn">SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diset, jadi hanya akun admin cadangan (ADMIN_EMAIL) yang bisa masuk.</p>}
    {galat && <div className="card"><p className="err">{galat}</p>{/belum dibuat/.test(galat) && <><p className="muted">Jalankan SQL ini sekali di Supabase (SQL Editor), lalu muat ulang halaman:</p><pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--chip)", padding: 12, borderRadius: 12 }}>{SQL_TABEL_PENGGUNA}</pre></>}</div>}
    {usersConfigured() && !galat && <>
      <div className="card"><h2>Tambah pengguna</h2>
        <form method="post" action="/api/pengguna" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <input type="hidden" name="aksi" value="tambah" />
          <label className="field">Email<input className="inp" type="email" name="email" required autoComplete="off" /></label>
          <label className="field">Nama<input className="inp" name="nama" autoComplete="off" /></label>
          <label className="field">Peran<select className="inp" name="peran" defaultValue="viewer"><option value="viewer">Pengguna (lihat saja)</option><option value="admin">Admin</option></select></label>
          <label className="field">Kata sandi awal (min. 8)<input className="inp" type="text" name="password" required minLength={8} autoComplete="off" /></label>
          <button className="btn" type="submit">Tambah</button>
        </form>
        <p className="muted" style={{ fontSize: 12 }}>Sampaikan kata sandi awal ke yang bersangkutan lewat jalur aman; ia bisa menggantinya di menu Akun. <b>Pengguna</b> bisa melihat Dashboard, Simulasi, dan Laporan. <b>Admin</b> juga bisa mengunggah data, input manual, sinkron, membuat narasi Claude, dan mengelola pengguna.</p></div>
      <div className="card"><h2>Daftar pengguna ({list.length})</h2>
        <table><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th>Masuk terakhir</th><th>Tindakan</th></tr></thead><tbody>
          {list.map((u) => (
            <tr key={u.id} style={u.aktif ? undefined : { opacity: 0.6 }}>
              <td><b>{u.nama || u.email}</b><br /><span className="muted" style={{ fontSize: 12 }}>{u.email}</span></td>
              <td><form method="post" action="/api/pengguna" style={{ display: "flex", gap: 6 }}><input type="hidden" name="aksi" value="peran" /><input type="hidden" name="id" value={u.id} />
                <select className="inp" name="peran" defaultValue={u.peran} style={{ minHeight: 36, minWidth: 0 }}><option value="viewer">Pengguna</option><option value="admin">Admin</option></select><button className="btn alt" style={{ minHeight: 36, padding: "0 12px" }} type="submit">Simpan</button></form></td>
              <td>{u.aktif ? "Aktif" : "Nonaktif"}</td>
              <td className="muted" style={{ fontSize: 12 }}>{tgl(u.login_terakhir)}</td>
              <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <form method="post" action="/api/pengguna"><input type="hidden" name="aksi" value="aktif" /><input type="hidden" name="id" value={u.id} /><input type="hidden" name="aktif" value={u.aktif ? "0" : "1"} /><button className="btn alt" style={{ minHeight: 36, padding: "0 12px" }} type="submit">{u.aktif ? "Nonaktifkan" : "Aktifkan"}</button></form>
                <form method="post" action="/api/pengguna" style={{ display: "flex", gap: 6 }}><input type="hidden" name="aksi" value="reset" /><input type="hidden" name="id" value={u.id} /><input className="inp" type="text" name="password" placeholder="kata sandi baru" minLength={8} required autoComplete="off" style={{ minHeight: 36, width: 150, minWidth: 0 }} /><button className="btn alt" style={{ minHeight: 36, padding: "0 12px" }} type="submit">Reset</button></form>
              </div></td></tr>))}
        </tbody></table></div></>}
  </main></>);
}
