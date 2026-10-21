// Sesi login: cookie bertanda tangan HMAC-SHA256 (Web Crypto, jalan di Edge middleware maupun Node). Tanpa dependensi tambahan.

export const COOKIE = "fs_sess";
export const TTL_DETIK = 12 * 3600;
export const TTL_INGAT_DETIK = 30 * 24 * 3600;
export type Peran = "admin" | "viewer";
export interface Sesi { uid: number; em: string; nm: string; rl: Peran; exp: number }

const enc = new TextEncoder();
const b64u = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const key = (secret: string, use: "sign" | "verify") => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [use]);

/** SESSION_SECRET wajib minimal 32 karakter; tanpa itu semua halaman tetap terkunci. */
export const secretValid = (s?: string): s is string => !!s && s.length >= 32;

export async function signSession(s: Sesi, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret, "sign"), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}

export async function verifySession(token: string | undefined, secret: string | undefined, nowDetik = Date.now() / 1000): Promise<Sesi | null> {
  if (!token || !secretValid(secret)) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret, "verify"), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64u(body))) as Sesi;
    if (typeof s.uid !== "number" || typeof s.em !== "string" || (s.rl !== "admin" && s.rl !== "viewer") || typeof s.exp !== "number" || s.exp < nowDetik) return null;
    return s;
  } catch { return null; }
}

export type Putusan = "izinkan" | "login" | "401" | "403";

/** Aturan akses (murni, dipakai middleware). */
export function putusanAkses(a: { path: string; method: string; sesi: Sesi | null; adaAuthHeader: boolean }): Putusan {
  const { path, method, sesi, adaAuthHeader } = a;
  if (path === "/login" || (path === "/api/auth/login" && method === "POST") || (path === "/api/auth/logout" && method === "POST")) return "izinkan";
  // Endpoint yang memeriksa sendiri kredensialnya (cron Vercel dan API narasi memakai header Authorization: Bearer ...)
  if (adaAuthHeader && ((method === "GET" && (path === "/api/sync" || path === "/api/macro-sync")) || (method === "POST" && (path === "/api/narasi" || path === "/api/excel-masuk")))) return "izinkan";
  const api = path.startsWith("/api/");
  if (!sesi) return api ? "401" : "login";
  const adminSaja = path === "/pengguna" || path.startsWith("/api/pengguna") || path === "/api/upload" || path === "/api/manual" || path === "/api/target" || ((path === "/api/macro-sync" || path === "/api/sync") && method === "POST");
  if (adminSaja && sesi.rl !== "admin") return "403";
  return "izinkan";
}

/** Tujuan setelah login: hanya jalur relatif di situs ini (cegah pengalihan ke situs lain). */
export function amanNext(n?: string | null): string {
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\") || n.startsWith("/login") || n.startsWith("/api/")) return "/";
  return n;
}
