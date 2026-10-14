import { it, expect } from "vitest";
import { applyEdit, cekMakro, ManualError, Dataset } from "./manual";

const base = (): Dataset => ({
  txns: [{ utj: "2026-05", unit: "A-01", tipe: "Gwen" }, { utj: "2026-04", unit: "A-02", akad: "2026-06" }],
  units: [{ unit: "A-01", tipe: "Gwen", tahap: "Tahap 1", cluster: "Sierra", status: "PROSES" }, { unit: "B-01", tipe: "Bianca", tahap: "Tahap 2", cluster: "Montana", status: "OPEN" }, { unit: "A-02", tipe: "Gwen", tahap: "", cluster: "", status: "SOLD" }],
  marketing: { leads: [], events: [] },
});
it("transaksi baru dari unit Open: unit jadi PROSES, atribut diwarisi", () => {
  const r = applyEdit(base(), { jenis: "transaksi_baru", bulanUtj: "2026-08", unit: "b-01", agent: "inhouse", netPriceJuta: 750 });
  const t = r.ds.txns.at(-1)!;
  expect(t).toMatchObject({ utj: "2026-08", unit: "B-01", tipe: "Bianca", cluster: "Montana", agent: "INHOUSE", netPrice: 750e6 });
  expect(r.ds.units.find((u) => u.unit === "B-01")?.status).toBe("PROSES");
  expect(base().units[1].status).toBe("OPEN"); // input tidak dimutasi
});
it("transaksi baru ditolak bila unit tak ada atau masih berjalan", () => {
  expect(() => applyEdit(base(), { jenis: "transaksi_baru", bulanUtj: "2026-08", unit: "Z-9" })).toThrow(ManualError);
  expect(() => applyEdit(base(), { jenis: "transaksi_baru", bulanUtj: "2026-08", unit: "A-01" })).toThrow(/UTJ berjalan/);
  expect(() => applyEdit(base(), { jenis: "transaksi_baru", bulanUtj: "2026-13" })).toThrow(/bulan/i);
});
it("status transaksi: akad -> SOLD, batal -> OPEN, validasi urutan bulan", () => {
  const a = applyEdit(base(), { jenis: "status_transaksi", unit: "A-01", bulanAkad: "2026-07" });
  expect(a.ds.txns[0].akad).toBe("2026-07"); expect(a.ds.units[0].status).toBe("SOLD");
  const b = applyEdit(base(), { jenis: "status_transaksi", unit: "A-01", bulanBatal: "2026-06", alasan: "Reject bank" });
  expect(b.ds.txns[0]).toMatchObject({ batal: "2026-06", alasanBatal: "Reject bank" }); expect(b.ds.units[0].status).toBe("OPEN");
  expect(() => applyEdit(base(), { jenis: "status_transaksi", unit: "A-01", bulanAkad: "2026-01" })).toThrow(/sebelum/);
  expect(() => applyEdit(base(), { jenis: "status_transaksi", unit: "A-01", bulanAkad: "2026-07", bulanBatal: "2026-07" })).toThrow(/bukan keduanya/);
  expect(() => applyEdit(base(), { jenis: "status_transaksi", unit: "Q-1", bulanAkad: "2026-07" })).toThrow(/Tidak ada transaksi/);
});
it("event dan leads", () => {
  const e = applyEdit(base(), { jenis: "event", bulan: "2026-06", kategori: "Iklan", kegiatan: "Meta Ads", biayaRp: 5e6 });
  expect(e.ds.marketing.events).toEqual([{ bulan: "2026-06", kategori: "Iklan", kegiatan: "Meta Ads", biaya: 5e6 }]);
  expect(() => applyEdit(base(), { jenis: "event", bulan: "2026-06", kategori: "x", kegiatan: "", biayaRp: 1 })).toThrow(/kegiatan/);
  const l = applyEdit(base(), { jenis: "leads", bulan: "2026-06", database: "office", asal: "ig", marketing: "eki", status: "prospect", n: 10, survey: 2 });
  expect(l.ds.marketing.leads[0]).toMatchObject({ database: "OFFICE", marketing: "EKI", status: "PROSPECT", n: 10, survey: 2 });
  expect(() => applyEdit(base(), { jenis: "leads", bulan: "2026-06", database: "a", asal: "b", marketing: "c", status: "", n: 5, survey: 9 })).toThrow(/Jumlah survey/);
});
it("unit: ubah status, tambah unit baru, validasi status", () => {
  expect(applyEdit(base(), { jenis: "unit", unit: "B-01", status: "close" }).ds.units[1].status).toBe("CLOSE");
  expect(applyEdit(base(), { jenis: "unit", unit: "N-1", status: "open", tipe: "Gwen" }).ds.units.at(-1)).toMatchObject({ unit: "N-1", status: "OPEN" });
  expect(() => applyEdit(base(), { jenis: "unit", unit: "N-1", status: "open" })).toThrow(/tipe/);
  expect(() => applyEdit(base(), { jenis: "unit", unit: "B-01", status: "rusak" })).toThrow(/Status unit/);
});
it("data ekonomi manual: rentang wajar", () => {
  expect(cekMakro("2026-08", "birate", 5.25)).toEqual({ bulan: "2026-08", indikator: "birate", nilai: 5.25 });
  expect(() => cekMakro("2026-08", "birate", 55)).toThrow(ManualError);
  expect(() => cekMakro("2026-8", "ihsg", 7000)).toThrow(/bulan/i);
  expect(() => cekMakro("2026-08", "xxx", 1)).toThrow(/tidak dikenal/);
});
