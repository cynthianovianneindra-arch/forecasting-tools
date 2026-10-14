import { it, expect } from "vitest";
import { applyScenario, EMPTY } from "./whatif";
const base = Array.from({ length: 12 }, (_, i) => ({ bulan: `2026-${i + 1}`, utj: 7, utjLo: 3, utjHi: 11, akad: 5, trend: 7 }));
it("skenario kosong = dasar", () => {
  const { rows } = applyScenario(base, EMPTY);
  rows.forEach((r) => { expect(r.utj).toBeCloseTo(7); expect(r.akad).toBeCloseTo(5); });
});
it("harga naik menurunkan UTJ; order bangun menambah", () => {
  expect(applyScenario(base, { ...EMPTY, price: 5 }).rows[0].utj).toBeLessThan(7);
  const s = applyScenario(base, { ...EMPTY, units: 30 }).rows;
  expect(s.reduce((a, r) => a + r.utj, 0)).toBeGreaterThan(84);
});
