import { it, expect } from "vitest";
import { marketingInsights, pearson, filterMarketing } from "./marketing";
const m = {
  leads: [
    { bulan: "2025-10", database: "OFFICE", asal: "IG", marketing: "A", status: "", n: 80, survey: 1 },
    { bulan: "2025-10", database: "PRIBADI", asal: "WA", marketing: "A", status: "LOST", n: 20, survey: 5 },
    { bulan: "2025-11", database: "OFFICE", asal: "IG", marketing: "A", status: "", n: 80, survey: 1 },
    { bulan: "2025-12", database: "OFFICE", asal: "IG", marketing: "A", status: "", n: 80, survey: 1 },
  ],
  events: [{ bulan: "2025-10", kategori: "Iklan", kegiatan: "x", biaya: 1e6 }, { bulan: "2025-11", kategori: "Iklan", kegiatan: "x", biaya: 1e6 }, { bulan: "2025-12", kategori: "Iklan", kegiatan: "y", biaya: 50e6 }],
};
const t = [{ utj: "2025-10", agent: "INHOUSE", batal: "2025-11", database: "PRIBADI" }, { utj: "2025-11", agent: "BRCS", akad: "2025-12", database: "PRIBADI" }, { utj: "2025-12", agent: "INHOUSE", database: "OFFICE" }];
it("temuan deterministik", () => {
  const r = marketingInsights(m, t);
  expect(r.stats).toMatchObject({ leads: 260, utj: 3, biayaJuta: 52 });
  const ids = r.findings.map((f) => f.id);
  expect(ids).toEqual(expect.arrayContaining(["status", "office", "lonjakan"]));
  expect(r.perBulan[2].biaya).toBe(50e6);
});
it("pearson", () => { expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1); expect(pearson([1, 2], [1, 2])).toBeNull(); });
it("filter periode marketing", () => {
  expect(filterMarketing(m, { bulan: "2025-11" }).leads).toHaveLength(1);
  expect(filterMarketing(m, { tahun: "2025" }).events).toHaveLength(3);
  expect(filterMarketing(m, {}).leads).toHaveLength(4);
});
