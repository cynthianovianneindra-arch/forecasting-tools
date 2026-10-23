/**
 * Riwayat BI-Rate dari keputusan Rapat Dewan Gubernur (RDG) Bank Indonesia.
 * Yahoo Finance tidak punya seri BI-Rate, jadi riwayat ini jadi dasar; angka terbaru dari bi.go.id menimpanya saat sinkron.
 * Nilai = level yang berlaku pada akhir bulan keputusan (perubahan, dalam %).
 */
export const KEPUTUSAN_BI_RATE: { bulan: string; nilai: number }[] = [
  { bulan: "2024-01", nilai: 6.0 },
  { bulan: "2024-04", nilai: 6.25 }, // naik 25 bps
  { bulan: "2024-09", nilai: 6.0 }, // turun 25 bps
  { bulan: "2025-01", nilai: 5.75 },
  { bulan: "2025-05", nilai: 5.5 },
  { bulan: "2025-07", nilai: 5.25 },
  { bulan: "2025-08", nilai: 5.0 },
  { bulan: "2025-09", nilai: 4.75 },
  { bulan: "2026-05", nilai: 5.25 }, // naik 50 bps
  { bulan: "2026-06", nilai: 5.75 }, // naik 25 bps; ditahan Juli, September, Oktober 2026
];

/** Satu nilai per bulan dari bulan pertama sampai `sampai` (YYYY-MM); bulan tanpa keputusan memakai level sebelumnya. */
export function riwayatBiRate(sampai: string, keputusan = KEPUTUSAN_BI_RATE): { bulan: string; nilai: number }[] {
  const out: { bulan: string; nilai: number }[] = [];
  if (!keputusan.length) return out;
  let [y, m] = keputusan[0].bulan.split("-").map(Number), nilai = keputusan[0].nilai;
  for (;;) {
    const b = `${y}-${String(m).padStart(2, "0")}`;
    if (b > sampai) break;
    nilai = keputusan.find((k) => k.bulan === b)?.nilai ?? nilai;
    out.push({ bulan: b, nilai });
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
