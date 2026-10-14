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

/** Ambil potongan teks di sekitar kata kunci (BI-Rate / inflasi) supaya menu navigasi situs tidak memenuhi jatah teks. */
export function sekitarKataKunci(teks: string, indikator: "inflasi" | "birate", lebar = 700, max = 6000): string {
  const re = indikator === "birate" ? /BI[\s-]*Rate|suku bunga acuan/gi : /inflasi|IHK/gi;
  const spans: [number, number][] = [];
  for (const m of teks.matchAll(re)) {
    const a = Math.max(0, m.index! - lebar), b = Math.min(teks.length, m.index! + lebar);
    const last = spans[spans.length - 1];
    if (last && a <= last[1]) last[1] = b; else spans.push([a, b]);
  }
  // Utamakan potongan yang memuat angka persen/desimal (tabel data), bukan menu.
  const punyaAngka = (t: string) => /\d+[.,]\d+/.test(t);
  const potong = spans.map(([a, b]) => teks.slice(a, b)).sort((x, y) => Number(punyaAngka(y)) - Number(punyaAngka(x)));
  return (potong.join(" ... ") || teks).slice(0, max);
}

const RENTANG: Record<"inflasi" | "birate", [number, number]> = { inflasi: [-5, 20], birate: [0, 20] };
const angkaDiTeks = (teks: string, n: number) => [String(n), n.toFixed(1), n.toFixed(2), n.toFixed(2).replace(".", ","), n.toFixed(1).replace(".", ","), String(n).replace(".", ",")].some((v) => teks.includes(v));

/**
 * Ekstraksi angka dari halaman web oleh Claude (cadangan untuk format HTML yang berubah).
 * Penjaga: bulan YYYY-MM valid, nilai dalam rentang wajar, dan angkanya harus benar-benar muncul di teks halaman.
 */
export async function extractFromPage(teks: string, indikator: "inflasi" | "birate", call: (system: string, user: string) => Promise<string>): Promise<{ bulan: string; nilai: number }> {
  const apa = indikator === "inflasi" ? "inflasi tahunan (year on year, persen) terbaru" : "BI-Rate (persen) terbaru";
  const potong = sekitarKataKunci(teks, indikator);
  const out = await call(`Anda mengekstrak data dari teks halaman web. Tugas: cari ${apa}. Balasan Anda harus berupa SATU objek JSON saja, tanpa kalimat lain, tanpa markdown: {"bulan":"YYYY-MM","nilai":2.75} (nilai berupa angka dengan titik desimal). Jika angkanya tidak ada di teks, balas {"bulan":null,"nilai":null}. Jangan menebak atau menghitung; kutip angka persis dari teks.`, potong);
  const m = out.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error(`Balasan Claude bukan JSON (balasan: "${out.replace(/\s+/g, " ").slice(0, 120)}"; teks halaman ${teks.length} karakter, ${potong.length} dikirim, ada angka desimal: ${/\d+[.,]\d+/.test(potong) ? "ya" : "tidak"})`);
  let j: { bulan: string | null; nilai: number | null };
  try { j = JSON.parse(m[0].replace(/("nilai"\s*:\s*)(-?\d+),(\d+)/, "$1$2.$3")); } catch { throw new Error(`Balasan Claude bukan JSON valid ("${m[0].slice(0, 100)}")`); }
  if (!j.bulan || j.nilai === null || j.nilai === undefined) throw new Error("Angka tidak ditemukan di halaman");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(j.bulan)) throw new Error(`Bulan tidak valid: ${j.bulan}`);
  const [lo, hi] = RENTANG[indikator];
  if (typeof j.nilai !== "number" || j.nilai < lo || j.nilai > hi) throw new Error(`Nilai di luar rentang wajar: ${j.nilai}`);
  if (!angkaDiTeks(potong, j.nilai)) throw new Error(`Angka ${j.nilai} tidak ditemukan di teks halaman (kemungkinan halusinasi)`);
  if (!berdekatan(potong, j.bulan, j.nilai)) throw new Error(`Angka ${j.nilai} tidak ditemukan berdekatan dengan bulan ${j.bulan} di teks halaman (bulan dan angka tidak terbukti terkait)`);
  return { bulan: j.bulan, nilai: j.nilai };
}

const NAMA_BULAN = "Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|May|June|July|August|October|December|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Agt|Aug|Sept|Sep|Okt|Oct|Nov|Des|Dec";
const NO_BULAN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const noBulan = (nama: string) => NO_BULAN[nama.slice(0, 3).toLowerCase()];
const angkaId = (t: string) => Number(t.replace(",", "."));

/**
 * Pembacaan tabel tanpa Claude: baris "[tgl] Bulan Tahun  nilai %" dari halaman statistik BI; ambil baris dengan tanggal terbaru.
 * Null bila pola tidak ditemukan (lalu dipakai Claude sebagai cadangan). Untuk inflasi, halaman yang memuat data bulanan (MtM) dilewati
 * agar tidak salah mengambil inflasi bulanan.
 */
