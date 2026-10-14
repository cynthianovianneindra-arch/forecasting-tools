import { it, expect } from "vitest";
import { applyScenario, EMPTY, parseScenario, scenarioQuery, describeScenario, changedCount, turunan, pengali, KATEGORI_EVENT, Referensi, Scenario } from "./whatif";

const base = Array.from({ length: 12 }, (_, i) => ({ bulan: `2026-${String(i + 1).padStart(2, "0")}`, utj: 7, utjInt: 7, utjLo: 3, utjHi: 11, utjLoInt: 3, utjHiInt: 11, akad: 5, akadInt: 5, batal: 0, trend: 7 }));
const ref: Referensi = { harga: 750, leadsBulanan: 400, birate: 5.25, ihsg: 7000, emas: 4500, inflasi: 2.5 };
const sc = (o: Partial<Scenario>): Scenario => ({ ...EMPTY, bangun: {}, event: {}, ...o });
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

it("skenario kosong = dasar", () => {
  const { rows } = applyScenario(base, EMPTY, ref);
  rows.forEach((r) => { expect(r.utj).toBeCloseTo(7); expect(r.akad).toBeCloseTo(5); expect(r.utjInt).toBe(7); expect(r.akadInt).toBe(5); });
});
it("harga isian manual: harga lebih tinggi menurunkan UTJ, promo menaikkan", () => {
  const naik = applyScenario(base, sc({ harga: 825 }), ref).rows[0]; // +10%
  expect(naik.utj).toBeLessThan(7);
  const promo = applyScenario(base, sc({ promo: 15 }), ref).rows[0]; // 2% dari harga acuan
  expect(promo.utj).toBeGreaterThan(7);
  expect(turunan(sc({ harga: 825, promo: 16.5 }), ref)).toMatchObject({ hargaPct: expect.closeTo(10, 5), promoPct: expect.closeTo(2, 5) });
});
it("marketing: leads dan event per kategori menaikkan UTJ", () => {
  expect(applyScenario(base, sc({ leads: 600 }), ref).rows[0].utj).toBeGreaterThan(7); // +50% -> +25%
  expect(applyScenario(base, sc({ event: { "Open House": 2, Pameran: 1 } }), ref).rows[0].utj).toBeCloseTo(7 * 1.09, 5);
  expect(turunan(sc({ event: { "Open House": 2, Pameran: 1 } }), ref).event).toBe(3);
});
it("ekonomi manual: BI Rate naik menurunkan, IHSG naik menaikkan; acuan kosong = tidak berpengaruh", () => {
  expect(applyScenario(base, sc({ birate: 6.25 }), ref).rows[0].utj).toBeLessThan(7);
  expect(applyScenario(base, sc({ ihsg: 7700 }), ref).rows[0].utj).toBeGreaterThan(7);
  expect(applyScenario(base, sc({ birate: 9 }), { ...ref, birate: null }).rows[0].utj).toBeCloseTo(7);
});
it("order bangun per tipe menambah UTJ dan akad", () => {
  const s = applyScenario(base, sc({ bangun: { Gwen: 10, Bianca: 5 }, mulaiBangun: 0 }), ref).rows;
  expect(sum(s.map((r) => r.utjInt))).toBeGreaterThan(sum(base.map((b) => b.utjInt)));
  expect(sum(s.map((r) => r.akad))).toBeGreaterThan(60);
});
it("UTJ dibulatkan ke bawah", () => {
  const r = applyScenario(base, sc({ harga: 780 }), ref).rows[0];
  expect(r.utjInt).toBe(Math.floor(r.utj + 1e-9));
  expect(Number.isInteger(r.utjInt)).toBe(true);
});
it("peringatan stok memakai stok yang diberikan; unit dibangun menambah stok", () => {
  expect(applyScenario(base, EMPTY, ref, 32).stockWarning).toBe(true);
  expect(applyScenario(base, EMPTY, ref, 200).stockWarning).toBe(false);
  expect(applyScenario(base, sc({ bangun: { X: 30 } }), ref, 80).stockWarning).toBe(false);
  expect(applyScenario(base, sc({ bangun: { X: 30 } }), ref, 60).stockWarning).toBe(true);
});
it("pengali per kelompok", () => {
  const p = pengali(turunan(sc({ harga: 825, leads: 600, birate: 6.25 }), ref));
  expect(p.hargaPromo).toBeLessThan(0); expect(p.marketing).toBeGreaterThan(0); expect(p.ekonomi).toBeLessThan(0);
  expect(p.total).toBeCloseTo(1 + p.hargaPromo + p.marketing + p.ekonomi);
});
it("parse skenario dari query: dipotong ke rentang, kunci asing diabaikan, bulat", () => {
  expect(parseScenario(undefined)).toBeNull(); expect(parseScenario("bukan json")).toBeNull(); expect(parseScenario("{}")).toBeNull();
  const s = parseScenario(JSON.stringify({ harga: 99999, promo: 5, bangun: { Gwen: 7.9, Neg: -3 }, event: { "Open House": 99, Asing: 4 }, birate: 99, asing: 1 }))!;
  expect(s.harga).toBe(5000); expect(s.promo).toBe(5); expect(s.bangun).toEqual({ Gwen: 7 }); expect(s.event).toEqual({ "Open House": 30 }); expect(s.birate).toBe(30);
  expect(parseScenario(decodeURIComponent(scenarioQuery(s)))).toEqual(s);
  expect(KATEGORI_EVENT).toHaveLength(5);
});
it("hitung variabel diubah dan deskripsi", () => {
  const s = sc({ harga: 800, promo: 10, bangun: { Gwen: 5 }, event: { Pameran: 1 }, ihsg: 7200 });
  expect(changedCount(s)).toBe(5);
  const d = describeScenario(s, ref).map((x) => x.label);
  expect(d).toEqual(["Order bangun Gwen", "Harga jual rata-rata", "Nilai promo", "Event Pameran", "IHSG"]);
});
