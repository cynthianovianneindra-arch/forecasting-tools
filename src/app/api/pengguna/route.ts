import { adminSegar, hashPassword, validasiEmail, validasiPassword } from "@/lib/auth";
import { buatPengguna, cariPenggunaId, ubahPengguna } from "@/lib/users";

export const runtime = "nodejs";

// Kelola pengguna (hanya admin): tambah, ubah peran, aktif/nonaktif, reset kata sandi.
export async function POST(req: Request) {
  const back = (k: "ok" | "err", msg: string) => { const u = new URL("/pengguna", req.url); u.searchParams.set(k, msg); return Response.redirect(u, 303); };
  const admin = await adminSegar();
  if (!admin) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  const f = await req.formData();
  const str = (k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");
  const aksi = str("aksi");
  try {
    if (aksi === "tambah") {
      const email = str("email").toLowerCase(), nama = str("nama"), peran = str("peran") === "admin" ? "admin" : "viewer", pw = typeof f.get("password") === "string" ? (f.get("password") as string) : "";
      if (!validasiEmail(email)) return back("err", "Email tidak valid");
      const bad = validasiPassword(pw, email);
      if (bad) return back("err", bad);
      await buatPengguna({ email, nama, peran, password_hash: await hashPassword(pw) });
      return back("ok", `Pengguna ${email} ditambahkan sebagai ${peran === "admin" ? "admin" : "pengguna (lihat saja)"}`);
    }
    const id = Number(str("id"));
    if (!Number.isInteger(id) || id <= 0) return back("err", "Pengguna tidak dikenal");
    const u = await cariPenggunaId(id);
    if (!u) return back("err", "Pengguna tidak ditemukan");
    const diri = id === admin.uid;
    if (aksi === "peran") {
      const peran = str("peran") === "admin" ? "admin" : "viewer";
      if (diri && peran !== "admin") return back("err", "Anda tidak bisa menurunkan peran akun sendiri");
      await ubahPengguna(id, { peran });
      return back("ok", `Peran ${u.email} diubah menjadi ${peran === "admin" ? "admin" : "pengguna"}`);
    }
    if (aksi === "aktif") {
      const aktif = str("aktif") === "1";
      if (diri && !aktif) return back("err", "Anda tidak bisa menonaktifkan akun sendiri");
      await ubahPengguna(id, { aktif });
      return back("ok", `${u.email} ${aktif ? "diaktifkan" : "dinonaktifkan"}`);
    }
    if (aksi === "reset") {
      const pw = typeof f.get("password") === "string" ? (f.get("password") as string) : "";
      const bad = validasiPassword(pw, u.email);
      if (bad) return back("err", bad);
      await ubahPengguna(id, { password_hash: await hashPassword(pw) });
      return back("ok", `Kata sandi ${u.email} direset`);
    }
    return back("err", "Aksi tidak dikenal");
  } catch (e) { return back("err", e instanceof Error ? e.message : "Gagal menyimpan"); }
}
