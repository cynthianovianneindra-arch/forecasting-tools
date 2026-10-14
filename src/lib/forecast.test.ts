import { describe, it, expect } from "vitest";
import { loadMonthly, reconstructTxns } from "./demo";
import { forecast, utjInterval, utjIntervalPendek, movingAverage, linearTrend, backtest, hazards, exponentialSmoothing, sesFit } from "./forecast";

const rows = loadMonthly();
const txns = reconstructTxns(rows);
const [start, end] = [rows[0].bulan, rows[rows.length - 1].bulan];

describe("fixture", () => {
  it("total UTJ 284 dan akad 188", () => {
    expect(rows.reduce((s, r) => s + r.utj, 0)).toBe(284);
    expect(rows.reduce((s, r) => s + r.akad, 0)).toBe(188);
    expect(txns.length).toBe(284);
    expect(txns.filter((t) => t.akad).length).toBe(188);
  });
});
describe("metode", () => {
  it("rata-rata bergulir & tren", () => {
    expect(movingAverage([1, 2, 3, 4], 2, 2)).toEqual([3.5, 3.5]);
    const t = linearTrend([1, 2, 3, 4], 2, 0);
    expect(t[0]).toBeCloseTo(5); expect(t[1]).toBeCloseTo(6);
  });
  it("hazard dalam [0,1]", () => {
    const { ha, hb } = hazards(txns, end);
    ha.forEach((v, i) => { expect(v).toBeGreaterThanOrEqual(0); expect(v + hb[i]).toBeLessThanOrEqual(1); });
  });
});
describe("exponential smoothing", () => {
  it("level mengikuti data dan alpha dibatasi", () => {
    const f = sesFit([5, 5, 5, 5, 5, 5]);
    expect(f.level).toBeCloseTo(5);
    const g = sesFit([1, 1, 1, 1, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(g.alpha).toBeGreaterThanOrEqual(0.05); expect(g.alpha).toBeLessThanOrEqual(0.3);
    expect(g.level).toBeGreaterThan(1); expect(g.level).toBeLessThan(10);
    expect(exponentialSmoothing([2, 4, 6], 3)).toHaveLength(3);
    expect(sesFit([]).level).toBe(0);
  });
});
describe("backtest (spec 5.2)", () => {
  it("UTJ exponential smoothing MAE 1-3 bln ≈ 3,2 dan tidak lebih buruk dari rata-rata 12 bln", () => {
    const bt = backtest(txns, start, end);
    expect(bt.utjMae13).toBeGreaterThan(2.9);
    expect(bt.utjMae13).toBeLessThan(3.5);
    expect(bt.utjMae13Ma12).toBeGreaterThan(3.1);
  });
});
describe("forecast", () => {
  const f = forecast(txns, start, end);
  it("12 bulan, rentang melebar", () => {
    expect(f.rows).toHaveLength(12);
    expect(f.rows[0].bulan).toBe("2026-08");
    const w = f.rows.map((r) => r.utjHi - r.utjLo);
    expect(w[11]).toBeGreaterThanOrEqual(w[0]);
    f.rows.forEach((r) => { expect(r.akadInt).toBe(Math.floor(r.akad + 1e-9)); expect(r.utjLo).toBeLessThanOrEqual(r.utj); expect(r.utjHi).toBeGreaterThanOrEqual(r.utj); });
  });
});

describe("rentang proyeksi untuk riwayat pendek", () => {
  it("rentang cadangan melebar dengan horizon dan tidak nol", () => {
    const a = utjIntervalPendek(6, 1), b = utjIntervalPendek(6, 12);
    expect(a.hi - a.lo).toBeGreaterThan(4);
    expect(b.hi - b.lo).toBeGreaterThan(a.hi - a.lo);
    expect(a.lo).toBeGreaterThanOrEqual(0);
    expect(utjIntervalPendek(0, 3).hi).toBeGreaterThan(0);
  });
  it("utjInterval memakai cadangan bila galat uji mundur < 5", () => {
    expect(utjInterval(6, 2, [[1, 2], [3]])).toEqual(utjIntervalPendek(6, 2));
  });
  it("forecast pada rentang pendek tetap menghasilkan 12 bulan dengan rentang", () => {
    const f = forecast(txns.filter((t) => t.utj <= "2024-12"), "2024-01", "2024-12");
    expect(f.rows).toHaveLength(12);
    expect(f.rows[0].bulan).toBe("2025-01");
    f.rows.forEach((r) => expect(r.utjHi).toBeGreaterThan(r.utjLo));
  });
});

it("proyeksi jauh (24 bulan) tetap berupa angka, bukan NaN", async () => {
  const { reconstructTxns } = await import("./demo");
  const { loadMonthly } = await import("./demo");
  const m = loadMonthly();
  const f = forecast(reconstructTxns(m), m[0].bulan, m[m.length - 1].bulan, 36);
  expect(f.rows).toHaveLength(36);
  expect(f.rows.every((r) => Number.isFinite(r.akad) && Number.isFinite(r.batal) && Number.isFinite(r.utjInt))).toBe(true);
});
