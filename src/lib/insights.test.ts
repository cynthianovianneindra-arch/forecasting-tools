import { it, expect } from "vitest";
import { applyFilter, cards } from "./insights";
const t = [
  { utj: "2025-01", akad: "2025-03", tipe: "A", agent: "X", leads: "IG", spr: true, cair: true, banks: [{ bank: "BTN", hari: 20, status: "APPROVE" }] },
  { utj: "2025-02", batal: "2025-04", tipe: "B", agent: "X", leads: "IG", alasanBatal: "Reject Bank", banks: [{ bank: "BTN", hari: 30, status: "REJECT" }] },
];
it("filter dan kartu", () => {
  expect(applyFilter(t, { tipe: "A" }, true)).toHaveLength(1);
  const c = cards(t);
  expect(c.funnel).toMatchObject({ utj: 2, akad: 1, batal: 1, spr: 1 });
  expect(c.bank[0]).toMatchObject({ bank: "BTN", berkas: 2, approve: 50, hari: 25 });
  expect(c.alasan).toMatchObject({ tercatat: 1, total: 1 });
});

import { rentangPeriode, dalamPeriode } from "./insights";
it("rentang periode: custom, terbalik ditukar, bulan tunggal, tahun, abaikan tak valid", () => {
  expect(rentangPeriode({ dari: "2025-03", sampai: "2025-08" })).toEqual({ dari: "2025-03", sampai: "2025-08" });
  expect(rentangPeriode({ dari: "2025-08", sampai: "2025-03" })).toEqual({ dari: "2025-03", sampai: "2025-08" });
  expect(rentangPeriode({ dari: "2025-08" })).toEqual({ dari: "2025-08", sampai: undefined });
  expect(rentangPeriode({ bulan: "2025-05" })).toEqual({ dari: "2025-05", sampai: "2025-05" });
  expect(rentangPeriode({ tahun: "2025" })).toEqual({ dari: "2025-01", sampai: "2025-12" });
  expect(rentangPeriode({ dari: "2025-13", tahun: "2024" })).toEqual({ dari: "2024-01", sampai: "2024-12" });
  expect(rentangPeriode({})).toEqual({});
  expect(dalamPeriode("2025-05", { dari: "2025-03", sampai: "2025-08" })).toBe(true);
  expect(dalamPeriode("2025-09", { dari: "2025-03", sampai: "2025-08" })).toBe(false);
  expect(dalamPeriode("2020-01", {})).toBe(true);
});
it("applyFilter memakai rentang bulan untuk kartu tetapi tidak untuk proyeksi", () => {
  const tx = [{ utj: "2025-01" }, { utj: "2025-04" }, { utj: "2025-09" }];
  expect(applyFilter(tx, { dari: "2025-02", sampai: "2025-05" }, false)).toHaveLength(1);
  expect(applyFilter(tx, { dari: "2025-02", sampai: "2025-05" }, true)).toHaveLength(3);
});

import { tipePerCluster } from "./insights";
it("tipePerCluster: tipe diurutkan menurut akad di dalam tiap cluster", () => {
  const t = [
    { utj: "2026-01", akad: "2026-03", tipe: "Gwen", cluster: "Montana" }, { utj: "2026-01", akad: "2026-04", tipe: "Gwen", cluster: "Montana" },
    { utj: "2026-02", akad: "2026-04", tipe: "Darlene", cluster: "Montana" }, { utj: "2026-02", akad: null, tipe: "Darlene", cluster: "Montana" }, { utj: "2026-02", akad: null, tipe: "Darlene", cluster: "Montana" },
    { utj: "2026-02", akad: "2026-05", tipe: "Kanaya", cluster: "Non Cluster" }, { utj: "2026-02", akad: null, tipe: "Ruko" },
  ] as never[];
  const r = tipePerCluster(t);
  expect(r.map((c) => c.cluster)).toEqual(["Montana", "Non Cluster", "Tanpa cluster"]);
  expect(r[0].tipe.map((x) => `${x.tipe}:${x.akad}/${x.utj}`)).toEqual(["Gwen:2/2", "Darlene:1/3"]);
  expect(r[0]).toMatchObject({ utj: 5, akad: 3 });
});
