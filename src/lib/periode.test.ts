import { it, expect } from "vitest";
import { jendelaLaporan, daftarBulan, selisihBulan } from "./periode";

it("tanpa pilihan: bulan setelah data terakhir", () => {
  expect(jendelaLaporan({}, "2026-07")).toMatchObject({ jenis: "bulanan", dari: "2026-08", sampai: "2026-08", n: 1 });
  expect(jendelaLaporan({ jenis: "tahunan" }, "2026-07")).toMatchObject({ dari: "2026-08", sampai: "2027-07", n: 12 });
});
it("custom bulan dan tahun", () => {
  expect(jendelaLaporan({ jenis: "bulanan", bulan: "03", tahun: "2026" }, "2026-07")).toMatchObject({ dari: "2026-03", sampai: "2026-03", n: 1 });
  expect(jendelaLaporan({ jenis: "tahunan", bulan: "01", tahun: "2027" }, "2026-07")).toMatchObject({ dari: "2027-01", sampai: "2027-12", n: 12 });
});
it("masukan tidak valid memakai bawaan", () => {
  expect(jendelaLaporan({ bulan: "13", tahun: "abc" }, "2026-07")).toMatchObject({ dari: "2026-08" });
});
it("dibatasi 36 bulan setelah data terakhir", () => {
  const j = jendelaLaporan({ jenis: "tahunan", bulan: "01", tahun: "2029" }, "2026-07");
  expect(j.dipotong).toBe(true);
  expect(j.sampai).toBe("2029-07");
  expect(j.n).toBe(7);
});
it("daftarBulan dan selisihBulan", () => {
  expect(daftarBulan("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  expect(selisihBulan("2026-07", "2027-07")).toBe(12);
});
