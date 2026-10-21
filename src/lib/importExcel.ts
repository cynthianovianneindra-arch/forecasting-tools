import ExcelJS from "exceljs";
import type { Txn } from "./forecast";
import { normalisasiTelepon } from "./rapi";
import { cocokkanLeads, normNama } from "./leads";

/** Leads diagregasi (tanpa nama/telepon) dan biaya event; sumber: sheet LEADS dan EVENT MARKETING. */
export interface LeadAgg { bulan: string; database: string; asal: string; marketing: string; status: string; n: number; survey: number; utj?: number; utjKira?: number; telp?: number; telpValid?: number; ganda?: number }
export interface EventCost { bulan: string; kategori: string; kegiatan: string; biaya: number }
export interface MarketingData { leads: LeadAgg[]; events: EventCost[] }

export interface UnitRow { unit: string; tipe: string; tahap: string; cluster: string; status: string }
export interface MacroRow { bulan: string; emas: number | null; ihsg: number | null; inflasi: number | null; ihpr: number | null; birate: number | null }

export interface ImportReport {
  units?: UnitRow[];
  macro?: MacroRow[];
  marketing?: MarketingData;
  txns: Txn[];
  rows: number;
  utj: number; akad: number; batal: number;
  warnings: string[];
}

const COL = { status: 10, utj: 46, batal: 47, akad: 50 }; // J, AT, AU, AX (SPEC 6.1)
const FIRST_ROW = 4;
const C = { tipe: 3, marketing: 42, agent: 43, leads: 45, spr: 48, cair: 49, alasan: 51 };
const BANK_COLS = [16, 21, 26, 31, 36]; // nama bank; +3 durasi, +4 status berkas

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
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n < FIRST_ROW) return;
    rows++;
    const u = cellToMonth(row.getCell(COL.utj).value, mode);
    const b = cellToMonth(row.getCell(COL.batal).value, mode);
    const a = cellToMonth(row.getCell(COL.akad).value, mode);
    for (const [nama, r] of [["UTJ", u], ["batal", b], ["akad", a]] as const)
      if (r.bad) warnings.push(`Baris ${n}: tanggal ${nama} tidak valid (${r.bad}), diabaikan`);
    if (!u.m) { if (a.m || b.m) warnings.push(`Baris ${n}: ada akad/batal tanpa tanggal UTJ, baris dilewati`); return; }
    if (a.m && b.m) warnings.push(`Baris ${n}: akad dan batal sama-sama terisi`);
    const banks = BANK_COLS.map((c) => ({ bank: normName(row.getCell(c).value), hari: num(row.getCell(c + 3).value), status: text(row.getCell(c + 4).value).toUpperCase() })).filter((x) => x.bank);
    const unitId = normName(row.getCell(2).value);
    utjNama.push({ nama: normNama(text(row.getCell(8).value)), bulan: u.m, marketing: normName(row.getCell(C.marketing).value), telp: kolomTelp ? normalisasiTelepon(row.getCell(kolomTelp).value) : null });
    txns.push({
      utj: u.m, akad: a.m, batal: b.m, ...(unitId ? { unit: unitId } : {}),
      spr: hasValue(row.getCell(C.spr).value),
      cair: cellToMonth(row.getCell(C.cair).value).m !== null,
      tipe: text(row.getCell(C.tipe).value) || undefined,
      marketing: normName(row.getCell(C.marketing).value) || undefined,
      agent: normName(row.getCell(C.agent).value) || undefined,
      leads: text(row.getCell(C.leads).value) || undefined,
      database: text(row.getCell(44).value) || undefined,
      alasanBatal: text(row.getCell(C.alasan).value) || undefined,
      netPrice: ((v) => (v !== null && v > 1e7 ? v : undefined))(num(row.getCell(14).value)),
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

/** Sheet INSTRUMEN EKONOMI (kolom P bulan, Q emas, R IHSG, S inflasi, T IHPR, Z BI Rate). Pernikahan/kelahiran/UMR tahunan sengaja tidak diambil (bukan sinyal bulanan). */
export function parseMacro(wb: ExcelJS.Workbook): MacroRow[] | undefined {
  const I = wb.getWorksheet("INSTRUMEN EKONOMI");
  if (!I) return undefined;
  const out: MacroRow[] = [];
  for (let r = 4; r <= I.rowCount; r++) {
    const row = I.getRow(r), bulan = cellToMonth(val(row.getCell(16))).m;
    if (!bulan) continue;
    out.push({ bulan, emas: num(val(row.getCell(17))), ihsg: num(val(row.getCell(18))), inflasi: num(val(row.getCell(19))), ihpr: num(val(row.getCell(20))), birate: num(val(row.getCell(26))) });
  }
  return out;
}
