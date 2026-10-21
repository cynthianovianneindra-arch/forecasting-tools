import { it, expect } from "vitest";
import { analisaPromo, skenarioTanpaPpn, minatUnit, rekomendasiOrderBangun, dayaBeli, sinyalPasar } from "./analisaLanjut";
import type { Txn } from "./forecast";
import type { MacroRow, UnitRow } from "./importExcel";

const tx = (utj: string, o: Partial<Txn> = {}): Txn => ({ utj, akad: null, batal: null, ...o });
const bulan = (i: number) => `${2025 + Math.floor((i - 1) / 12)}-${String(((i - 1) % 12) + 1).padStart(2, "0")}`;

it("promo: batal dinilai dari UTJ yang sudah selesai; promo dengan batal rendah efektif", () => {
  const t: Txn[] = [];
  for (let i = 1; i <= 12; i++) { t.push(tx(bulan(i), { akad: bulan(i + 1) }), tx(bulan(i), { batal: bulan(i + 1) })); }  // tanpa promo: batal 50% dari yang selesai
  for (let k = 0; k < 8; k++) t.push(tx(bulan(6), { promo: "PPNDTP1", akad: bulan(7), harga: 1e9, diskon: 5e7 }));
  t.push(tx(bulan(12), { promo: "PPNDTP1" }));                                                                                // masih proses: tidak dihitung batal
  const r = analisaPromo(t);
  const p = r.baris.find((b) => b.promo === "PPNDTP1")!;
  expect(p.utj).toBe(9); expect(p.proses).toBe(1); expect(p.persenBatal).toBe(0); expect(p.diskonPersen).toBe(5); expect(p.ppn).toBe(true); expect(p.vonis).toBe("Efektif");
  expect(r.tanpaPromo.utj).toBe(24); expect(r.tanpaPromo.persenBatal).toBe(50);
});

it("promo: sedikit UTJ = sampel kecil, batal tinggi = perlu diubah", () => {
  const t: Txn[] = [];
  for (let i = 1; i <= 12; i++) for (let k = 0; k < 3; k++) t.push(tx(bulan(i), { akad: bulan(i + 1) }));
  t.push(tx(bulan(3), { promo: "X1", batal: bulan(4) }), tx(bulan(3), { promo: "X1", batal: bulan(4) }));
  for (let k = 0; k < 6; k++) t.push(tx(bulan(2 + k), { promo: "BURUK", batal: bulan(3 + k) }));
  const r = analisaPromo(t);
  expect(r.baris.find((b) => b.promo === "X1")!.vonis).toBe("Sampel kecil");
  expect(r.baris.find((b) => b.promo === "BURUK")!.vonis).toBe("Perlu diubah");
});

it("skenario tanpa PPN: porsi 12 bulan terakhir mengurangi proyeksi", () => {
  const t: Txn[] = [];
  for (let i = 1; i <= 12; i++) { t.push(tx(bulan(i)), tx(bulan(i), { promo: i % 2 ? "PPNNOV" : undefined })); } // 12 dari 24 berkode PPN? hanya bulan ganjil: 6
  const proy = Array.from({ length: 12 }, () => ({ utj: 10, akad: 6 }));
  const s = skenarioTanpaPpn(t, bulan(12), proy, 1);
  expect(s.utj12).toBe(24); expect(s.utjPpn12).toBe(6); expect(s.porsiPpn12).toBe(25);
  expect(s.basis.utj).toBe(120);
  expect(s.skenario[2].utj).toBe(Math.floor(120 * 0.75));       // semua UTJ ber-PPN hilang: porsi 25%
  expect(s.skenario[0].utj).toBeGreaterThanOrEqual(s.skenario[2].utj);
  expect(s.skenario[1].utj).toBeLessThanOrEqual(120);
  expect(s.bulanPpn.n).toBe(6);
});

const unit = (u: string, tipe: string, status: string): UnitRow => ({ unit: u, tipe, tahap: "T1", cluster: "C", status });

it("minat unit: urut menurut UTJ dan unit dengan peminat berulang", () => {
  const t = [tx("2025-01", { tipe: "A", unit: "A-1" }), tx("2025-02", { tipe: "A", unit: "A-1", akad: "2025-03" }), tx("2025-02", { tipe: "B", unit: "B-1" }), tx("2025-03", { tipe: "A", unit: "A-2" })];
  const r = minatUnit(t, [unit("A-1", "A", "SOLD"), unit("A-2", "A", "OPEN"), unit("B-1", "B", "OPEN")]);
  expect(r.perTipe[0]).toMatchObject({ tipe: "A", utj: 3, akad: 1, open: 1, total: 2 });
  expect(r.unitTop[0]).toMatchObject({ unit: "A-1", peminat: 2 });
});

it("order bangun: kekurangan per tipe dibatasi unit belum dibangun; mulai = habis - lead", () => {
  const t = Array.from({ length: 12 }, (_, i) => tx(bulan(i + 1), { tipe: i < 9 ? "A" : "B" }));
  const units = [unit("A1", "A", "OPEN"), unit("A2", "A", "CLOSE"), unit("A3", "A", "CLOSE"), unit("A4", "A", "CLOSE"), unit("B1", "B", "CLOSE")];
  const r = rekomendasiOrderBangun(t, bulan(12), 12, 0, units, 8)!;
  const a = r.baris.find((b) => b.tipe === "A")!;
  expect(a.kebutuhan).toBe(9); expect(a.kurang).toBe(8); expect(a.bangun).toBe(3);
  expect(r.mulaiBulan).toBe(2);
  expect(rekomendasiOrderBangun(t, bulan(12), 12, 0, null, 8)).toBeNull();
});

const mr = (bulan: string, o: Partial<MacroRow>): MacroRow => ({ bulan, emas: null, ihsg: null, inflasi: null, ihpr: null, birate: null, ...o });

it("daya beli: rasio tahun upah dan status", () => {
  const macro = [mr("2025-06", { umkSda: 4_000_000, inflasi: 2, birate: 5, ihpr: 100 }), mr("2026-06", { umkSda: 4_400_000, inflasi: 4, birate: 6.25, ihpr: 105 })];
  const d = dayaBeli(macro, 0.6)!;
  expect(d.acuan!.nilai).toBe(4_400_000);
  expect(d.pertumbuhanUmk).toBe(10);
  expect(d.tahunUpah).toBe(+((0.6e9) / (4_400_000 * 12)).toFixed(1));
  expect(d.status).toBe("Tertekan");
  expect(dayaBeli(null, 1)).toBeNull();
});

it("sinyal pasar: BI Rate naik menekan, inflasi turun mendukung", () => {
  const macro = [mr("2026-01", { birate: 5, inflasi: 4 }), mr("2026-02", { birate: 5, inflasi: 3.8 }), mr("2026-03", { birate: 5.5, inflasi: 3.2 }), mr("2026-04", { birate: 5.5, inflasi: 3 })];
  const s = sinyalPasar(macro);
  expect(s.find((x) => x.judul === "BI Rate naik")?.arah).toBe("menekan");
  expect(s.find((x) => x.judul === "Inflasi menurun")?.arah).toBe("mendukung");
  expect(sinyalPasar(null)).toEqual([]);
});

it("inflasi pecahan Excel (0,0242) diperlakukan sebagai persen 2,42", () => {
  const d = dayaBeli([mr("2026-04", { umkSda: 5_000_000, inflasi: 0.0242, birate: 5.25 })], 0.6)!;
  expect(d.inflasi!.nilai).toBe(2.42);
});
