import { redirect } from "next/navigation";
import { sesiSaatIni } from "@/lib/auth";
import { amanNext, secretValid } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk · Forecast Penjualan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const q = await searchParams;
  const next = amanNext(q.next);
  if (await sesiSaatIni()) redirect(next);
  const siap = secretValid(process.env.SESSION_SECRET);
  return (
    <main className="login">
      <form method="post" action="/api/auth/login" className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Logo Shaistanaya City" className="login-logo" />
        <h1>Forecast Penjualan</h1>
        <p className="muted">Shaistanaya City · PT Neo Pudji Jaya</p>
        {q.err && <p className="err" role="alert">{q.err}</p>}
        {!siap && <p className="warn">Login belum aktif: isi SESSION_SECRET (minimal 32 karakter) di pengaturan server.</p>}
        <input type="hidden" name="next" value={next} />
        <label className="field">Email<input className="inp" type="email" name="email" required autoComplete="username" autoFocus /></label>
        <label className="field">Kata sandi<input className="inp" type="password" name="password" required autoComplete="current-password" /></label>
        <button className="btn" type="submit" style={{ width: "100%" }}>Masuk</button>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>Akun dibuat oleh admin. Lupa kata sandi? Hubungi admin.</p>
      </form>
    </main>
  );
}
