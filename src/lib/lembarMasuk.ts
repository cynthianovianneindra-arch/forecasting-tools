import ExcelJS from "exceljs";

export type Sel = string | number | boolean | null;
export type Lembar = Record<string, Sel[][]>;

/** Daftar sheet yang dibaca aplikasi; sheet lain dari kiriman diabaikan (menjaga ukuran dan privasi). */
export const SHEET_DIPAKAI = ["PENJUALAN", "LEADS", "UNIT", "EVENT MARKETING", "INSTRUMEN EKONOMI"];

/** Susun buku kerja xlsx di memori dari kiriman JSON {sheets: {NAMA: [[baris, ...], ...]}} (mis. dari Office Script). Setiap sheet harus dimulai dari sel A1 agar posisi kolom sama dengan Excel asli. */
export async function bukuDariLembar(sheets: unknown): Promise<ArrayBuffer> {
  if (!sheets || typeof sheets !== "object" || Array.isArray(sheets)) throw new Error("Kiriman harus berisi objek 'sheets'");
  const wb = new ExcelJS.Workbook();
  let n = 0;
  for (const nama of SHEET_DIPAKAI) {
    const baris = (sheets as Record<string, unknown>)[nama];
    if (baris === undefined) continue;
    if (!Array.isArray(baris) || baris.some((r) => !Array.isArray(r))) throw new Error(`Sheet ${nama} harus berupa daftar baris`);
    const ws = wb.addWorksheet(nama);
    (baris as Sel[][]).forEach((r, i) => {
      const row = ws.getRow(i + 1);
      r.forEach((v, j) => { if (v !== null && v !== "") row.getCell(j + 1).value = v as ExcelJS.CellValue; });
      row.commit();
    });
    n++;
  }
  if (!n) throw new Error(`Tidak ada sheet yang dikenal (${SHEET_DIPAKAI.join(", ")})`);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
