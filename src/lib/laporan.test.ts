import { it, expect } from "vitest";
import { priceByType, avgNetPrice } from "./laporan";
const t = [
  { utj: "2025-01", akad: "2025-02", tipe: "A", netPrice: 6e8 },
  { utj: "2025-01", akad: "2025-03", tipe: "A", netPrice: 8e8 },
  { utj: "2025-01", akad: "2025-03", tipe: "B", netPrice: 1e9 },
  { utj: "2025-01", tipe: "B", netPrice: 9e9 },
];
it("harga per tipe hanya dari akad", () => {
  const p = priceByType(t);
  expect(p[0]).toMatchObject({ tipe: "A", akad: 2, rata: 7e8 });
  expect(p.reduce((a, x) => a + x.porsi, 0)).toBeGreaterThanOrEqual(99);
  expect(avgNetPrice(t)).toBeCloseTo(8e8);
});
