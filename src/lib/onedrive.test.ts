import { it, expect, beforeEach, afterEach } from "vitest";
import { kodeBerbagi, miripXlsx, unduhDariOneDrive, sidikBerkas } from "./onedrive";
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

it("unduh: pakai API berbagi, nama dari content-disposition, sidik stabil", async () => {
  const dipanggil: string[] = [];
  const f = (async (u: string) => { dipanggil.push(u); return resp(zip(), 200, 'attachment; filename="FORECASTING UPDATE.xlsx"'); }) as unknown as typeof fetch;
  const r = await unduhDariOneDrive(f);
  expect(dipanggil).toHaveLength(1);
  expect(dipanggil[0]).toContain("api.onedrive.com/v1.0/shares/u!");
  expect(r.nama).toBe("FORECASTING UPDATE.xlsx");
  expect(r.sidik).toBe(sidikBerkas(zip()));
});

it("unduh: cadangan ?download=1 bila API berbagi gagal; HTML ditolak", async () => {
  let n = 0;
  const f1 = (async () => (n++ === 0 ? resp(new ArrayBuffer(0), 403) : resp(zip()))) as unknown as typeof fetch;
  const r = await unduhDariOneDrive(f1);
  expect(n).toBe(2);
  expect(r.nama).toBe("Excel OneDrive.xlsx");
  const html = (async () => resp(new TextEncoder().encode("<html>login</html>").buffer as ArrayBuffer)) as unknown as typeof fetch;
  await expect(unduhDariOneDrive(html)).rejects.toThrow(/Siapa saja yang memiliki link/);
});

it("unduh: tanpa env galat jelas; sinkron tanpa env atau Supabase tidak menyentuh jaringan", async () => {
  delete process.env.ONEDRIVE_EXCEL_URL;
  await expect(unduhDariOneDrive()).rejects.toThrow(/ONEDRIVE_EXCEL_URL/);
  const h = await sinkronOneDrive();
  expect(h.status).toBe("gagal");
  expect(h.pesan).toMatch(/ONEDRIVE_EXCEL_URL/);
});
