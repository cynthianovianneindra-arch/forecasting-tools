// Target penjualan per bulan (UTJ dan akad) dan perbandingannya dengan realisasi dan proyeksi. Fungsi murni (mudah diuji).
export interface TargetRow { bulan: string; utj: number; akad: number }
export class TargetError extends Error {}

const TAHUN = /^\d{4}$/;
const MAKS = 2000;
const bulanDari = (tahun: string, i: number) => `${tahun}-${String(i).padStart(2, "0")}`;

/** Membagi total ke n bulan secara merata (sisa dibagikan ke bulan-bulan awal). */
export function bagiRata(total: number, n = 12): number[] {
  const dasar = Math.floor(total / n), sisa = total - dasar * n;
  return Array.from({ length: n }, (_, i) => dasar + (i < sisa ? 1 : 0));
}

const angka = (s: string, nama: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const v = Number(t.replace(",", "."));
  if (!isFinite(v) || !Number.isInteger(v) || v < 0 || v > MAKS) throw new TargetError(`${nama}: isi bilangan bulat 0 sampai ${MAKS}`);
  return v;
};

/** Membaca isian form target satu tahun. Kolom bulan kosong dihitung 0; bila semua bulan kosong dan kolom "total setahun" terisi, total dibagi rata. */
export function bacaFormTarget(get: (k: string) => string): { tahun: string; rows: TargetRow[] } {
  const tahun = get("tahun").trim();
  if (!TAHUN.test(tahun) || +tahun < 2000 || +tahun > 2100) throw new TargetError("Tahun tidak valid");
  const kolom = (pref: "utj" | "akad", nama: string): number[] | null => {
    const bulanan = Array.from({ length: 12 }, (_, i) => angka(get(`${pref}_${String(i + 1).padStart(2, "0")}`), `${nama} bulan ${i + 1}`));
    if (bulanan.some((x) => x !== null)) return bulanan.map((x) => x ?? 0);
    const total = angka(get(`total_${pref}`), `Total ${nama} setahun`);
    return total === null ? null : bagiRata(total);
  };
  const u = kolom("utj", "UTJ"), a = kolom("akad", "akad");
  if (!u && !a) throw new TargetError("Isi minimal satu target (per bulan, atau total setahun)");
  return { tahun, rows: Array.from({ length: 12 }, (_, i) => ({ bulan: bulanDari(tahun, i + 1), utj: u?.[i] ?? 0, akad: a?.[i] ?? 0 })) };
}

export type StatusTarget = "tercapai" | "mendekati" | "di bawah";
/** Perkiraan akhir tahun terhadap target: tercapai (>=100%), mendekati (90-99%), di bawah (<90%). */
export const statusTarget = (perkiraan: number, target: number): StatusTarget | null => {
  if (target <= 0) return null;
  const p = perkiraan / target;
  return p >= 1 ? "tercapai" : p >= 0.9 ? "mendekati" : "di bawah";
};
export const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

export interface BarisCapaian { bulan: string; targetUtj: number | null; targetAkad: number | null; utj: number | null; akad: number | null; aktual: boolean }
export interface UkuranCapaian { target: number; realisasiSampaiKini: number; targetSampaiKini: number; perkiraanAkhirTahun: number; sisaBulan: number; perluPerBulan: number | null; proyeksiPerBulan: number | null; status: StatusTarget | null }
export interface Capaian { tahun: string; sampai: string; lengkap: boolean; baris: BarisCapaian[]; utj: UkuranCapaian; akad: UkuranCapaian }

/** Capaian satu tahun: bulan sampai data terakhir memakai realisasi, bulan sesudahnya memakai proyeksi. Null bila tahun itu belum punya target. */
export function hitungCapaian(
  targets: TargetRow[],
  aktual: { bulan: string; utj: number; akad: number }[],
  proyeksi: { bulan: string; utjInt: number; akadInt: number }[],
  tahun: string,
  akhirData: string,
): Capaian | null {
  const tMap = new Map(targets.filter((t) => t.bulan.startsWith(tahun)).map((t) => [t.bulan, t]));
  if (!tMap.size) return null;
  const aMap = new Map(aktual.map((m) => [m.bulan, m])), pMap = new Map(proyeksi.map((r) => [r.bulan, r]));
  let lengkap = true;
  const baris: BarisCapaian[] = Array.from({ length: 12 }, (_, i): BarisCapaian => {
    const bulan = bulanDari(tahun, i + 1), t = tMap.get(bulan);
    const isAktual = bulan <= akhirData;
    const a = isAktual ? aMap.get(bulan) : undefined, p = !isAktual ? pMap.get(bulan) : undefined;
    if (!a && !p) lengkap = false;
    return { bulan, targetUtj: t?.utj ?? null, targetAkad: t?.akad ?? null, utj: a ? a.utj : p ? p.utjInt : null, akad: a ? a.akad : p ? p.akadInt : null, aktual: isAktual };
  });
  const ukur = (kt: "targetUtj" | "targetAkad", kv: "utj" | "akad"): UkuranCapaian => {
    const sum = (xs: (number | null)[]) => xs.reduce<number>((s, x) => s + (x ?? 0), 0);
    const target = sum(baris.map((b) => b[kt]));
    const real = baris.filter((b) => b.aktual), sisa = baris.filter((b) => !b.aktual);
    const realisasi = sum(real.map((b) => b[kv])), perkiraan = realisasi + sum(sisa.map((b) => b[kv]));
    const sisaBulan = sisa.length;
    return {
      target, realisasiSampaiKini: realisasi, targetSampaiKini: sum(real.map((b) => b[kt])), perkiraanAkhirTahun: perkiraan, sisaBulan,
      perluPerBulan: sisaBulan > 0 ? Math.max(0, Math.ceil((target - realisasi) / sisaBulan)) : null,
      proyeksiPerBulan: sisaBulan > 0 ? Math.round(sum(sisa.map((b) => b[kv])) / sisaBulan) : null,
      status: statusTarget(perkiraan, target),
    };
  };
  return { tahun, sampai: akhirData, lengkap, baris, utj: ukur("targetUtj", "utj"), akad: ukur("targetAkad", "akad") };
}
