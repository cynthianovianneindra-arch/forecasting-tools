import ExcelJS from "exceljs";
import type { Txn } from "./forecast";
import { normalisasiTelepon } from "./rapi";
import { cocokkanLeads, normNama } from "./leads";

/** Leads diagregasi (tanpa nama/telepon) dan biaya event; sumber: sheet LEADS dan EVENT MARKETING. */
export interface LeadAgg { bulan: string; database: string; asal: string; marketing: string; status: string; n: number; survey: number; utj?: number; utjKira?: number; telp?: number; telpValid?: number; ganda?: number }
export interface EventCost { bulan: string; kategori: string; kegiatan: string; biaya: number }
export interface MarketingData { leads: LeadAgg[]; events: EventCost[] }

export interface UnitRow { unit: string; tipe: string; tahap: string; cluster: string; status: string }
export interface MacroRow { bulan: string; emas: number | null; ihsg: number | null; inflasi: number | null; ihpr: number | null; birate: number | null; umrJatim?: number | null; umkSby?: number | null; umkSda?: number | null; nikah?: number | null; lahir?: number | null }

export interface ImportReport {
  units?: UnitRow[];
  macro?: MacroRow[];
  marketing?: MarketingData;
  txns: Txn[];
  rows: number;
  utj: number; akad: number; batal: number;
  warnings: string[];
}

const FIRST_ROW = 4;

/** Posisi kolom sheet PENJUALAN (nomor kolom, mulai 1). Dicari dari judul kolom supaya tetap benar bila kolom bertambah (mis. promo 1 sampai 10); bila judul tidak ketemu, dipakai susunan lama. */
export interface KolomPenjualan {
  unit: number; tipe: number; nama: number; harga: number; diskon: number; net: number; promo: number[];
  bank: number[]; // kolom "Nama Bank"; durasi = +3, status berkas = +4
  marketing: number; agent: number; database: number; leads: number;
  utj: number; batal: number; spr: number; cair: number; akad: number; alasan: number;
}
const KOLOM_LAMA: KolomPenjualan = { unit: 2, tipe: 3, nama: 8, harga: 11, diskon: 12, net: 14, promo: [15], bank: [16, 21, 26, 31, 36], marketing: 42, agent: 43, database: 44, leads: 45, utj: 46, batal: 47, spr: 48, cair: 49, akad: 50, alasan: 51 };

export function petaKolomPenjualan(ws: ExcelJS.Worksheet): KolomPenjualan {
  const k: KolomPenjualan = { ...KOLOM_LAMA, promo: [...KOLOM_LAMA.promo], bank: [...KOLOM_LAMA.bank] };
  const lab: { r: number; c: number; t: string }[] = [];
  for (let r = 1; r <= 3; r++) ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => { const t = text(cell.value).toLowerCase(); if (t) lab.push({ r, c, t }); });
  const cari = (re: RegExp, dari = 0) => lab.filter((x) => x.r <= 2 && x.c > dari && re.test(x.t)).sort((a, b) => a.c - b.c)[0]?.c;
  const set = (key: Exclude<keyof KolomPenjualan, "promo" | "bank">, re: RegExp) => { const c = cari(re); if (c) k[key] = c; };
  set("unit", /^unit$/); set("tipe", /^tipe rumah$/); set("nama", /^nama user$/); set("harga", /^harga$/); set("diskon", /^(total )?diskon/); set("net", /^net price/);
  set("marketing", /^nama marketing$/); set("agent", /^agent$/); set("database", /^database$/); set("leads", /^asal leads$/); set("alasan", /^ket batal$/);
  // tanggal tahap: baris yang memuat "UTJ" di kolom kanan, lalu cari yang lain di baris itu
  const u = lab.find((x) => x.r <= 2 && x.t === "utj" && x.c > 30);
  if (u) {
    const dibaris = (t: string) => lab.find((x) => x.r === u.r && x.c >= u.c && x.t === t)?.c;
    k.utj = u.c; k.batal = dibaris("batal") ?? k.batal; k.spr = dibaris("spr & ppjb") ?? k.spr; k.cair = dibaris("pencairan") ?? k.cair; k.akad = dibaris("akad") ?? k.akad;
  }
  const promo = [...new Set(lab.filter((x) => x.r <= 2 && /^promo\b/.test(x.t)).map((x) => x.c))].sort((a, b) => a - b);
  if (promo.length) k.promo = promo;
  const bank = [...new Set(lab.filter((x) => x.r <= 2 && x.t === "nama bank").map((x) => x.c))].sort((a, b) => a - b);
  if (bank.length) k.bank = bank;
  return k;
}

