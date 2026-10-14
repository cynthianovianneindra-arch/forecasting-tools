import type { UnitRow } from "./importExcel";

/** Arti status di sheet UNIT (konfirmasi pemilik): Open = tersedia dijual; Close = belum dibangun (potensi untuk order bangun);
 *  Margal dan Sold = sudah terjual; Proses = sudah dipesan (UTJ berjalan). */
export const ARTI_STATUS: Record<string, string> = { SOLD: "sudah akad", MARGAL: "sudah terjual", PROSES: "sudah dipesan (UTJ berjalan)", OPEN: "tersedia dijual", CLOSE: "belum dibangun" };
export const STATUS_BELUM_DIBANGUN = "CLOSE";

/** Definisi stok tersedia dijual = status "Open" (SPEC pertanyaan 3: Margal/Hold/Close belum dihitung; perlu konfirmasi pemilik). */
export const STOK_STATUS = "OPEN";

export function stockSummary(units: UnitRow[]) {
  const by = new Map<string, number>();
  for (const u of units) by.set(u.status.toUpperCase() || "(KOSONG)", (by.get(u.status.toUpperCase() || "(KOSONG)") ?? 0) + 1);
  const open = units.filter((u) => u.status.toUpperCase() === STOK_STATUS);
  const perTipe = new Map<string, number>();
  for (const u of open) perTipe.set(u.tipe, (perTipe.get(u.tipe) ?? 0) + 1);
  const belum = units.filter((u) => u.status.toUpperCase() === STATUS_BELUM_DIBANGUN);
  const belumTipe = new Map<string, number>();
  for (const u of belum) belumTipe.set(u.tipe, (belumTipe.get(u.tipe) ?? 0) + 1);
  return {
    total: units.length,
    open: open.length,
    belumDibangun: belum.length,
    belumDibangunPerTipe: [...belumTipe].map(([tipe, n]) => ({ tipe, n })).sort((a, b) => b.n - a.n),
    status: [...by].map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
    perTipe: [...perTipe].map(([tipe, n]) => ({ tipe, n })).sort((a, b) => b.n - a.n),
  };
}

/** Bulan ke berapa (1..h) pemakaian unit kumulatif melampaui stok; null bila stok cukup.
 *  Pemakaian bersih = UTJ dikurangi batal (UTJ batal mengembalikan unit ke stok). */
/** Gabungan per tipe: Open (stok), Close (belum dibangun), diurutkan dari yang terbesar. */
export function stockByType(st: { perTipe: { tipe: string; n: number }[]; belumDibangunPerTipe: { tipe: string; n: number }[] }) {
  const m = new Map<string, { tipe: string; open: number; belum: number }>();
  for (const x of st.perTipe) m.set(x.tipe, { tipe: x.tipe, open: x.n, belum: 0 });
  for (const x of st.belumDibangunPerTipe) { const e = m.get(x.tipe) ?? { tipe: x.tipe, open: 0, belum: 0 }; e.belum = x.n; m.set(x.tipe, e); }
  return [...m.values()].sort((a, b) => b.open + b.belum - (a.open + a.belum));
}

export function stockoutMonth(utj: number[], stok: number, extraBuilt = 0, batal: number[] = []): number | null {
  let c = 0;
  for (let i = 0; i < utj.length; i++) { c += utj[i] - (batal[i] ?? 0); if (c > stok + extraBuilt) return i + 1; }
  return null;
}

/** Kekurangan unit pada akhir horizon (0 bila cukup), dengan pemakaian bersih. */
export function stockShortfall(utj: number[], stok: number, batal: number[] = []): number {
  const net = utj.reduce((a, x, i) => a + x - (batal[i] ?? 0), 0);
  return Math.max(0, Math.round(net - stok));
}
