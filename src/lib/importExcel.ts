import ExcelJS from "exceljs";
import type { Txn } from "./forecast";

export interface ImportReport {
  txns: Txn[];
  rows: number;
  utj: number; akad: number; batal: number;
  warnings: string[];
}

const COL = { status: 10, utj: 46, batal: 47, akad: 50 }; // J, AT, AU, AX (SPEC 6.1)
const FIRST_ROW = 4;

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
  const warnings: string[] = [];
  let rows = 0;
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
    txns.push({ utj: u.m, akad: a.m, batal: b.m });
  });
  return { txns, rows, utj: txns.length, akad: txns.filter((t) => t.akad).length, batal: txns.filter((t) => t.batal).length, warnings };
}
