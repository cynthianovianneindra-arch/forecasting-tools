import { createHash } from "node:crypto";

// Excel sumber di OneDrive lewat tautan berbagi ("Siapa saja yang memiliki link dapat melihat"). Tautan disimpan di env ONEDRIVE_EXCEL_URL (bukan di kode).
export const onedriveConfigured = () => !!process.env.ONEDRIVE_EXCEL_URL;

/** Kode berbagi OneDrive: "u!" + base64 URL-safe dari tautan, tanpa tanda "=". Dipakai API publik api.onedrive.com/v1.0/shares. */
export function kodeBerbagi(url: string): string {
  return "u!" + Buffer.from(url, "utf8").toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

const MAKS_BYTE = 30 * 1024 * 1024;
export interface BerkasExcel { buffer: ArrayBuffer; nama: string; sidik: string; ambil: string }

/** File xlsx adalah arsip zip: diawali "PK". Menolak halaman login atau galat HTML yang tidak sengaja terunduh. */
export const miripXlsx = (b: ArrayBuffer) => { const u = new Uint8Array(b.slice(0, 2)); return u[0] === 0x50 && u[1] === 0x4b; };
export const sidikBerkas = (b: ArrayBuffer) => createHash("sha256").update(Buffer.from(b)).digest("hex").slice(0, 10);

export async function unduhDariOneDrive(f: typeof fetch = fetch): Promise<BerkasExcel> {
  const url = process.env.ONEDRIVE_EXCEL_URL;
  if (!url) throw new Error("ONEDRIVE_EXCEL_URL belum diset di Vercel");
  const cara = [
    `https://api.onedrive.com/v1.0/shares/${kodeBerbagi(url)}/root/content`,
    url + (url.includes("?") ? "&" : "?") + "download=1",
  ];
  const galat: string[] = [];
  for (const u of cara) {
    try {
      const r = await f(u, { redirect: "follow", cache: "no-store" });
      if (!r.ok) { galat.push(`${new URL(u).host} ${r.status}`); continue; }
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAKS_BYTE) throw new Error("File Excel lebih dari 30 MB");
      if (!miripXlsx(buf)) { galat.push(`${new URL(u).host} bukan file xlsx`); continue; }
      const cd = r.headers.get("content-disposition") ?? "";
      const nama = decodeURIComponent(cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? "Excel OneDrive.xlsx");
      return { buffer: buf, nama, sidik: sidikBerkas(buf), ambil: new Date().toISOString() };
    } catch (e) { if (e instanceof Error && /30 MB/.test(e.message)) throw e; galat.push(e instanceof Error ? e.message : String(e)); }
  }
  throw new Error(`Tidak bisa mengunduh Excel dari OneDrive (${galat.join("; ")}). Pastikan tautan berbagi memberi akses "Siapa saja yang memiliki link dapat melihat".`);
}
