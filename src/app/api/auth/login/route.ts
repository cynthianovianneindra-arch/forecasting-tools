import { buatCookie, cekLogin, isSecure } from "@/lib/auth";
import { TTL_INGAT_DETIK, amanNext, secretValid } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const f = await req.formData();
  const email = typeof f.get("email") === "string" ? (f.get("email") as string) : "";
  const password = typeof f.get("password") === "string" ? (f.get("password") as string) : "";
  const ingat = f.get("ingat") === "1";
  const next = amanNext(typeof f.get("next") === "string" ? (f.get("next") as string) : "");
  const gagal = (msg: string) => {
    const u = new URL("/login", req.url);
    u.searchParams.set("err", msg);
    if (next !== "/") u.searchParams.set("next", next);
    return Response.redirect(u, 303);
  };
  if (!secretValid(process.env.SESSION_SECRET)) return gagal("SESSION_SECRET belum diset di server (minimal 32 karakter); login dinonaktifkan");
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "-";
  let hasil;
  try { hasil = await cekLogin(email, password, ip); } catch (e) { return gagal(e instanceof Error ? e.message : "Gagal memeriksa akun"); }
  if (!hasil.sesi) return gagal(hasil.galat ?? "Email atau kata sandi salah");
  const sesi = ingat ? { ...hasil.sesi, exp: Math.floor(Date.now() / 1000) + TTL_INGAT_DETIK } : hasil.sesi;  // "Ingat saya": 30 hari, selain itu 12 jam
  return new Response(null, { status: 303, headers: { Location: new URL(next, req.url).toString(), "Set-Cookie": await buatCookie(sesi, isSecure(req)) } });
}
