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
  expect(r.txns[0]).toEqual({ utj: "2024-01", akad: "2024-03", batal: null });
});
