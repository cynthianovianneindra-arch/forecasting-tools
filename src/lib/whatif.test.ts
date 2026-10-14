import { it, expect } from "vitest";
import { applyScenario, EMPTY, parseScenario, scenarioQuery, describeScenario } from "./whatif";
const base = Array.from({ length: 12 }, (_, i) => ({ bulan: `2026-${i + 1}`, utj: 7, utjLo: 3, utjHi: 11, akad: 5, akadInt: 5, batal: 0, trend: 7 }));
it("skenario kosong = dasar", () => {
  const { rows } = applyScenario(base, EMPTY);
  rows.forEach((r) => { expect(r.utj).toBeCloseTo(7); expect(r.akad).toBeCloseTo(5); });
});
it("harga naik menurunkan UTJ; order bangun menambah", () => {
  expect(applyScenario(base, { ...EMPTY, price: 5 }).rows[0].utj).toBeLessThan(7);
  const s = applyScenario(base, { ...EMPTY, units: 30 }).rows;
  expect(s.reduce((a, r) => a + r.utj, 0)).toBeGreaterThan(84);
});

it("parse skenario dari query, memotong ke rentang", () => {
  expect(parseScenario(undefined)).toBeNull();
  expect(parseScenario("bukan json")).toBeNull();
  expect(parseScenario("{}")).toBeNull();
  const s = parseScenario(JSON.stringify({ price: 99, promo: 2, asing: 5 }))!;
  expect(s.price).toBe(10); expect(s.promo).toBe(2); expect(s.leads).toBe(0);
  expect(parseScenario(decodeURIComponent(scenarioQuery(s)))).toEqual(s);
  expect(describeScenario(s).map((x) => x.label)).toEqual(["Perubahan harga", "Nilai promo (dari harga)"]);
});

it("peringatan stok memakai stok yang diberikan, unit dibangun menambah stok", () => {
  expect(applyScenario(base, EMPTY, 32).stockWarning).toBe(true);
  expect(applyScenario(base, EMPTY, 200).stockWarning).toBe(false);
  expect(applyScenario(base, { ...EMPTY, units: 30 }, 80).stockWarning).toBe(false);
  expect(applyScenario(base, { ...EMPTY, units: 30 }, 60).stockWarning).toBe(true);
});
