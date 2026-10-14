import { hashPassword, sesiSaatIni, validasiPassword, verifyPassword } from "@/lib/auth";
import { cariPenggunaId, ubahPengguna } from "@/lib/users";

export const runtime = "nodejs";

// Ganti kata sandi sendiri. Akun admin cadangan (dari environment) diganti lewat ADMIN_PASSWORD di server.
export async function POST(req: Request) {
  const back = (k: "ok" | "err", msg: string) => { const u = new URL("/akun", req.url); u.searchParams.set(k, msg); return Response.redirect(u, 303); };
  const s = await sesiSaatIni();
  if (!s) return Response.json({ error: "Perlu login" }, { status: 401 });
  if (s.uid === 0) return back("err", "Akun admin cadangan memakai ADMIN_PASSWORD di server; ubah di pengaturan Vercel");
  const f = await req.formData();
  const str = (k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");
  const [lama, baru, ulang] = [str("lama"), str("baru"), str("ulang")];
  if (baru !== ulang) return back("err", "Kata sandi baru dan pengulangannya tidak sama");
  const bad = validasiPassword(baru, s.em);
  if (bad) return back("err", bad);
  try {
    const u = await cariPenggunaId(s.uid);
    if (!u || !u.aktif || !(await verifyPassword(lama, u.password_hash))) return back("err", "Kata sandi saat ini salah");
    await ubahPengguna(u.id, { password_hash: await hashPassword(baru) });
    return back("ok", "Kata sandi berhasil diganti");
  } catch (e) { return back("err", e instanceof Error ? e.message : "Gagal mengganti kata sandi"); }
}
