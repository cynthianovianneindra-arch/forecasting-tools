import { it, expect } from "vitest";
import { analisisSkenario } from "./analisis";
import { EMPTY, Scenario, Referensi } from "./whatif";

const base = Array.from({ length: 12 }, (_, i) => ({ bulan: `2026-${String(i + 1).padStart(2, "0")}`, utj: 7, utjInt: 7, utjLo: 3, utjHi: 11, utjLoInt: 3, utjHiInt: 11, akad: 5, akadInt: 5, batal: 2, trend: 7 }));
const ref: Referensi = { harga: 750, leadsBulanan: 400, birate: 5.25, ihsg: 7000, emas: 4500, inflasi: 2.5 };
const sc = (o: Partial<Scenario>): Scenario => ({ ...EMPTY, bangun: {}, event: {}, ...o });
const input = (s: Scenario) => ({ base, s, ref, stokOpen: 32, belumDibangunPerTipe: [{ tipe: "Gwen", n: 16 }], netPriceMiliar: 0.762 });

it("tanpa perubahan: pesan jelas dan total sama", () => {
  const a = analisisSkenario(input(sc({})));
  expect(a.totals.utjBase).toBe(a.totals.utjScn);
  expect(a.ringkasan[0]).toMatch(/Belum ada variabel/);
});
it("kontribusi tiap kelompok, pendorong terbesar, stok", () => {
  const a = analisisSkenario(input(sc({ leads: 600, event: { "Open House": 1 }, bangun: { Gwen: 10 }, birate: 6.25 })));
  expect(a.totals.utjScn).toBeGreaterThan(a.totals.utjBase);
  expect(a.kontribusi.find((k) => k.kelompok === "Marketing dan event")!.selisihUtj).toBeGreaterThan(0);
  expect(a.kontribusi.find((k) => k.kelompok === "Kondisi ekonomi")!.selisihUtj).toBeLessThan(0);
  expect(a.ringkasan.join(" ")).toMatch(/Pendorong terbesar: Marketing dan event/);
  expect(a.stok).toMatch(/Stok (tidak )?cukup/);
  expect(a.peringatan.join(" ")).toMatch(/ilustrasi/);
  expect(a.peringatan.join(" ")).toMatch(/Event dari kelima kategori/);
});
it("peringatan order bangun melebihi unit belum dibangun tipe itu", () => {
  const a = analisisSkenario(input(sc({ bangun: { Gwen: 30 } })));
  expect(a.peringatan.join(" ")).toMatch(/melebihi unit belum dibangun/);
});
it("semua angka UTJ bulat", () => {
  const a = analisisSkenario(input(sc({ harga: 780, promo: 7 })));
  expect(Number.isInteger(a.totals.utjScn)).toBe(true);
  expect(Number.isInteger(a.bulanPuncak.utj)).toBe(true);
});

it("kontribusi terlihat walau UTJ bulanan dibulatkan ke bawah (efek kecil tidak hilang)", () => {
  const kecil = base.map((b) => ({ ...b, utj: 6.3, utjInt: 6, akad: 4.4, akadInt: 4 }));
  const a = analisisSkenario({ base: kecil, s: sc({ leads: 500, birate: 6.25 }), ref, stokOpen: 32, belumDibangunPerTipe: [], netPriceMiliar: 0.762 });
  expect(a.kontribusi.find((k) => k.kelompok === "Marketing dan event")!.selisihUtj).toBeGreaterThan(0);
  expect(a.kontribusi.find((k) => k.kelompok === "Kondisi ekonomi")!.selisihUtj).toBeLessThan(0);
});
