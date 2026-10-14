// Mesin forecast: fungsi murni & deterministik. Semua angka dihitung di sini, bukan oleh Claude.

export interface BankCase { bank: string; hari: number | null; status: string }
export interface Txn {
  utj: string; // 'YYYY-MM'
  akad?: string | null;
  batal?: string | null;
  spr?: boolean;
  cair?: boolean;
  tipe?: string;
  agent?: string;
  marketing?: string;
  leads?: string;
  database?: string;
  cluster?: string;
  tahap?: string;
  unit?: string; // ID unit (bukan data pribadi)
  alasanBatal?: string;
  netPrice?: number; // rupiah
  banks?: BankCase[];
}

export const MAX_AGE = 18;

export const ym = (s: string) => {
  const [y, m] = s.split("-").map(Number);
  return y * 12 + (m - 1);
};
export const fromIdx = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
export const addMonths = (s: string, n: number) => fromIdx(ym(s) + n);

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

/** Rata-rata bergulir k bulan terakhir, diproyeksikan datar sebanyak h bulan. */
export function movingAverage(y: number[], h: number, k = 12): number[] {
  return Array(h).fill(mean(y.slice(-k)));
}

export const ALPHA_MIN = 0.05, ALPHA_MAX = 0.3;

/** Level exponential smoothing (SES) dengan alpha dicari di [ALPHA_MIN, ALPHA_MAX] yang meminimalkan galat satu langkah; level awal = rata-rata 3 data pertama. */
export function sesFit(y: number[]): { alpha: number; level: number } {
  if (!y.length) return { alpha: ALPHA_MIN, level: 0 };
  const l0 = mean(y.slice(0, 3));
  let best = { alpha: ALPHA_MIN, level: l0, sse: Infinity };
  for (let a = ALPHA_MIN; a <= ALPHA_MAX + 1e-9; a += 0.01) {
    let l = l0, sse = 0;
    for (const v of y) { sse += (v - l) ** 2; l = a * v + (1 - a) * l; }
    if (sse < best.sse) best = { alpha: a, level: l, sse };
  }
  return { alpha: +best.alpha.toFixed(2), level: best.level };
}

/** Exponential smoothing (level): proyeksi datar sebanyak h bulan. Metode utama UTJ (keputusan pemilik; SPEC 5.2: MAE 3,18). */
export function exponentialSmoothing(y: number[], h: number): number[] {
  return Array(h).fill(sesFit(y).level);
}

/** Garis tren OLS (pembanding, setara sklearn LinearRegression) pada k bulan terakhir; dipotong ke >= 0. */
export function linearTrend(y: number[], h: number, k = 24): number[] {
  const w = k ? y.slice(-k) : y;
  const n = w.length;
  const xs = w.map((_, i) => i);
  const mx = mean(xs), my = mean(w);
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (w[i] - my); }
  const b = sxx ? sxy / sxx : 0;
  const a = my - b * mx;
  return Array.from({ length: h }, (_, j) => Math.max(0, a + b * (n + j)));
}

/** Deret bulanan penuh (kalender) dari kunci bulan awal sampai akhir. */
export function monthlySeries(txns: Txn[], field: "utj" | "akad" | "batal", start: string, end: string) {
  const months: string[] = [];
  for (let i = ym(start); i <= ym(end); i++) months.push(fromIdx(i));
  const c = new Map(months.map((m) => [m, 0]));
  for (const t of txns) {
    const v = t[field];
    if (v && c.has(v)) c.set(v, c.get(v)! + 1);
  }
  return { months, values: months.map((m) => c.get(m)!) };
}

export interface Hazards { ha: number[]; hb: number[] }

/** Hazard akad/batal per umur UTJ, hanya memakai event dengan bulan <= T. */
export function hazards(txns: Txn[], T: string): Hazards {
  const t = ym(T);
  const d = txns.filter((x) => ym(x.utj) <= t);
  const ha = Array(MAX_AGE + 1).fill(0), hb = Array(MAX_AGE + 1).fill(0);
  const rows = d.map((x) => {
    const u = ym(x.utj);
    const ta = x.akad && ym(x.akad) <= t ? ym(x.akad) - u : null;
    const tb = x.batal && ym(x.batal) <= t ? ym(x.batal) - u : null;
    const ev = [ta, tb].filter((v): v is number => v !== null);
    return { u, ta, tb, first: ev.length ? Math.min(...ev) : null };
  });
  for (let a = 0; a <= MAX_AGE; a++) {
    let risk = 0, ea = 0, eb = 0;
    for (const r of rows) {
      if (r.u + a > t) continue;
      if (r.first !== null && r.first < a) continue;
      risk++;
      if (r.first === a) {
        if (r.ta === a && (r.tb === null || r.ta <= r.tb)) ea++; else eb++;
      }
    }
    if (risk >= 3) { ha[a] = ea / risk; hb[a] = eb / risk; }
  }
  return { ha, hb };
}

/** Proyeksi akad dan batal per bulan (h bulan) dari pipeline UTJ terbuka + UTJ baru yang diproyeksikan. */
export function pipelineAkadBatal(txns: Txn[], T: string, utjForecast: number[]): { akad: number[]; batal: number[] } {
  const h = utjForecast.length;
  const t = ym(T);
  const { ha, hb } = hazards(txns, T);
  const out = Array(h).fill(0), outB = Array(h).fill(0);
  for (const x of txns) {
    if (ym(x.utj) > t) continue;
    if ((x.akad && ym(x.akad) <= t) || (x.batal && ym(x.batal) <= t)) continue;
    const age = t - ym(x.utj);
    let s = 1;
    for (let k = 1; k <= h; k++) {
      const a = age + k;
      if (a > MAX_AGE) break;
      out[k - 1] += s * ha[a];
      outB[k - 1] += s * hb[a];
      s *= 1 - ha[a] - hb[a];
    }
  }
  for (let j = 1; j <= h; j++) {
    let s = 1;
    for (let k = 0; k <= h - j; k++) {
      out[j + k - 1] += utjForecast[j - 1] * s * ha[k];
      outB[j + k - 1] += utjForecast[j - 1] * s * hb[k];
      s *= 1 - ha[k] - hb[k];
    }
  }
  return { akad: out, batal: outB };
}

