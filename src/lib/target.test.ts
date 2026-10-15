import { it, expect } from "vitest";
import { bagiRata, bacaFormTarget, hitungCapaian, statusTarget, TargetError } from "./target";

const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";

it("bagi rata membagikan sisa ke bulan awal", () => {
  expect(bagiRata(30)).toEqual([3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2]);
  expect(bagiRata(120).every((x) => x === 10)).toBe(true);
  expect(bagiRata(30).reduce((a, b) => a + b, 0)).toBe(30);
});

it("form: total setahun dibagi rata, kolom bulanan menang, kosong dihitung 0", () => {
  const a = bacaFormTarget(form({ tahun: "2026", total_utj: "120", total_akad: "60" }));
  expect(a.rows).toHaveLength(12);
  expect(a.rows[0]).toEqual({ bulan: "2026-01", utj: 10, akad: 5 });
  const b = bacaFormTarget(form({ tahun: "2026", utj_01: "7", utj_03: "9", total_utj: "999" }));
  expect(b.rows[0].utj).toBe(7); expect(b.rows[1].utj).toBe(0); expect(b.rows[2].utj).toBe(9); expect(b.rows[0].akad).toBe(0);
});

it("form: menolak tahun salah, angka tidak valid, dan form kosong", () => {
  expect(() => bacaFormTarget(form({ tahun: "26", total_utj: "10" }))).toThrow(TargetError);
  expect(() => bacaFormTarget(form({ tahun: "2026", utj_01: "-1" }))).toThrow(TargetError);
  expect(() => bacaFormTarget(form({ tahun: "2026", utj_01: "1.5" }))).toThrow(TargetError);
  expect(() => bacaFormTarget(form({ tahun: "2026", utj_01: "abc" }))).toThrow(TargetError);
  expect(() => bacaFormTarget(form({ tahun: "2026" }))).toThrow(TargetError);
});

it("status target: tercapai, mendekati, di bawah, tanpa target", () => {
  expect(statusTarget(100, 100)).toBe("tercapai");
  expect(statusTarget(90, 100)).toBe("mendekati");
  expect(statusTarget(89, 100)).toBe("di bawah");
  expect(statusTarget(5, 0)).toBeNull();
});

const targets = Array.from({ length: 12 }, (_, i) => ({ bulan: `2026-${String(i + 1).padStart(2, "0")}`, utj: 10, akad: 5 }));
const aktual = ["01", "02", "03", "04"].map((m) => ({ bulan: `2026-${m}`, utj: 8, akad: 4 }));
const proyeksi = ["05", "06", "07", "08", "09", "10", "11", "12"].map((m) => ({ bulan: `2026-${m}`, utjInt: 9, akadInt: 6 }));

it("capaian: realisasi sampai data terakhir, proyeksi sesudahnya, kebutuhan per bulan", () => {
  const c = hitungCapaian(targets, aktual, proyeksi, "2026", "2026-04")!;
  expect(c.lengkap).toBe(true);
  expect(c.utj.target).toBe(120);
  expect(c.utj.realisasiSampaiKini).toBe(32);
  expect(c.utj.targetSampaiKini).toBe(40);
  expect(c.utj.perkiraanAkhirTahun).toBe(32 + 72);
  expect(c.utj.sisaBulan).toBe(8);
  expect(c.utj.perluPerBulan).toBe(11);   // (120-32)/8
  expect(c.utj.proyeksiPerBulan).toBe(9);
  expect(c.utj.status).toBe("di bawah");  // 104/120 = 87%
  expect(c.akad.status).toBe("tercapai");  // 16 + 48 = 64 >= 60
  expect(c.baris[4]).toMatchObject({ bulan: "2026-05", aktual: false, utj: 9 });
});

it("capaian: null tanpa target tahun itu, dan lengkap=false bila proyeksi tidak mencakup", () => {
  expect(hitungCapaian([], aktual, proyeksi, "2026", "2026-04")).toBeNull();
  expect(hitungCapaian(targets, aktual, proyeksi, "2027", "2026-04")).toBeNull();
  const c = hitungCapaian(targets, aktual, proyeksi.slice(0, 3), "2026", "2026-04")!;
  expect(c.lengkap).toBe(false);
});

it("capaian: tahun yang sudah lewat tidak punya sisa bulan", () => {
  const sudah = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map((m) => ({ bulan: `2026-${m}`, utj: 10, akad: 5 }));
  const c = hitungCapaian(targets, sudah, [], "2026", "2026-12")!;
  expect(c.utj.sisaBulan).toBe(0); expect(c.utj.perluPerBulan).toBeNull(); expect(c.utj.status).toBe("tercapai");
});
