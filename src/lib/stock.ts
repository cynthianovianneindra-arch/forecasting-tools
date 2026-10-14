import type { UnitRow } from "./importExcel";

/** Definisi stok tersedia dijual = status "Open" (SPEC pertanyaan 3: Margal/Hold/Close belum dihitung; perlu konfirmasi pemilik). */
export const STOK_STATUS = "OPEN";

export function stockSummary(units: UnitRow[]) {
  const by = new Map<string, number>();
  for (const u of units) by.set(u.status.toUpperCase() || "(KOSONG)", (by.get(u.status.toUpperCase() || "(KOSONG)") ?? 0) + 1);
  const open = units.filter((u) => u.status.toUpperCase() === STOK_STATUS);
  const perTipe = new Map<string, number>();
  for (const u of open) perTipe.set(u.tipe, (perTipe.get(u.tipe) ?? 0) + 1);
  return {
    total: units.length,
    open: open.length,
    status: [...by].map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
    perTipe: [...perTipe].map(([tipe, n]) => ({ tipe, n })).sort((a, b) => b.n - a.n),
  };
}

/** Bulan ke berapa (1..h) proyeksi kumulatif UTJ melampaui stok; null bila stok cukup. */
export function stockoutMonth(utj: number[], stok: number, extraBuilt = 0): number | null {
  let c = 0;
  for (let i = 0; i < utj.length; i++) { c += utj[i]; if (c > stok + extraBuilt) return i + 1; }
  return null;
}