export function bacaTabelDeterministik(teks: string, indikator: "inflasi" | "birate"): { bulan: string; nilai: number } | null {
  if (indikator === "inflasi" && /\b(mtm|month[\s-]*to[\s-]*month|bulanan)\b/i.test(teks)) return null;
  const re = new RegExp(`\\b(?:(\\d{1,2})\\s+)?(${NAMA_BULAN})\\b[\\s,.-]*(\\d{4})\\b[^\\d]{0,8}(\\d{1,2}[.,]\\d{1,2})\\s*%?`, "gi");
  let best: { key: number; bulan: string; nilai: number } | null = null;
  for (const m of teks.matchAll(re)) {
    const bln = noBulan(m[2]), th = Number(m[3]), nilai = angkaId(m[4]);
    if (!bln || th < 2000 || th > 2100) continue;
    const [lo, hi] = RENTANG[indikator];
    if (nilai < lo || nilai > hi) continue;
    const key = th * 10000 + bln * 100 + (m[1] ? Number(m[1]) : 0);
    if (!best || key > best.key) best = { key, bulan: `${th}-${String(bln).padStart(2, "0")}`, nilai };
  }
  return best ? { bulan: best.bulan, nilai: best.nilai } : null;
}

/** Angka harus muncul berdekatan (±200 karakter) dengan nama bulan dan tahun yang dilaporkan, bukan sekadar ada di halaman. */
export function berdekatan(teks: string, bulan: string, nilai: number, jarak = 200): boolean {
  const [th, bl] = bulan.split("-");
  const bentuk = [String(nilai), nilai.toFixed(1), nilai.toFixed(2), nilai.toFixed(2).replace(".", ","), nilai.toFixed(1).replace(".", ","), String(nilai).replace(".", ",")];
  const reBulan = new RegExp(`\\b(${NAMA_BULAN})\\b[\\s,.-]*${th}\\b`, "gi");
  const posBulan: number[] = [];
  for (const m of teks.matchAll(reBulan)) if (noBulan(m[1]) === Number(bl)) posBulan.push(m.index!);
  if (!posBulan.length) return false;
  return bentuk.some((v) => { let i = teks.indexOf(v); while (i >= 0) { if (posBulan.some((p) => Math.abs(p - i) <= jarak)) return true; i = teks.indexOf(v, i + 1); } return false; });
}

const LONJAKAN_MAKS: Record<"inflasi" | "birate", number> = { inflasi: 2, birate: 1 };

/** Tolak nilai baru yang melonjak jauh dari nilai tersimpan terakhir; tidak disimpan otomatis, perlu dicek dan diisi manual bila benar. */
export function jagaLonjakan(rows: LiveRow[], hasil: SyncResult[], sebelumnya: { bulan: string; indikator: string; nilai: number }[]): { rows: LiveRow[]; hasil: SyncResult[] } {
  const tolak = new Set<LiveIndikator>();
  const hasilBaru = hasil.map((h) => {
    if ((h.indikator !== "inflasi" && h.indikator !== "birate") || !h.ok || h.nilai === undefined) return h;
    const prev = sebelumnya.filter((x) => x.indikator === h.indikator).sort((a, b) => b.bulan.localeCompare(a.bulan))[0];
    if (!prev || Math.abs(h.nilai - prev.nilai) <= LONJAKAN_MAKS[h.indikator]) return h;
    tolak.add(h.indikator);
    return { ...h, ok: false, error: `Lonjakan dari ${prev.nilai} (${prev.bulan}) ke ${h.nilai} (${h.bulan}) melebihi ${LONJAKAN_MAKS[h.indikator]} poin; tidak disimpan otomatis. Periksa sumber, lalu isi manual di bawah bila benar.` };
  });
  return { rows: rows.filter((r) => !tolak.has(r.indikator)), hasil: hasilBaru };
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
export async function syncLive(deps: { fetch?: typeof fetch; call?: (system: string, user: string) => Promise<string>; lewati?: Set<string> } = {}): Promise<{ rows: LiveRow[]; hasil: SyncResult[] }> {
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
    // Inflasi dan BI Rate berubah bulanan: bila sudah diambil baru-baru ini, lewati supaya tidak memanggil Claude tanpa perlu.
    if (deps.lewati?.has(ind)) { hasil.push({ indikator: ind, ok: true, sumber: "dilewati (sudah diambil dalam 7 hari terakhir)" }); continue; }
    const galat: string[] = [];
    let berhasil = false;
    for (const [url, sumber] of urls) {
      try {
        const halaman = await fetchPage(url, f);
        let v = bacaTabelDeterministik(halaman, ind), cara = "";
        if (!v) {
          // Format tabel tidak dikenali: cadangan memakai Claude (dengan penjaga angka dan bulan).
          if (!deps.call && !process.env.ANTHROPIC_API_KEY) throw new Error("Tabel tidak terbaca dan ANTHROPIC_API_KEY belum diset (dibutuhkan sebagai cadangan)");
          const call = deps.call ?? ((sys: string, usr: string) => import("./claude").then((m) => m.callClaude(sys, usr, "sync")));
          v = await extractFromPage(halaman, ind, call); cara = " [dibaca Claude]";
        }
        rows.push({ bulan: v.bulan, indikator: ind, nilai: v.nilai, sumber: sumber + cara });
        hasil.push({ indikator: ind, ok: true, bulan: v.bulan, nilai: v.nilai, sumber: sumber + cara });
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
