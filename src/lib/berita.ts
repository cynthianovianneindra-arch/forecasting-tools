// Berita properti terbaru dari dua situs (hanya judul, tautan, sumber, dan tanggal; isi berita tidak disalin).
// Pembaca tidak bergantung pada nama class situs: artikel dikenali dari pola alamatnya (bisnis.com /read/YYYYMMDD/, cnnindonesia.com /YYYYMMDDhhmmss-).

export interface Berita { judul: string; url: string; sumber: string; tanggal: string | null; topik: string[] }

export const SUMBER_BERITA = [
  { nama: "Bisnis.com", url: "https://ekonomi.bisnis.com/properti", host: /(^|\.)bisnis\.com$/i, tanggalUrl: /\/read\/(\d{4})(\d{2})(\d{2})\//, artikel: /\/read\/\d{8}\// },
  { nama: "CNN Indonesia", url: "https://www.cnnindonesia.com/tag/properti", host: /(^|\.)cnnindonesia\.com$/i, tanggalUrl: /\/(\d{4})(\d{2})(\d{2})\d{6}-\d+-\d+\//, artikel: /\/\d{14}-\d+-\d+\// },
] as const;
type Sumber = (typeof SUMBER_BERITA)[number];

const entitas = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const bersih = (s: string) => entitas(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Topik yang relevan untuk penjualan rumah, dikenali dari kata kunci judul (tanpa AI). */
const TOPIK: [RegExp, string][] = [
  [/\bKPR\b|kredit pemilikan rumah/i, "KPR"],
  [/suku bunga|BI[- ]?Rate/i, "Suku bunga"],
  [/\bPPN\b|pajak|PBB|BPHTB/i, "Pajak"],
  [/subsidi|FLPP|Tapera|rumah murah/i, "Subsidi"],
  [/uang muka|\bDP\b|\bLTV\b/i, "Uang muka"],
  [/harga|inflasi/i, "Harga"],
  [/pengembang|developer|properti|perumahan/i, "Pengembang"],
];
export const topikJudul = (judul: string) => TOPIK.filter(([re]) => re.test(judul)).map(([, n]) => n).filter((n) => n !== "Pengembang" || !TOPIK.slice(0, 6).some(([re]) => re.test(judul))).slice(0, 3);

function tanggalDariUrl(url: string, s: Sumber): string | null {
  const m = url.match(s.tanggalUrl);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function jelajahi(x: unknown, keluar: { judul: string; url: string; tanggal: string | null }[]) {
  if (Array.isArray(x)) { x.forEach((i) => jelajahi(i, keluar)); return; }
  if (!x || typeof x !== "object") return;
  const o = x as Record<string, unknown>;
  const judul = typeof o.headline === "string" ? o.headline : typeof o.name === "string" ? o.name : null;
  const url = typeof o.url === "string" ? o.url : typeof o["@id"] === "string" ? (o["@id"] as string) : null;
  if (judul && url) keluar.push({ judul, url, tanggal: typeof o.datePublished === "string" ? o.datePublished.slice(0, 10) : null });
  for (const v of Object.values(o)) if (v && typeof v === "object") jelajahi(v, keluar);
}

/** Ambil daftar berita dari HTML satu halaman: pertama dari data terstruktur (JSON-LD), lalu dari tautan artikel. */
export function parseBerita(html: string, sumber: Sumber, maks = 10): Berita[] {
  const calon = new Map<string, { judul: string; tanggal: string | null }>();
  const tambah = (urlMentah: string, judulMentah: string, tanggal: string | null) => {
    let u: URL;
    try { u = new URL(entitas(urlMentah), sumber.url); } catch { return; }
    if (!sumber.host.test(u.hostname) || !sumber.artikel.test(u.pathname)) return;
    const judul = bersih(judulMentah);
    if (judul.length < 25 || judul.length > 220 || judul.split(" ").length < 4) return;
    const kunci = u.origin + u.pathname;
    const ada = calon.get(kunci);
    if (!ada || judul.length > ada.judul.length) calon.set(kunci, { judul, tanggal: tanggal ?? ada?.tanggal ?? tanggalDariUrl(u.pathname, sumber) });
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const k: { judul: string; url: string; tanggal: string | null }[] = []; jelajahi(JSON.parse(m[1]), k); k.forEach((b) => tambah(b.url, b.judul, b.tanggal)); } catch { /* JSON-LD rusak: abaikan */ }
  }
  for (const m of html.matchAll(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) tambah(m[1], m[2], null);
  return [...calon].map(([url, b]) => ({ judul: b.judul, url, sumber: sumber.nama, tanggal: b.tanggal ?? tanggalDariUrl(url, sumber), topik: topikJudul(b.judul) }))
    .sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? "")).slice(0, maks);
}

/** Gabungkan berita beberapa sumber: urut tanggal terbaru, bergantian antar sumber bila tanggalnya sama, tanpa judul ganda. */
export function gabungBerita(daftar: Berita[][], total = 8): Berita[] {
  const semua = daftar.flatMap((d, i) => d.map((b, j) => ({ b, j, i })));
  semua.sort((x, y) => (y.b.tanggal ?? "").localeCompare(x.b.tanggal ?? "") || x.j - y.j || x.i - y.i);
  const lihat = new Set<string>(), out: Berita[] = [];
  for (const { b } of semua) { const k = b.judul.toLowerCase().slice(0, 60); if (lihat.has(k)) continue; lihat.add(k); out.push(b); if (out.length >= total) break; }
  return out;
}

const UA = "Mozilla/5.0 (compatible; forecasting-tools/1.0; +riset internal)";
const TTL = 30 * 60 * 1000, BASI = 24 * 3600 * 1000;
let cache: { waktu: number; hasil: { items: Berita[]; galat: string[] } } | null = null;

/** Ambil berita dari semua sumber (batas waktu 7 detik per sumber). Hasil disimpan 30 menit di memori; bila semua gagal, hasil lama (maks. 1 hari) tetap dipakai. */
export async function ambilBerita(f: typeof fetch = fetch, sekarang = Date.now()): Promise<{ items: Berita[]; galat: string[] }> {
  if (cache && sekarang - cache.waktu < TTL) return cache.hasil;
  const galat: string[] = [];
  const daftar = await Promise.all(SUMBER_BERITA.map(async (s) => {
    try {
      const r = await f(s.url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const b = parseBerita(await r.text(), s);
      if (!b.length) throw new Error("tidak ada artikel yang dikenali di halaman");
      return b;
    } catch (e) { galat.push(`${s.nama}: ${e instanceof Error ? e.message : String(e)}`); return [] as Berita[]; }
  }));
  const items = gabungBerita(daftar);
  if (!items.length && cache && sekarang - cache.waktu < BASI) return { items: cache.hasil.items, galat };
  const hasil = { items, galat };
  if (items.length) cache = { waktu: sekarang, hasil };
  return hasil;
}
