import type { MacroRow } from "./importExcel";
import { pearson } from "./marketing";
import { monthlySeries, Txn } from "./forecast";

/** UTJ per bulan kalender penuh (bulan tanpa UTJ = 0) dari bulan UTJ pertama s.d. terakhir. */
export function utjMonthMap(txns: Txn[]): Map<string, number> {
  const ms = txns.map((t) => t.utj).sort();
  if (!ms.length) return new Map();
  const s = monthlySeries(txns, "utj", ms[0], ms[ms.length - 1]);
  return new Map(s.months.map((m, i) => [m, s.values[i]]));
}

export type Indikator = "emas" | "ihsg" | "inflasi" | "birate";
export const NAMA: Record<Indikator, string> = { emas: "Harga emas (USD/oz)", ihsg: "IHSG", inflasi: "Inflasi (%)", birate: "BI Rate" };

/** Korelasi bulanan indikator dengan UTJ (bulan sama dan indikator lag 1 bulan). Hanya konteks: SPEC 5.3 menyatakan makro tidak lolos backtest. */
export function macroContext(macro: MacroRow[], utjByMonth: Map<string, number>) {
  const out = (Object.keys(NAMA) as Indikator[]).map((k) => {
    const pts = macro.filter((m) => m[k] !== null && utjByMonth.has(m.bulan));
    const same = pearson(pts.map((m) => m[k]!), pts.map((m) => utjByMonth.get(m.bulan)!));
    const lagPts = macro.map((m, i) => ({ y: utjByMonth.get(m.bulan), x: i > 0 ? macro[i - 1][k] : null })).filter((p) => p.x !== null && p.y !== undefined);
    const lag = pearson(lagPts.map((p) => p.x!), lagPts.map((p) => p.y!));
    const valid = macro.filter((m) => m[k] !== null);
    return { indikator: NAMA[k], n: pts.length, korelasi: same === null ? null : +same.toFixed(2), korelasiLag1: lag === null ? null : +lag.toFixed(2), terakhir: valid.length ? valid[valid.length - 1].bulan : null, nilaiTerakhir: valid.length ? (k === "inflasi" ? +(valid[valid.length - 1][k]! * 100).toFixed(2) : valid[valid.length - 1][k]) : null };
  });
  return out;
}
