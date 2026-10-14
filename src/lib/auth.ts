import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { COOKIE, TTL_DETIK, Peran, Sesi, secretValid, signSession, verifySession } from "./session";
import { Pengguna, cariPenggunaEmail, cariPenggunaId, ubahPengguna, usersConfigured } from "./users";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opt: { N: number }) => Promise<Buffer>;
const N = 16384;

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64, { N });
  return `s1$${N}$${salt.toString("base64")}$${h.toString("base64")}`;
}
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [v, n, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const h = await scrypt(pw, Buffer.from(salt, "base64"), 64, { N: Number(n) || N });
  const want = Buffer.from(hash, "base64");
  return h.length === want.length && timingSafeEqual(h, want);
}
export const validasiPassword = (pw: string, email = ""): string | null =>
  pw.length < 8 ? "Kata sandi minimal 8 karakter" : pw.toLowerCase() === email.toLowerCase() ? "Kata sandi tidak boleh sama dengan email" : null;
export const validasiEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;

const samaAman = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

// Pembatas percobaan login (memori instance): 5 gagal per email+IP dalam 15 menit mengunci sementara.
const gagal = new Map<string, { n: number; sampai: number }>();
const BATAS = 5, KUNCI_MS = 15 * 60 * 1000;
export const resetPembatas = () => gagal.clear();

export interface HasilLogin { sesi?: Sesi; galat?: string; pengguna?: Pengguna }
export interface DepsLogin { cari?: (email: string) => Promise<Pengguna | null>; catat?: (id: number) => Promise<void>; now?: () => number }

/** Verifikasi email dan kata sandi: akun admin cadangan dari environment (ADMIN_EMAIL/ADMIN_PASSWORD) atau akun di tabel app_users. */
export async function cekLogin(emailRaw: string, password: string, ip = "-", deps: DepsLogin = {}): Promise<HasilLogin> {
  const now = deps.now ? deps.now() : Date.now();
  const email = emailRaw.trim().toLowerCase();
  const k = `${email}|${ip}`;
  const g = gagal.get(k);
  if (g && g.sampai > now) return { galat: "Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi." };
  const exp = Math.floor(now / 1000) + TTL_DETIK;
  const salah = (): HasilLogin => {
    const c = gagal.get(k);
    const n = c && !(c.sampai !== 0 && c.sampai <= now) ? c.n + 1 : 1; // kunci yang sudah lewat dihitung ulang dari awal
    gagal.set(k, { n, sampai: n >= BATAS ? now + KUNCI_MS : 0 });
    return { galat: "Email atau kata sandi salah" };
  };
  if (!email || !password) return salah();

  const ae = process.env.ADMIN_EMAIL?.trim().toLowerCase(), ap = process.env.ADMIN_PASSWORD;
  if (ae && ap && samaAman(email, ae) && samaAman(password, ap)) {
    gagal.delete(k);
    return { sesi: { uid: 0, em: ae, nm: "Admin (cadangan)", rl: "admin", exp } };
  }
  if (usersConfigured() || deps.cari) {
    const u = await (deps.cari ?? cariPenggunaEmail)(email);
    if (!u) { await verifyPassword(password, "s1$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); return salah(); }  // samakan waktu proses
    if (!u.aktif || !(await verifyPassword(password, u.password_hash))) return salah();
    gagal.delete(k);
    try { await (deps.catat ?? ((id) => ubahPengguna(id, { login_terakhir: new Date().toISOString() })))(u.id); } catch { /* pencatatan tidak boleh menggagalkan login */ }
    return { sesi: { uid: u.id, em: u.email, nm: u.nama || u.email, rl: u.peran, exp }, pengguna: u };
  }
  return salah();
}

export async function buatCookie(sesi: Sesi, secure: boolean): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secretValid(secret)) throw new Error("SESSION_SECRET belum diset (minimal 32 karakter)");
  const sisa = Math.max(0, sesi.exp - Math.floor(Date.now() / 1000));
  return `${COOKIE}=${await signSession(sesi, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sisa}${secure ? "; Secure" : ""}`;
}
export const cookieHapus = (secure: boolean) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
export const isSecure = (req: Request) => process.env.NODE_ENV === "production" || req.headers.get("x-forwarded-proto") === "https";

/** Sesi dari cookie pada permintaan saat ini (server component atau route). */
export async function sesiSaatIni(): Promise<Sesi | null> {
  const c = (await cookies()).get(COOKIE)?.value;
  return verifySession(c, process.env.SESSION_SECRET);
}
/** Sesi admin yang masih sah: akun di database harus masih aktif dan tetap admin (cookie dari akun yang dinonaktifkan tidak lagi berlaku untuk tindakan admin). */
export async function adminSegar(): Promise<Sesi | null> {
  const s = await sesiSaatIni();
  if (!s || s.rl !== "admin") return null;
  if (s.uid === 0) return s;
  try { const u = await cariPenggunaId(s.uid); return u && u.aktif && u.peran === "admin" ? s : null; } catch { return null; }
}
export type { Peran, Sesi };
