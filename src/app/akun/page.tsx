import { Nav } from "@/components/Nav";
import { sesiSaatIni } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const q = await searchParams;
  const s = (await sesiSaatIni())!;
  return (<><Nav active="/akun" updated="Akun saya" /><main className="wrap stack">
    <h1>Akun saya</h1>
    {q.ok && <p className="ok">{q.ok}</p>}{q.err && <p className="err">{q.err}</p>}
    <div className="card"><table className="mini"><tbody>
      <tr><td>Nama</td><td className="n">{s.nm}</td></tr><tr><td>Email</td><td className="n">{s.em}</td></tr>
      <tr><td>Peran</td><td className="n">{s.rl === "admin" ? "Admin (bisa mengunggah data, mengelola pengguna)" : "Pengguna (lihat saja)"}</td></tr></tbody></table></div>
    <div className="card" style={{ maxWidth: 460 }}><h2>Ganti kata sandi</h2>
      {s.uid === 0 ? <p className="muted">Akun admin cadangan memakai ADMIN_PASSWORD di server. Ubah nilainya di pengaturan Vercel lalu deploy ulang.</p> : (
        <form method="post" action="/api/auth/password" className="stack" style={{ gap: 12 }}>
          <label className="field">Kata sandi saat ini<input className="inp" type="password" name="lama" required autoComplete="current-password" /></label>
          <label className="field">Kata sandi baru (minimal 8 karakter)<input className="inp" type="password" name="baru" required minLength={8} autoComplete="new-password" /></label>
          <label className="field">Ulangi kata sandi baru<input className="inp" type="password" name="ulang" required minLength={8} autoComplete="new-password" /></label>
          <button className="btn" type="submit" style={{ alignSelf: "flex-start" }}>Simpan</button>
        </form>)}
    </div></main></>);
}
