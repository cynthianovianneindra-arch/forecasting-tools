import type { MacroRow } from "./importExcel";

export type LiveIndikator = "ihsg" | "emas" | "inflasi" | "birate";
export interface LiveRow { bulan: string; indikator: LiveIndikator; nilai: number; sumber: string }
export interface SyncResult { indikator: LiveIndikator; ok: boolean; bulan?: string; nilai?: number; error?: string; sumber: string }

const UA = "Mozilla/5.0 (compatible; forecasting-tools/1.0)";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const bulanDari = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 7);

/** Respons Yahoo Finance v8 chart (interval 1mo) -> penutupan per bulan. Bulan berjalan memakai harga terakhir. */
export function parseYahooMonthly(json: unknown): { bulan: string; nilai: number }[] {
  const r = (json as { chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] } })?.chart?.result?.[0];
  const ts = r?.timestamp, close = r?.indicators?.quote?.[0]?.close;
  if (!ts || !close) return [];
  const m = new Map<string, number>();
  ts.forEach((t, i) => { const c = close[i]; if (typeof c === "number" && isFinite(c) && c > 0) m.set(bulanDari(t), c); });
  return [...m].map(([bulan, nilai]) => ({ bulan, nilai: +nilai.toFixed(2) })).sort((a, b) => a.bulan.localeCompare(b.bulan));
}

const YAHOO: { symbol: string; indikator: LiveIndikator }[] = [{ symbol: "^JKSE", indikator: "ihsg" }, { symbol: "GC=F", indikator: "emas" }];

