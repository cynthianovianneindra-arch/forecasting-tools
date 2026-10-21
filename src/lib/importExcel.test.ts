import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { cellToMonth, importPenjualan } from "./importExcel";

it("cellToMonth", () => {
  expect(cellToMonth(new Date(Date.UTC(2025, 2, 15)))).toEqual({ m: "2025-03" });
  expect(cellToMonth(new Date(Date.UTC(2025, 2, 30)), "excel")).toEqual({ m: "2025-04" });
  expect(cellToMonth("#VALUE!").bad).toBe("#VALUE!");
  expect(cellToMonth(null)).toEqual({ m: null });
  expect(cellToMonth(45000).m).toBe("2023-03");
});
it("impor workbook sintetis", async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("PENJUALAN");
  const put = (r: number, utj: unknown, batal: unknown, akad: unknown) => { const row = ws.getRow(r); row.getCell(46).value = utj as never; row.getCell(47).value = batal as never; row.getCell(50).value = akad as never; row.commit(); };
  put(4, new Date(Date.UTC(2024, 0, 10)), null, new Date(Date.UTC(2024, 2, 5)));
  put(5, new Date(Date.UTC(2024, 1, 10)), new Date(Date.UTC(2024, 3, 1)), null);
  put(6, "#VALUE!", null, null);
  const buf = await wb.xlsx.writeBuffer();
  const r = await importPenjualan(buf as ArrayBuffer);
  expect(r).toMatchObject({ utj: 2, akad: 1, batal: 1 });
  expect(r.txns[0]).toMatchObject({ utj: "2024-01", akad: "2024-03", batal: null });
});
it("kolom dicari dari judul: promo 1 sampai 10 dan kolom bank bergeser", async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("PENJUALAN");
  const judul: [number, string, string][] = [[2, "Unit", "Unit"], [8, "Nama User", "Nama User"], [11, "Harga", "Harga"], [12, "Total Diskon", "Total Diskon"], [14, "Net Price", "Net Price"], [25, "Proses Bank", "Nama Bank"], [28, "Proses Bank", "Durasi (Hari)"], [29, "Proses Bank", "Status Berkas"], [50, "Nama Marketing", "Nama Marketing"], [55, "Tanggal", "UTJ"], [56, "Tanggal", "Batal"], [57, "Tanggal", "SPR & PPJB"], [58, "Tanggal", "Pencairan"], [59, "Tanggal", "Akad"]];
  for (const [c, g, s] of judul) { ws.getCell(1, c).value = g; ws.getCell(2, c).value = s; }
  for (let i = 1; i <= 10; i++) { ws.getCell(1, 14 + i).value = "Promo"; ws.getCell(2, 14 + i).value = `Promo ${i}`; }
  const r = ws.getRow(4);
  r.getCell(2).value = "F1-01"; r.getCell(11).value = 800e6; r.getCell(12).value = 40e6; r.getCell(14).value = 760e6;
  r.getCell(15).value = "Kanopi"; r.getCell(17).value = "PPN DTP"; r.getCell(25).value = "BTN"; r.getCell(28).value = 20; r.getCell(29).value = "Approved";
  r.getCell(50).value = "Eki"; r.getCell(55).value = new Date(Date.UTC(2026, 7, 3)); r.getCell(59).value = new Date(Date.UTC(2026, 8, 20));
  const out = await importPenjualan((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  expect(out).toMatchObject({ utj: 1, akad: 1, batal: 0 });
  expect(out.txns[0]).toMatchObject({ utj: "2026-08", akad: "2026-09", marketing: "EKI", unit: "F1-01", harga: 800e6, diskon: 40e6, netPrice: 760e6, promos: ["KANOPI", "PPN DTP"], promo: "KANOPI + PPN DTP" });
  expect(out.txns[0].banks).toEqual([{ bank: "BTN", hari: 20, status: "APPROVED" }]);
});
