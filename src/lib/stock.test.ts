import { it, expect } from "vitest";
import { stockSummary, stockoutMonth, stockShortfall } from "./stock";
import { macroContext } from "./macro";
it("ringkasan stok", () => {
  const s = stockSummary([{ unit: "A", tipe: "X", tahap: "", cluster: "", status: "Open" }, { unit: "B", tipe: "X", tahap: "", cluster: "", status: "Sold" }, { unit: "C", tipe: "Y", tahap: "", cluster: "", status: "open" }]);
  expect(s).toMatchObject({ total: 3, open: 2, perTipe: [{ tipe: "X", n: 1 }, { tipe: "Y", n: 1 }] });
});
it("Close = belum dibangun dipisah dari stok Open", () => {
  const u = (status: string, tipe = "X") => ({ unit: status + tipe, tipe, tahap: "", cluster: "", status });
  const s = stockSummary([u("Open"), u("Close"), u("Close", "Y"), u("Margal"), u("Sold")]);
  expect(s).toMatchObject({ open: 1, belumDibangun: 2, belumDibangunPerTipe: [{ tipe: "X", n: 1 }, { tipe: "Y", n: 1 }] });
});
it("batal mengembalikan unit ke stok", () => {
  expect(stockoutMonth([5, 5, 5, 5], 12, 0, [0, 2, 2, 2])).toBe(4);
  expect(stockoutMonth([5, 5, 5, 5], 12)).toBe(3);
  expect(stockShortfall([5, 5, 5, 5], 12, [0, 2, 2, 2])).toBe(2);
  expect(stockShortfall([1, 1], 12)).toBe(0);
});
it("bulan stok habis", () => {
  expect(stockoutMonth([5, 5, 5, 5], 12)).toBe(3);
  expect(stockoutMonth([5, 5, 5, 5], 12, 10)).toBeNull();
});
it("konteks makro", () => {
  const m = [1, 2, 3, 4].map((i) => ({ bulan: `2025-0${i}`, emas: i * 10, ihsg: null, inflasi: null, ihpr: null, birate: 3 }));
  const r = macroContext(m, new Map([["2025-01", 2], ["2025-02", 4], ["2025-03", 6], ["2025-04", 8]]));
  expect(r.find((x) => x.indikator.startsWith("Harga emas"))).toMatchObject({ n: 4, korelasi: 1, terakhir: "2025-04" });
  expect(r.find((x) => x.indikator === "IHSG")?.korelasi).toBeNull();
});