/** Proyeksi akad per bulan (lihat pipelineAkadBatal). */
export function pipelineAkad(txns: Txn[], T: string, utjForecast: number[]): number[] {
  return pipelineAkadBatal(txns, T, utjForecast).akad;
}

export interface BacktestResult {
  origins: number;
  utjMae13: number;      // MAE 1-3 bln, exponential smoothing (metode utama)
  utjMae13Ma12: number;  // pembanding: rata-rata 12 bulan
  utjMaeTotal3: number;
  akadMaeTotal3: number; // pipeline
  akadMaeMa12: number;   // pembanding
  errorsByHorizon: number[][]; // galat bertanda (prediksi - aktual) UTJ per horizon 1..3
}

/** Rolling origin: asal pertama setelah 24 bulan, ramal H=3 bulan. */
export function backtest(txns: Txn[], start: string, end: string, H = 3, minHist = 24): BacktestResult {
  const u = monthlySeries(txns, "utj", start, end);
  const a = monthlySeries(txns, "akad", start, end);
  const n = u.values.length;
  let ae13 = 0, ae13n = 0, aeMa = 0, tot = 0, atot = 0, mtot = 0, origins = 0;
  const errs: number[][] = Array.from({ length: H }, () => []);
  for (let t = minHist; t <= n - H; t++) {
    const fc = exponentialSmoothing(u.values.slice(0, t), H);
    const ma = movingAverage(u.values.slice(0, t), H, 12);
    const actU = u.values.slice(t, t + H), actA = a.values.slice(t, t + H);
    fc.forEach((p, i) => { ae13 += Math.abs(p - actU[i]); aeMa += Math.abs(ma[i] - actU[i]); ae13n++; errs[i].push(p - actU[i]); });
    tot += Math.abs(fc.reduce((x, y) => x + y, 0) - actU.reduce((x, y) => x + y, 0));
    const T = u.months[t - 1];
    const pa = pipelineAkad(txns, T, fc);
    atot += Math.abs(pa.reduce((x, y) => x + y, 0) - actA.reduce((x, y) => x + y, 0));
    const maA = movingAverage(a.values.slice(0, t), H, 12);
    mtot += Math.abs(maA.reduce((x, y) => x + y, 0) - actA.reduce((x, y) => x + y, 0));
    origins++;
  }
  return { origins, utjMae13: ae13 / ae13n, utjMae13Ma12: aeMa / ae13n, utjMaeTotal3: tot / origins, akadMaeTotal3: atot / origins, akadMaeMa12: mtot / origins, errorsByHorizon: errs };
}

const quantile = (a: number[], q: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
};

/** Rentang 10–90% untuk UTJ bulanan; melebar dengan horizon. Dasar: kuantil galat backtest (horizon > 3 mengikuti akar horizon). */
export const MIN_GALAT_BACKTEST = 5;

/** Rentang cadangan bila riwayat terlalu pendek untuk uji mundur: data cacah (Poisson) dengan faktor sebaran 1,5 yang melebar dengan horizon. */
export function utjIntervalPendek(point: number, horizon: number) {
  const half = 1.28 * 1.5 * Math.sqrt(Math.max(point, 0.5) * (1 + horizon / 12));
  return { lo: Math.max(0, point - half), hi: point + half };
}

export function utjInterval(point: number, horizon: number, errsByH: number[][]) {
  const h = Math.min(horizon, errsByH.length);
  if (!errsByH[h - 1] || errsByH[h - 1].length < MIN_GALAT_BACKTEST) return utjIntervalPendek(point, horizon);
  const e = errsByH[h - 1].map((x) => -x); // aktual - prediksi
  const scale = horizon > h ? Math.sqrt(horizon / h) : 1;
  const lo = Math.max(0, point + quantile(e, 0.1) * scale);
  const hi = Math.max(lo, point + quantile(e, 0.9) * scale);
  return { lo, hi };
}

export interface ForecastRow { bulan: string; utj: number; utjLo: number; utjHi: number; akad: number; akadInt: number; batal: number; trend: number }

export function forecast(txns: Txn[], start: string, end: string, H = 12): { rows: ForecastRow[]; bt: BacktestResult; trendDivergent: boolean } {
  const u = monthlySeries(txns, "utj", start, end);
  const base = exponentialSmoothing(u.values, H);
  const trend = linearTrend(u.values, H, 24);
  const pj = pipelineAkadBatal(txns, end, base);
  const akad = pj.akad;
  const bt = backtest(txns, start, end);
  const rows = base.map((p, i) => {
    const { lo, hi } = utjInterval(p, i + 1, bt.errorsByHorizon);
    return { bulan: addMonths(end, i + 1), utj: p, utjLo: lo, utjHi: hi, akad: akad[i], akadInt: Math.floor(akad[i] + 1e-9), batal: pj.batal[i], trend: trend[i] };
  });
  const bs = mean(base), ts = mean(trend);
  return { rows, bt, trendDivergent: Math.abs(ts - bs) / Math.max(bs, 1) > 0.25 };
}
