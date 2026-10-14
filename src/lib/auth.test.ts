import { it, expect, beforeEach } from "vitest";
import { hashPassword, verifyPassword, validasiPassword, validasiEmail, cekLogin, resetPembatas } from "./auth";
import { signSession, verifySession, putusanAkses, amanNext, Sesi } from "./session";

const SECRET = "x".repeat(40);
const sesi = (o: Partial<Sesi> = {}): Sesi => ({ uid: 1, em: "a@b.co", nm: "A", rl: "viewer", exp: Math.floor(Date.now() / 1000) + 3600, ...o });

it("hash kata sandi: benar lolos, salah ditolak, hash berbeda tiap kali", async () => {
  const h = await hashPassword("rahasia-panjang");
  expect(await verifyPassword("rahasia-panjang", h)).toBe(true);
  expect(await verifyPassword("rahasia-pendek", h)).toBe(false);
  expect(await hashPassword("rahasia-panjang")).not.toBe(h);
  expect(await verifyPassword("x", "bukan-hash")).toBe(false);
});
it("validasi kata sandi dan email", () => {
  expect(validasiPassword("pendek")).toMatch(/8 karakter/);
  expect(validasiPassword("anisa@kantor.co", "Anisa@Kantor.co")).toMatch(/sama dengan email/);
  expect(validasiPassword("kata-sandi-ok")).toBeNull();
  expect(validasiEmail("a@b.co")).toBe(true);
  expect(validasiEmail("tanpa-at")).toBe(false);
});
it("sesi: tanda tangan benar lolos; diubah, kedaluwarsa, secret salah, atau tanpa secret ditolak", async () => {
  const t = await signSession(sesi(), SECRET);
  expect((await verifySession(t, SECRET))?.em).toBe("a@b.co");
  const [b, g] = t.split(".");
  const palsu = Buffer.from(JSON.stringify({ ...sesi(), rl: "admin" })).toString("base64url");
  expect(await verifySession(`${palsu}.${g}`, SECRET)).toBeNull();
  expect(await verifySession(t, "y".repeat(40))).toBeNull();
  expect(await verifySession(t, "pendek")).toBeNull();
  expect(await verifySession(t, undefined)).toBeNull();
  expect(await verifySession(await signSession(sesi({ exp: 10 }), SECRET), SECRET)).toBeNull();
  expect(await verifySession(`${b}.${g}.x`, SECRET)).toBeNull();
  expect(await verifySession(undefined, SECRET)).toBeNull();
});
it("aturan akses", () => {
  const A = (path: string, method = "GET", s: Sesi | null = null, adaAuthHeader = false) => putusanAkses({ path, method, sesi: s, adaAuthHeader });
  expect(A("/")).toBe("login");
  expect(A("/api/narasi", "POST")).toBe("401");
  expect(A("/login")).toBe("izinkan");
  expect(A("/api/auth/login", "POST")).toBe("izinkan");
  expect(A("/api/sync", "GET", null, true)).toBe("izinkan");          // cron Vercel (diperiksa sendiri oleh route)
  expect(A("/api/sync", "GET", null, false)).toBe("401");
  expect(A("/api/upload", "POST", null, true)).toBe("401");           // header Authorization tidak membuka endpoint lain
  expect(A("/", "GET", sesi())).toBe("izinkan");
  expect(A("/laporan", "GET", sesi())).toBe("izinkan");
  expect(A("/pengguna", "GET", sesi())).toBe("403");
  expect(A("/api/upload", "POST", sesi())).toBe("403");
  expect(A("/api/manual", "POST", sesi())).toBe("403");
  expect(A("/api/macro-sync", "POST", sesi())).toBe("403");
  expect(A("/pengguna", "GET", sesi({ rl: "admin" }))).toBe("izinkan");
  expect(A("/api/upload", "POST", sesi({ rl: "admin" }))).toBe("izinkan");
});
it("amanNext hanya jalur relatif di situs ini", () => {
  expect(amanNext("/laporan?jenis=tahunan")).toBe("/laporan?jenis=tahunan");
  expect(amanNext("//evil.com")).toBe("/");
  expect(amanNext("https://evil.com")).toBe("/");
  expect(amanNext("/\\evil.com")).toBe("/");
  expect(amanNext("/login")).toBe("/");
  expect(amanNext("/api/pengguna")).toBe("/");
  expect(amanNext(undefined)).toBe("/");
});

const user = async (o = {}) => ({ id: 7, email: "ani@x.co", nama: "Ani", peran: "viewer" as const, aktif: true, password_hash: await hashPassword("kata-sandi-ani"), dibuat: "", login_terakhir: null, ...o });
beforeEach(() => { resetPembatas(); delete process.env.ADMIN_EMAIL; delete process.env.ADMIN_PASSWORD; });
it("login akun database: benar, salah, nonaktif, tidak ada", async () => {
  const u = await user();
  const deps = { cari: async (e: string) => (e === "ani@x.co" ? u : null), catat: async () => {} };
  expect((await cekLogin("ANI@x.co ", "kata-sandi-ani", "1.1.1.1", deps)).sesi).toMatchObject({ uid: 7, rl: "viewer", em: "ani@x.co" });
  expect((await cekLogin("ani@x.co", "salah", "1.1.1.1", deps)).galat).toBe("Email atau kata sandi salah");
  expect((await cekLogin("tidak@ada.co", "apa-saja-1", "1.1.1.1", deps)).galat).toBe("Email atau kata sandi salah");
  const mati = await user({ aktif: false });
  expect((await cekLogin("ani@x.co", "kata-sandi-ani", "2.2.2.2", { cari: async () => mati })).galat).toBe("Email atau kata sandi salah");
});
it("login admin cadangan dari environment", async () => {
  process.env.ADMIN_EMAIL = "Owner@x.co"; process.env.ADMIN_PASSWORD = "kata-sandi-owner";
  const r = await cekLogin("owner@x.co", "kata-sandi-owner", "3.3.3.3", { cari: async () => null });
  expect(r.sesi).toMatchObject({ uid: 0, rl: "admin" });
  expect((await cekLogin("owner@x.co", "salah", "3.3.3.3", { cari: async () => null })).sesi).toBeUndefined();
});
it("terkunci setelah 5 kali gagal, termasuk dengan kata sandi benar; IP lain tidak terkunci", async () => {
  const u = await user();
  const deps = { cari: async () => u, catat: async () => {} };
  for (let i = 0; i < 5; i++) expect((await cekLogin("ani@x.co", "salah-" + i, "9.9.9.9", deps)).galat).toBe("Email atau kata sandi salah");
  expect((await cekLogin("ani@x.co", "kata-sandi-ani", "9.9.9.9", deps)).galat).toMatch(/Terlalu banyak/);
  expect((await cekLogin("ani@x.co", "kata-sandi-ani", "8.8.8.8", deps)).sesi).toBeDefined();
  const t = Date.now() + 16 * 60 * 1000;
  expect((await cekLogin("ani@x.co", "kata-sandi-ani", "9.9.9.9", { ...deps, now: () => t })).sesi).toBeDefined();
});
