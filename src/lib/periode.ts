import { addMonths } from "./forecast";

export type JenisLaporan = "bulanan" | "tahunan";
export interface Jendela { jenis: JenisLaporan; dari: string; sampai: string; n: number; tahun: string; bulan: string; dipotong: boolean }

/** Batas jauh proyeksi ke depan dari bulan data terakhir. */
export const MAKS_KE_DEPAN = 36;

const ym = (s: string) => +s.slice(0, 4) * 12 + (+s.slice(5, 7) - 1);
export const selisihBulan = (a: string, b: string) => ym(b) - ym(a);
export function daftarBulan(a: string, b: string): string[] {
  const out: string[] = [];
  for (let m = a; m <= b; m = addMonths(m, 1)) out.push(m);
  return out;
}

/**
 * Rentang waktu laporan. Bulanan = satu bulan; tahunan = 12 bulan berturut-turut mulai dari bulan dan tahun yang dipilih
 * (pilih Januari untuk satu tahun kalender). Tanpa pilihan, dipakai bulan setelah data terakhir. Bulan boleh di masa lalu
 * (data nyata) atau masa depan (proyeksi, maksimal 36 bulan setelah data terakhir).
 */
export function jendelaLaporan(q: { jenis?: string; bulan?: string; tahun?: string }, end: string): Jendela {
  const jenis: JenisLaporan = q.jenis === "tahunan" ? "tahunan" : "bulanan";
  const next = addMonths(end, 1);
  const tahun = /^\d{4}$/.test(q.tahun ?? "") ? q.tahun! : next.slice(0, 4);
  const bulan = /^(0[1-9]|1[0-2])$/.test(q.bulan ?? "") ? q.bulan! : next.slice(5, 7);
  const dari = `${tahun}-${bulan}`;
  let sampai = jenis === "tahunan" ? addMonths(dari, 11) : dari;
  const batas = addMonths(end, MAKS_KE_DEPAN);
  let dipotong = false;
  if (sampai > batas) { sampai = batas; dipotong = true; }
  const dr = dari > sampai ? sampai : dari;
  return { jenis, dari: dr, sampai, n: selisihBulan(dr, sampai) + 1, tahun: dr.slice(0, 4), bulan: dr.slice(5, 7), dipotong };
}
