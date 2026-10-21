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

/** Env bisa berisi kode iframe lengkap, tanda kutip, atau spasi: ambil alamat https-nya saja (atribut src bila ada). */
export function bersihkanTautan(mentah: string): string {
  const t = mentah.trim();
  const src = t.match(/src\s*=\s*["']([^"']+)["']/i)?.[1];
  const u = src ?? t.match(/https?:\/\/[^\s"'<>]+/i)?.[0] ?? t.replace(/^["']|["']$/g, "");
  return u.replace(/&amp;/g, "&").trim();
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Alamat unduhan langsung dari tautan lama/embed OneDrive pribadi (onedrive.live.com dengan resid): /download?cid&resid&authkey. Selain itu null. */
export function unduhanLangsung(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)onedrive\.live\.com$/i.test(u.hostname)) return null;
    const resid = u.searchParams.get("resid"), auth = u.searchParams.get("authkey"), cid = u.searchParams.get("cid");
    if (!resid) return null;
    const q = new URLSearchParams({ resid, ...(auth ? { authkey: auth } : {}), ...(cid ? { cid } : {}) });
    return `https://onedrive.live.com/download?${q.toString()}`;
  } catch { return null; }
}

/** Urutan cara unduh yang dicoba: alamat langsung (bila ada resid), API berbagi publik, lalu tautan + download=1. */
export function kandidatUnduhan(url: string): string[] {
  const langsung = unduhanLangsung(url);
  return [...(langsung ? [langsung] : []), `https://api.onedrive.com/v1.0/shares/${kodeBerbagi(url)}/root/content`, url + (url.includes("?") ? "&" : "?") + "download=1"];
}

export async function unduhDariOneDrive(f: typeof fetch = fetch): Promise<BerkasExcel> {
  const mentah = process.env.ONEDRIVE_EXCEL_URL;
  if (!mentah) throw new Error("ONEDRIVE_EXCEL_URL belum diset di Vercel");
  const url = bersihkanTautan(mentah);
  if (!/^https?:\/\//i.test(url)) throw new Error("ONEDRIVE_EXCEL_URL tidak berisi alamat https yang valid");
  const galat: string[] = [];
  const cara = kandidatUnduhan(url);
  // Tautan pendek (1drv.ms): ikuti pengalihan satu langkah untuk mendapat alamat onedrive.live.com yang memuat resid
  try {
    const r0 = await f(url, { redirect: "manual", headers: { "user-agent": UA }, cache: "no-store" });
    const loc = r0.headers.get("location");
    if (loc) { const abs = new URL(loc, url).toString(); const l = unduhanLangsung(abs); cara.unshift(...(l ? [l] : []), abs + (abs.includes("?") ? "&" : "?") + "download=1"); }
  } catch { /* lanjut dengan cara lain */ }
  for (const u of cara) {
    try {
      const r = await f(u, { redirect: "follow", headers: { "user-agent": UA, accept: "*/*" }, cache: "no-store" });
      if (!r.ok) { galat.push(`${new URL(u).host} ${r.status}`); continue; }
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAKS_BYTE) throw new Error("File Excel lebih dari 30 MB");
      if (!miripXlsx(buf)) { galat.push(`${new URL(u).host} bukan file xlsx`); continue; }
      const cd = r.headers.get("content-disposition") ?? "";
      const nama = decodeURIComponent(cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] ?? "Excel OneDrive.xlsx");
      return { buffer: buf, nama, sidik: sidikBerkas(buf), ambil: new Date().toISOString() };
    } catch (e) { if (e instanceof Error && /30 MB/.test(e.message)) throw e; galat.push(e instanceof Error ? e.message : String(e)); }
  }
  throw new Error(`Tidak bisa mengunduh Excel dari OneDrive (${[...new Set(galat)].join("; ")}). Tautan "1drv.ms/x/c/…" sering ditolak untuk unduhan otomatis; gunakan tautan Embed (alamat di dalam iframe, berawalan onedrive.live.com/embed) atau hubungkan lewat Google Drive.`);
}