const text = (v: unknown): string => {
  if (v && typeof v === "object" && "result" in v) return text((v as { result: unknown }).result);
  if (v && typeof v === "object" && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  if (v === null || v === undefined || v instanceof Date) return "";
  if (typeof v === "object") return ""; // sel error ({error}) atau objek lain
  const t = String(v).trim().replace(/\s+/g, " ");
  return /^#/.test(t) ? "" : t;
};
/** Normalisasi nama: huruf besar, spasi rapi; "XAVIER MARKS" -> "XAVIER MARK" (SPEC 6.3 no. 5). */
export const normName = (v: unknown) => text(v).toUpperCase().replace(/^(XAVIER MARK)S$/, "$1");
/** Sel terisi (tanggal, angka, atau teks) dan bukan error/kosong. */
const hasValue = (v: unknown) => {
  if (v === null || v === undefined || v === "") return false;
  if (v && typeof v === "object" && "result" in v) return hasValue((v as { result: unknown }).result);
  if (v && typeof v === "object" && !(v instanceof Date)) return false;
  return !(typeof v === "string" && (/^#/.test(v) || !v.trim()));
};
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(text(v)); return isFinite(n) ? n : null; };

/** Nilai sel -> 'YYYY-MM' atau null. Error Excel (#VALUE!, #N/A, dst.) dan teks non-tanggal dilaporkan, bukan dipakai. */
export function cellToMonth(v: unknown, mode: "kalender" | "excel" = "kalender"): { m: string | null; bad?: string } {
  if (v === null || v === undefined || v === "") return { m: null };
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number") d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  else if (typeof v === "object" && v && "result" in v) return cellToMonth((v as { result: unknown }).result, mode);
  else if (typeof v === "object" && v && "error" in v) return { m: null, bad: String((v as { error: unknown }).error) };
  else if (typeof v === "string") {
    if (/^#/.test(v)) return { m: null, bad: v };
    const t = Date.parse(v);
    if (!isNaN(t)) d = new Date(t); else return { m: null, bad: v };
  }
  if (!d || isNaN(d.getTime())) return { m: null, bad: String(v) };
  // Jendela Excel lama: >= EOMONTH(bulan,-1)-2 dan < EOMONTH(bulan,0)-1 ≈ bergeser 2 hari; tanggal >= 29 dihitung bulan berikutnya.
  const shifted = mode === "excel" && d.getUTCDate() >= 29 ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) : d;
  return { m: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}` };
}

export async function importPenjualan(input: string | Buffer | ArrayBuffer, mode: "kalender" | "excel" = "kalender"): Promise<ImportReport> {
  const wb = new ExcelJS.Workbook();
  if (typeof input === "string") await wb.xlsx.readFile(input); else await wb.xlsx.load(input as ArrayBuffer);
  const ws = wb.getWorksheet("PENJUALAN");
  if (!ws) throw new Error("Sheet PENJUALAN tidak ditemukan");
  const txns: Txn[] = [];
  const utjNama: { nama: string; bulan: string; marketing: string; telp?: string | null }[] = []; // hanya di memori untuk mencocokkan leads; tidak disimpan
  const warnings: string[] = [];
  let rows = 0;
  let kolomTelp = 0; // kolom nomor telepon di PENJUALAN (opsional; hanya dipakai di memori untuk mencocokkan leads)
  for (let r = 1; r <= 3 && !kolomTelp; r++) ws.getRow(r).eachCell((cell, c) => { if (!kolomTelp && /\b(no\.?\s*(tlp|telp|hp|wa)|telepon|telp|tlp|hp|whatsapp)\b/i.test(text(cell.value))) kolomTelp = c; });
  const K = petaKolomPenjualan(ws);
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < FIRST_ROW) return;
    rows++;
    const u = cellToMonth(row.getCell(K.utj).value, mode);
    const b = cellToMonth(row.getCell(K.batal).value, mode);
    const a = cellToMonth(row.getCell(K.akad).value, mode);
    for (const [nama, r] of [["UTJ", u], ["batal", b], ["akad", a]] as const)
      if (r.bad) warnings.push(`Baris ${n}: tanggal ${nama} tidak valid (${r.bad}), diabaikan`);
    if (!u.m) { if (a.m || b.m) warnings.push(`Baris ${n}: ada akad/batal tanpa tanggal UTJ, baris dilewati`); return; }
    if (a.m && b.m) warnings.push(`Baris ${n}: akad dan batal sama-sama terisi`);
    const banks = K.bank.map((c) => ({ bank: normName(row.getCell(c).value), hari: num(row.getCell(c + 3).value), status: text(row.getCell(c + 4).value).toUpperCase() })).filter((x) => x.bank);
    const promos = [...new Set(K.promo.map((c) => text(row.getCell(c).value).toUpperCase()).filter(Boolean))];
    const unitId = normName(row.getCell(K.unit).value);
    utjNama.push({ nama: normNama(text(row.getCell(K.nama).value)), bulan: u.m, marketing: normName(row.getCell(K.marketing).value), telp: kolomTelp ? normalisasiTelepon(row.getCell(kolomTelp).value) : null });
    txns.push({
      utj: u.m, akad: a.m, batal: b.m, ...(unitId ? { unit: unitId } : {}),
      spr: hasValue(row.getCell(K.spr).value),
      cair: cellToMonth(row.getCell(K.cair).value).m !== null,
      tipe: text(row.getCell(K.tipe).value) || undefined,
      marketing: normName(row.getCell(K.marketing).value) || undefined,
      agent: normName(row.getCell(K.agent).value) || undefined,
      leads: text(row.getCell(K.leads).value) || undefined,
      database: text(row.getCell(K.database).value) || undefined,
      alasanBatal: text(row.getCell(K.alasan).value) || undefined,
      netPrice: ((v) => (v !== null && v > 1e7 ? v : undefined))(num(row.getCell(K.net).value)),
      ...(promos.length ? { promo: promos.join(" + "), promos } : {}),
      harga: ((v) => (v !== null && v > 1e7 ? v : undefined))(num(row.getCell(K.harga).value)),
      diskon: ((v) => (v !== null && v > 0 ? v : undefined))(num(row.getCell(K.diskon).value)),
      banks,
    });
  });
  const marketing = parseMarketing(wb, utjNama);
  const units = parseUnits(wb), macro = parseMacro(wb);
  if (units) {
    const byId = new Map(units.map((x) => [x.unit, x]));
    let miss = 0;
    for (const t of txns) {
      const id = t.unit;
      const un = id ? byId.get(id) : undefined;
      if (un) { t.cluster = un.cluster; t.tahap = un.tahap; if (!t.tipe) t.tipe = un.tipe; } else miss++;
    }
    if (miss) warnings.push(`${miss} UTJ tidak ditemukan di sheet UNIT (cluster/tahap kosong)`);
  }
  return { units, macro, marketing, txns, rows, utj: txns.length, akad: txns.filter((t) => t.akad).length, batal: txns.filter((t) => t.batal).length, warnings };
}

const val = (c: ExcelJS.Cell) => { const x = c.value; return x && typeof x === "object" && !(x instanceof Date) && "result" in x ? (x as { result: unknown }).result : x; };

/** Baca LEADS (kolom B database, C asal, D tanggal, I marketing, M status, L tanggal survey) dan EVENT MARKETING (B tanggal, C kegiatan, D kategori, H biaya). Nama dan telepon hanya dibaca di memori (untuk mencocokkan UTJ dan mendeteksi nomor ganda) dan tidak pernah disimpan. */
export function parseMarketing(wb: ExcelJS.Workbook, utjNama: { nama: string; bulan: string; marketing: string; telp?: string | null }[] = []): MarketingData | undefined {
  const L = wb.getWorksheet("LEADS"), E = wb.getWorksheet("EVENT MARKETING");
  if (!L && !E) return undefined;
  const agg = new Map<string, LeadAgg>();
  const baris: { k: string; nama: string; bulan: string; marketing: string; telp: string | null; ada: boolean }[] = [];
  if (L) for (let r = 4; r <= L.rowCount; r++) {
    const row = L.getRow(r);
    const bulan = cellToMonth(val(row.getCell(4))).m;
    if (!bulan) continue;
    const database = normName(val(row.getCell(2))) || "(KOSONG)", asal = normName(val(row.getCell(3))) || "(KOSONG)";
    const marketing = normName(val(row.getCell(9))) || "(KOSONG)", status = normName(val(row.getCell(13)));
    const k = [bulan, database, asal, marketing, status].join("|");
    const e = agg.get(k) ?? { bulan, database, asal, marketing, status, n: 0, survey: 0, utj: 0, utjKira: 0, telp: 0, telpValid: 0, ganda: 0 };
    e.n++; if (cellToMonth(val(row.getCell(12))).m) e.survey++;
    agg.set(k, e);
    // nama dan telepon hanya dibaca di memori: untuk mencocokkan UTJ dan mendeteksi nomor ganda, lalu dibuang
    const mentahTelp = val(row.getCell(6));
    const ada = mentahTelp !== null && mentahTelp !== undefined && String(mentahTelp).trim() !== "";
    baris.push({ k, nama: normNama(val(row.getCell(5))), bulan, marketing, telp: normalisasiTelepon(mentahTelp), ada });
  }
  if (baris.length) {
    const cocok = utjNama.length ? cocokkanLeads(baris.map((b) => ({ nama: b.nama, bulan: b.bulan, marketing: b.marketing, telp: b.telp })), utjNama) : new Map<number, "pasti" | "kira">();
    const lihat = new Set<string>();
    baris.forEach((b, i) => {
      const e = agg.get(b.k)!;
      if (b.ada) e.telp = (e.telp ?? 0) + 1;
      if (b.telp) { e.telpValid = (e.telpValid ?? 0) + 1; if (lihat.has(b.telp)) e.ganda = (e.ganda ?? 0) + 1; else lihat.add(b.telp); }
      const c = cocok.get(i);
      if (c === "pasti") e.utj = (e.utj ?? 0) + 1; else if (c === "kira") e.utjKira = (e.utjKira ?? 0) + 1;
    });
  }
  const events: EventCost[] = [];
  if (E) for (let r = 5; r <= E.rowCount; r++) {
    const row = E.getRow(r);
    const bulan = cellToMonth(val(row.getCell(2))).m, biaya = num(val(row.getCell(8)));
    if (!bulan || biaya === null || biaya <= 0) continue;
    events.push({ bulan, kategori: text(val(row.getCell(4))) || "(lain)", kegiatan: text(val(row.getCell(3))), biaya });
  }
  return { leads: [...agg.values()], events };
}

/** Sheet UNIT: kolom B unit, C tipe, H tahap, I cluster, J status. */
export function parseUnits(wb: ExcelJS.Workbook): UnitRow[] | undefined {
  const U = wb.getWorksheet("UNIT");
  if (!U) return undefined;
  const out: UnitRow[] = [];
  for (let r = 4; r <= U.rowCount; r++) {
    const row = U.getRow(r), unit = normName(val(row.getCell(2)));
    if (!unit) continue;
    out.push({ unit, tipe: text(val(row.getCell(3))), tahap: text(val(row.getCell(8))), cluster: text(val(row.getCell(9))), status: text(val(row.getCell(10))) });
  }
  return out;
}

/** Sheet INSTRUMEN EKONOMI (kolom P bulan, Q emas, R IHSG, S inflasi, T IHPR, U UMR Jatim, V UMK Surabaya, W UMK Sidoarjo, X pernikahan, Y kelahiran, Z BI Rate). UMR/UMK dan pernikahan/kelahiran bersifat tahunan (diulang tiap bulan) dan dipakai sebagai konteks daya beli, bukan sinyal bulanan. */
export function parseMacro(wb: ExcelJS.Workbook): MacroRow[] | undefined {
  const I = wb.getWorksheet("INSTRUMEN EKONOMI");
  if (!I) return undefined;
  const out: MacroRow[] = [];
  for (let r = 4; r <= I.rowCount; r++) {
    const row = I.getRow(r), bulan = cellToMonth(val(row.getCell(16))).m;
    if (!bulan) continue;
    out.push({ bulan, emas: num(val(row.getCell(17))), ihsg: num(val(row.getCell(18))), inflasi: num(val(row.getCell(19))), ihpr: num(val(row.getCell(20))), birate: num(val(row.getCell(26))), umrJatim: num(val(row.getCell(21))), umkSby: num(val(row.getCell(22))), umkSda: num(val(row.getCell(23))), nikah: num(val(row.getCell(24))), lahir: num(val(row.getCell(25))) });
  }
  return out;
}
