import { it, expect } from "vitest";
import { etsForecast, etsFit } from "./ets";
import { rumusAkadBatal, tingkatTahunLalu, forecast, Txn } from "./forecast";

it("ets: deret konstan diproyeksikan konstan dan tidak pernah negatif", () => {
  const f = etsForecast(Array(30).fill(6), 5);
  expect(f).toHaveLength(5);
  f.forEach((v) => expect(v).toBeCloseTo(6, 1));
  expect(etsForecast([0, 0, 1, 0, 0, 0, 1, 0], 4).every((v) => v >= 0)).toBe(true);
});

it("ets: pola musiman bulanan yang jelas dikenali", () => {
  const pola = [2, 3, 5, 8, 12, 9, 6, 4, 3, 2, 2, 3];
  const y = [...pola, ...pola, ...pola, ...pola];
  const fit = etsFit(y)!;
  expect(fit.m).toBeGreaterThan(1);
  const f = etsForecast(y, 12);
  f.forEach((v, i) => expect(Math.abs(v - pola[i])).toBeLessThan(1.5));
});

it("ets: data terlalu pendek memakai rata-rata, kosong memberi nol", () => {
  expect(etsForecast([4, 6], 3)).toEqual([5, 5, 5]);
  expect(etsForecast([], 2)).toEqual([0, 0]);
});

const mk = (utj: string, akad?: string | null, batal?: string | null): Txn => ({ utj, akad: akad ?? null, batal: batal ?? null });

it("tingkat tahun lalu: memakai tahun kalender penuh terakhir sebelum tahun proyeksi", () => {
  const tx: Txn[] = [];
  for (let m = 1; m <= 12; m++) { const b = String(m).padStart(2, "0"); for (let i = 0; i < 5; i++) tx.push(mk(`2025-${b}`, i < 3 ? `2025-${b}` : null, i === 4 ? `2025-${b}` : null)); }
  tx.push(mk("2026-01"), mk("2026-02"));
  const r = tingkatTahunLalu(tx, "2026-02", 2026);
  expect(r.tahunAcuan).toBe(2025);
  expect(r.akad).toBeCloseTo(3 / 5, 5);
  expect(r.batal).toBeCloseTo(1 / 5, 5);
  expect(tingkatTahunLalu(tx, "2026-02", 2027).tahunAcuan).toBe(2025); // 2026 belum penuh
});

it("rumus Excel: batal = UTJ x tingkat, SPR = UTJ - batal, akad = (proses bank + SPR) x tingkat, proses bank bergulir dari 0", () => {
  const tx: Txn[] = [];
  for (let m = 1; m <= 12; m++) { const b = String(m).padStart(2, "0"); for (let i = 0; i < 10; i++) tx.push(mk(`2025-${b}`, i < 5 ? `2025-${b}` : null, i >= 8 ? `2025-${b}` : null)); }
  const r = rumusAkadBatal(tx, "2025-12", [10, 10, 10]);
  expect(r.batal).toEqual([2, 2, 2]);              // tingkat batal 0,2
  expect(r.spr).toEqual([8, 8, 8]);
  expect(r.akad[0]).toBe(4);                        // (0 + 8) x 0,5
  expect(r.proses[0]).toBe(0 + 10 - 2 - 4);         // 4
  expect(r.akad[1]).toBe(Math.round((4 + 8) * 0.5)); // 6
  expect(r.proses[1]).toBe(4 + 10 - 2 - 6);         // 6
});

it("forecast ets: baris punya batal, SPR & PPJB, akad, dan proses bank bilangan bulat", () => {
  const tx: Txn[] = [];
  for (let y = 2023; y <= 2025; y++) for (let m = 1; m <= 12; m++) { const b = `${y}-${String(m).padStart(2, "0")}`; for (let i = 0; i < 4 + (m % 3); i++) tx.push(mk(b, i % 2 ? b : null, i === 3 ? b : null)); }
  const f = forecast(tx, "2023-01", "2025-12", 6, "ets");
  f.rows.forEach((r) => {
    expect(Number.isInteger(r.utjInt)).toBe(true);
    expect(r.spr).toBe(r.utjInt - r.batalInt!);
    expect(Number.isInteger(r.akadInt) && Number.isInteger(r.proses!)).toBe(true);
  });
});
