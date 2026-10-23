import { describe, expect, it } from "vitest";
import { riwayatBiRate } from "./biRateRiwayat";

describe("riwayatBiRate", () => {
  const r = riwayatBiRate("2026-10");
  it("satu nilai per bulan dari Jan 2024 sampai bulan diminta", () => {
    expect(r[0]).toEqual({ bulan: "2024-01", nilai: 6 });
    expect(r).toHaveLength(34);
    expect(r[r.length - 1]).toEqual({ bulan: "2026-10", nilai: 5.75 });
  });
  it("bulan tanpa keputusan memakai level sebelumnya", () => {
    const n = (b: string) => r.find((x) => x.bulan === b)?.nilai;
    expect([n("2024-03"), n("2024-08"), n("2024-12"), n("2025-04"), n("2026-04")]).toEqual([6, 6.25, 6, 5.75, 4.75]);
  });
});
