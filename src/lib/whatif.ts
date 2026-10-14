import { ForecastRow, addMonths } from "./forecast";

// KOEFISIEN ILUSTRASI (SPEC 4.1). Wajib dikalibrasi dari data sebelum dipakai keputusan.
export interface Scenario {
  units: number; startMonthOffset: number; // order bangun: jumlah unit & bulan mulai (offset dari bulan 1)
  price: number; promo: number; leads: number; events: number;
  cancel: number; bank: number; birate: number; ihsg: number; gold: number; inflation: number;
}
export const EMPTY: Scenario = { units: 0, startMonthOffset: 0, price: 0, promo: 0, leads: 0, events: 0, cancel: 0, bank: 0, birate: 0, ihsg: 0, gold: 0, inflation: 0 };

export const VARS: { key: keyof Scenario; group: string; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: "units", group: "Suplai · order bangun", label: "Jumlah unit dibangun", min: 0, max: 30, step: 1, unit: "unit" },
  { key: "startMonthOffset", group: "Suplai · order bangun", label: "Bulan mulai bangun (bulan ke-)", min: 0, max: 11, step: 1, unit: "" },
  { key: "price", group: "Harga & promo", label: "Perubahan harga", min: -10, max: 10, step: 1, unit: "%" },
  { key: "promo", group: "Harga & promo", label: "Nilai promo (dari harga)", min: 0, max: 6, step: 1, unit: "%" },
  { key: "leads", group: "Marketing", label: "Perubahan jumlah leads", min: -30, max: 50, step: 5, unit: "%" },
  { key: "events", group: "Marketing", label: "Tambahan event per bulan", min: 0, max: 6, step: 1, unit: "" },
  { key: "cancel", group: "Pipeline & bank", label: "Tingkat batal", min: -10, max: 10, step: 1, unit: "poin" },
  { key: "bank", group: "Pipeline & bank", label: "Lama proses bank", min: -15, max: 15, step: 1, unit: "hari" },
  { key: "birate", group: "Kondisi ekonomi", label: "BI Rate", min: -100, max: 100, step: 25, unit: "bps" },
  { key: "ihsg", group: "Kondisi ekonomi", label: "IHSG", min: -20, max: 20, step: 1, unit: "%" },
  { key: "gold", group: "Kondisi ekonomi", label: "Harga emas", min: -20, max: 20, step: 1, unit: "%" },
  { key: "inflation", group: "Kondisi ekonomi", label: "Inflasi", min: -2, max: 2, step: 0.5, unit: "poin" },
];

export const changedCount = (s: Scenario) => (Object.keys(s) as (keyof Scenario)[]).filter((k) => k !== "startMonthOffset" && s[k] !== 0).length;

export interface ScenarioRow { bulan: string; utj: number; akad: number; penerimaan: number }

export const NET_PRICE_MILIAR = 0.762; // rata-rata net price (SPEC 5.1); versi sungguhan: per tipe/unit
export const STOK_DEMO = 60; // unit siap jual (demo); sebenarnya dari sheet UNIT status Open

export function applyScenario(base: ForecastRow[], s: Scenario, stok: number = STOK_DEMO): { rows: ScenarioRow[]; stockWarning: boolean } {
  const utjMul = Math.max(0, 1 - 0.008 * s.price * 1 + 0.02 * s.promo + 0.005 * s.leads + 0.03 * s.events - 0.0004 * s.birate + 0.0015 * s.ihsg + 0.001 * s.gold - 0.03 * s.inflation);
  const akadMul = Math.max(0, 1 - 0.015 * s.cancel - 0.003 * s.bank);
  const extraUtj = Array(base.length).fill(0), extraAkad = Array(base.length).fill(0);
  if (s.units > 0) {
    const ready = s.startMonthOffset + 5;
    for (let k = 0; k < 6; k++) {
      if (ready + k < base.length) extraUtj[ready + k] += (s.units * 0.55) / 6;
      if (ready + k + 1 < base.length) extraAkad[ready + k + 1] += (s.units * 0.4) / 6;
    }
  }
  let cum = 0; // pemakaian unit bersih = UTJ - batal (batal ikut skala UTJ)
  const rows = base.map((b, i) => {
    const utj = b.utj * utjMul + extraUtj[i];
    const akad = b.akad * akadMul * (1 + (utjMul - 1) * 0.5) + extraAkad[i];
    cum += utj - (b.batal ?? 0) * utjMul;
    return { bulan: b.bulan, utj, akad, penerimaan: akad * NET_PRICE_MILIAR };
  });
  return { rows, stockWarning: cum > stok + s.units };
}
export { addMonths };

/** Skenario dari query string (?s=JSON). Nilai di luar rentang slider dipotong; kunci tak dikenal diabaikan. */
export function parseScenario(raw: string | undefined): Scenario | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...EMPTY };
    for (const v of VARS) {
      const x = Number(j[v.key]);
      if (isFinite(x)) out[v.key] = Math.min(v.max, Math.max(v.min, x));
    }
    return changedCount(out) > 0 ? out : null;
  } catch { return null; }
}
export const scenarioQuery = (s: Scenario) => encodeURIComponent(JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k, v]) => v !== 0 || k === "startMonthOffset" && s.units > 0))));
export const describeScenario = (s: Scenario) => VARS.filter((v) => v.key !== "startMonthOffset" && s[v.key] !== 0).map((v) => ({ label: v.label, nilai: `${s[v.key] > 0 && v.min < 0 ? "+" : ""}${s[v.key]} ${v.unit}`.trim() }));
