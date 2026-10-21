import { it, expect, beforeEach, afterEach } from "vitest";
import { kodeBerbagi, miripXlsx, unduhDariOneDrive, sidikBerkas, unduhanLangsung, kandidatUnduhan, bersihkanTautan } from "./onedrive";
import { sinkronOneDrive } from "./sinkronExcel";

const URL_BAGI = "https://1drv.ms/x/c/abc/XYZ?e=123";
const zip = () => new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]).buffer;
beforeEach(() => { process.env.ONEDRIVE_EXCEL_URL = URL_BAGI; });
afterEach(() => { delete process.env.ONEDRIVE_EXCEL_URL; });

it("kode berbagi: u! + base64 URL-safe tanpa padding", () => {
  const k = kodeBerbagi("https://1drv.ms/x/s!Abc?e=1&f=~");
  expect(k.startsWith("u!")).toBe(true);
  expect(k).not.toMatch(/[+/=]/);
  expect(Buffer.from(k.slice(2).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()).toBe("https://1drv.ms/x/s!Abc?e=1&f=~");
});

it("mirip xlsx: hanya arsip zip (PK)", () => {
  expect(miripXlsx(zip())).toBe(true);
  expect(miripXlsx(new TextEncoder().encode("<html>").buffer as ArrayBuffer)).toBe(false);
});

const resp = (buf: ArrayBuffer, status = 200, cd?: string) => new Response(buf, { status, headers: cd ? { "content-disposition": cd } : {} });

it("alamat langsung: embed atau tautan lama onedrive.live.com dengan resid diubah ke /download", () => {
  expect(unduhanLangsung("https://onedrive.live.com/embed?cid=ABC&resid=ABC%21123&authkey=%21xyz")).toBe("https://onedrive.live.com/download?resid=ABC%21123&authkey=%21xyz&cid=ABC");
  expect(unduhanLangsung("https://1drv.ms/x/c/abc/XYZ")).toBeNull();
  expect(unduhanLangsung("https://onedrive.live.com/view.aspx")).toBeNull();
  expect(kandidatUnduhan("https://1drv.ms/x/c/abc/XYZ")).toHaveLength(2);
  expect(kandidatUnduhan("https://onedrive.live.com/embed?resid=A%211&authkey=k")[0]).toContain("onedrive.live.com/download");
});

it("unduh: pakai API berbagi, nama dari content-disposition, sidik stabil", async () => {
  const dipanggil: string[] = [];
  const f = (async (u: string, init?: RequestInit) => { dipanggil.push(u); return init?.redirect === "manual" ? new Response(null, { status: 302 }) : resp(zip(), 200, 'attachment; filename="FORECASTING UPDATE.xlsx"'); }) as unknown as typeof fetch;
  const r = await unduhDariOneDrive(f);
  expect(dipanggil.some((u) => u.includes("api.onedrive.com/v1.0/shares/u!"))).toBe(true);
  expect(r.nama).toBe("FORECASTING UPDATE.xlsx");
  expect(r.sidik).toBe(sidikBerkas(zip()));
});

it("unduh: cadangan ?download=1 bila API berbagi gagal; HTML ditolak", async () => {
  let n = 0;
  const f1 = (async (_u: string, init?: RequestInit) => (init?.redirect === "manual" ? new Response(null, { status: 200 }) : n++ === 0 ? resp(new ArrayBuffer(0), 403) : resp(zip()))) as unknown as typeof fetch;
  const r = await unduhDariOneDrive(f1);
  expect(n).toBe(2);
  expect(r.nama).toBe("Excel OneDrive.xlsx");
  const html = (async () => resp(new TextEncoder().encode("<html>login</html>").buffer as ArrayBuffer)) as unknown as typeof fetch;
  await expect(unduhDariOneDrive(html)).rejects.toThrow(/Embed/);
});

it("unduh: tanpa env galat jelas; sinkron tanpa env atau Supabase tidak menyentuh jaringan", async () => {
  delete process.env.ONEDRIVE_EXCEL_URL;
  await expect(unduhDariOneDrive()).rejects.toThrow(/ONEDRIVE_EXCEL_URL/);
  const h = await sinkronOneDrive();
  expect(h.status).toBe("gagal");
  expect(h.pesan).toMatch(/ONEDRIVE_EXCEL_URL/);
});

it("tautan pendek: pengalihan ke onedrive.live.com dengan resid dicoba sebagai unduhan langsung lebih dulu", async () => {
  const dipanggil: string[] = [];
  const f = (async (u: string, init?: RequestInit) => {
    dipanggil.push(u);
    if (init?.redirect === "manual") return new Response(null, { status: 301, headers: { location: "https://onedrive.live.com/redir?resid=A%211&authkey=k&cid=c" } });
    return u.includes("onedrive.live.com/download") ? resp(zip()) : resp(new ArrayBuffer(0), 403);
  }) as unknown as typeof fetch;
  const r = await unduhDariOneDrive(f);
  expect(r.buffer.byteLength).toBeGreaterThan(0);
  expect(dipanggil.find((u) => u.includes("/download"))).toContain("resid=A%211");
});

it("bersihkan tautan: kode iframe, kutip, spasi, dan &amp; menjadi alamat saja", () => {
  expect(bersihkanTautan('<iframe src="https://1drv.ms/x/c/abc/XYZ-1" width="402" height="346" frameborder="0" scrolling="no"></iframe>')).toBe("https://1drv.ms/x/c/abc/XYZ-1");
  expect(bersihkanTautan(' "https://onedrive.live.com/embed?cid=A&amp;resid=B%211&amp;authkey=k"  ')).toBe("https://onedrive.live.com/embed?cid=A&resid=B%211&authkey=k");
  expect(bersihkanTautan("https://1drv.ms/x/c/abc/XYZ")).toBe("https://1drv.ms/x/c/abc/XYZ");
});

it("unduh: env berisi kode iframe tetap dipakai dengan alamat di dalamnya", async () => {
  process.env.ONEDRIVE_EXCEL_URL = '<iframe src="https://1drv.ms/x/c/abc/XYZ" width="402"></iframe>';
  const dipanggil: string[] = [];
  const f = (async (u: string, init?: RequestInit) => { dipanggil.push(u); return init?.redirect === "manual" ? new Response(null, { status: 200 }) : resp(zip()); }) as unknown as typeof fetch;
  await unduhDariOneDrive(f);
  expect(dipanggil.every((u) => !u.includes("iframe"))).toBe(true);
  expect(dipanggil.some((u) => u.includes("api.onedrive.com"))).toBe(true);
});
