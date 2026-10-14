import { describe, it, expect } from "vitest";
import { loadMonthly, reconstructTxns } from "./demo";
import { forecast, movingAverage, linearTrend, backtest, hazards } from "./forecast";

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
describe("backtest (spec 5.2)", () => {
  it("UTJ rata-rata 12 bln MAE 1-3 bln ≈ 3,24", () => {
    const bt = backtest(txns, start, end);
    expect(bt.utjMae13).toBeGreaterThan(3.1);
    expect(bt.utjMae13).toBeLessThan(3.4);
  });
});
describe("forecast", () => {
  const f = forecast(txns, start, end);
  it("12 bulan, rentang melebar", () => {
    expect(f.rows).toHaveLength(12);
    expect(f.rows[0].bulan).toBe("2026-08");
    const w = f.rows.map((r) => r.utjHi - r.utjLo);
    expect(w[11]).toBeGreaterThanOrEqual(w[0]);
    f.rows.forEach((r) => { expect(r.utjLo).toBeLessThanOrEqual(r.utj); expect(r.utjHi).toBeGreaterThanOrEqual(r.utj); });
  });
});