export async function fetchYahoo(symbol: string, f: typeof fetch = fetch) {
  const r = await f(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2y&interval=1mo`, { headers: { "user-agent": UA }, cache: "no-store" });
  if (!r.ok) throw new Error(`Yahoo ${symbol}: HTTP ${r.status}`);
  const rows = parseYahooMonthly(await r.json());
  if (!rows.length) throw new Error(`Yahoo ${symbol}: data kosong`);
  return rows;
}

/** Teks polos dari HTML (tanpa script/style/tag), dipotong agar murah untuk Claude. */
export function htmlToText(html: string, max = 12000): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max);
}

const RENTANG: Record<"inflasi" | "birate", [number, number]> = { inflasi: [-5, 20], birate: [0, 20] };
const angkaDiTeks = (teks: string, n: number) => [String(n), n.toFixed(1), n.toFixed(2), n.toFixed(2).replace(".", ","), n.toFixed(1).replace(".", ","), String(n).replace(".", ",")].some((v) => teks.includes(v));

/**
 * Ekstraksi angka dari halaman web oleh Claude (cadangan untuk format HTML yang berubah).
 * Penjaga: bulan YYYY-MM valid, nilai dalam rentang wajar, dan angkanya harus benar-benar muncul di teks halaman.
 */
export async function extractFromPage(teks: string, indikator: "inflasi" | "birate", call: (system: string, user: string) => Promise<string>): Promise<{ bulan: string; nilai: number }> {
  const apa = indikator === "inflasi" ? "inflasi tahunan (year on year, persen) terbaru" : "BI-Rate (persen) terbaru";
  const out = await call(`Anda mengekstrak data dari teks halaman web. Balas HANYA JSON {"bulan":"YYYY-MM","nilai":<angka persen>} untuk ${apa}, atau {"bulan":null,"nilai":null} jika tidak ada. Jangan menebak atau menghitung; kutip angka persis dari teks.`, teks);
  const m = out.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error("Balasan Claude bukan JSON");
  const j = JSON.parse(m[0]) as { bulan: string | null; nilai: number | null };
  if (!j.bulan || j.nilai === null || j.nilai === undefined) throw new Error("Angka tidak ditemukan di halaman");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(j.bulan)) throw new Error(`Bulan tidak valid: ${j.bulan}`);
  const [lo, hi] = RENTANG[indikator];
  if (typeof j.nilai !== "number" || j.nilai < lo || j.nilai > hi) throw new Error(`Nilai di luar rentang wajar: ${j.nilai}`);
  if (!angkaDiTeks(teks, j.nilai)) throw new Error(`Angka ${j.nilai} tidak ditemukan di teks halaman (kemungkinan halusinasi)`);
  return { bulan: j.bulan, nilai: j.nilai };
}

export const BPS_URL = () => process.env.BPS_INFLASI_URL ?? "https://www.bps.go.id/id";
export const BI_INFLASI_URL = () => process.env.BI_INFLASI_URL ?? "https://www.bi.go.id/id/statistik/indikator/data-inflasi.aspx";
export const BI_URL = () => process.env.BI_RATE_URL ?? "https://www.bi.go.id/id/statistik/indikator/BI-Rate.aspx";

export async function fetchPage(url: string, f: typeof fetch = fetch): Promise<string> {
  const r = await f(url, { headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "id-ID,id;q=0.9,en;q=0.8" }, cache: "no-store" });
  if (!r.ok) throw new Error(`${new URL(url).host}: HTTP ${r.status}`);
  return htmlToText(await r.text());
}

/** Ambil semua indikator; kegagalan satu sumber tidak menghentikan yang lain (SPEC 7: pakai data terakhir + peringatan). */
export async function syncLive(deps: { fetch?: typeof fetch; call?: (system: string, user: string) => Promise<string> } = {}): Promise<{ rows: LiveRow[]; hasil: SyncResult[] }> {
  const f = deps.fetch ?? fetch;
  const rows: LiveRow[] = [], hasil: SyncResult[] = [];
  for (const y of YAHOO) {
    try {
      const data = await fetchYahoo(y.symbol, f);
      for (const d of data) rows.push({ bulan: d.bulan, indikator: y.indikator, nilai: d.nilai, sumber: "Yahoo Finance" });
      const last = data[data.length - 1];
      hasil.push({ indikator: y.indikator, ok: true, bulan: last.bulan, nilai: last.nilai, sumber: "Yahoo Finance" });
    } catch (e) { hasil.push({ indikator: y.indikator, ok: false, error: e instanceof Error ? e.message : String(e), sumber: "Yahoo Finance" }); }
  }
  // Inflasi: BPS dulu, cadangan halaman Data Inflasi Bank Indonesia (BPS sering memblokir akses otomatis, HTTP 403).
  const sumberList: { ind: "inflasi" | "birate"; urls: [string, string][] }[] = [
    { ind: "inflasi", urls: [[BPS_URL(), "bps.go.id"], [BI_INFLASI_URL(), "bi.go.id (data inflasi)"]] },
    { ind: "birate", urls: [[BI_URL(), "bi.go.id"]] },
  ];
  for (const { ind, urls } of sumberList) {
    const galat: string[] = [];
    let berhasil = false;
    for (const [url, sumber] of urls) {
      try {
        if (!deps.call && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY belum diset (dibutuhkan untuk membaca halaman)");
        const call = deps.call ?? (await import("./claude")).callClaude;
        const v = await extractFromPage(await fetchPage(url, f), ind, call);
        rows.push({ bulan: v.bulan, indikator: ind, nilai: v.nilai, sumber });
        hasil.push({ indikator: ind, ok: true, bulan: v.bulan, nilai: v.nilai, sumber });
        berhasil = true;
        break;
      } catch (e) { galat.push(`${sumber}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (!berhasil) hasil.push({ indikator: ind, ok: false, error: galat.join(" | "), sumber: urls.map((u) => u[1]).join(" / ") });
  }
  return { rows, hasil };
}

/** Gabungkan riwayat Excel dengan data live; live menimpa bulan yang sama. Inflasi live dalam persen -> pecahan seperti di Excel. */
export function mergeMacro(excel: MacroRow[], live: { bulan: string; indikator: string; nilai: number }[]): MacroRow[] {
  const m = new Map<string, MacroRow>(excel.map((r) => [r.bulan, { ...r }]));
  for (const l of live) {
    const r = m.get(l.bulan) ?? { bulan: l.bulan, emas: null, ihsg: null, inflasi: null, ihpr: null, birate: null };
    if (l.indikator === "ihsg") r.ihsg = l.nilai; else if (l.indikator === "emas") r.emas = l.nilai;
    else if (l.indikator === "inflasi") r.inflasi = l.nilai / 100; else if (l.indikator === "birate") r.birate = l.nilai;
    else if (l.indikator === "ihpr") r.ihpr = l.nilai;
    m.set(l.bulan, r);
  }
  return [...m.values()].sort((a, b) => a.bulan.localeCompare(b.bulan));
}
