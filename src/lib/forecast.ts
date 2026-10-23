// Mesin forecast: fungsi murni & deterministik. Semua angka dihitung di sini, bukan oleh Claude.
import { etsForecast } from "./ets";

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
  promo?: string; // semua promo, digabung " + " (untuk tampilan)
  promos?: string[]; // promo satu per satu (sheet PENJUALAN punya sampai 10 kolom promo)
  harga?: number; // rupiah, sebelum diskon
  diskon?: number; // rupiah
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

export type Metode = "ets" | "etsx" | "es" | "wma" | "mlr";
/** Metode yang memakai rumus ala Excel untuk batal, SPR & PPJB, akad, dan proses bank. */
export const rumusExcel = (m: Metode) => m === "ets" || m === "etsx";
export const METODE_NAMA: Record<Metode, string> = { ets: "ETS (musiman dipilih statistik)", etsx: "ETS gaya Excel (musiman otomatis)", es: "Exponential smoothing", wma: "Weighted moving average", mlr: "Multiple linear regression" };
export const METODE_PENJELASAN: Record<Metode, string> = {
  ets: "Rumus gaya Excel dengan pola musiman yang dipilih secara statistik (hati-hati terhadap pola kebetulan), biasanya lebih datar. UTJ dibulatkan ke bawah. Batal = UTJ x tingkat batal tahun lalu; SPR & PPJB = UTJ - batal; akad = (SPR & PPJB + proses bank) x tingkat akad tahun lalu.",
  etsx: "Meniru FORECAST.ETS di Excel: periode musiman dicari otomatis dari 2 bulan sampai separuh panjang data dan dipilih yang paling cocok dengan data lama, sehingga bisa menangkap siklus kebetulan (mis. 25 bulan) dan hasilnya naik turun. Angkanya mendekati Excel tetapi tidak persis sama. Batal, SPR & PPJB, akad, dan proses bank memakai rumus yang sama dengan ETS biasa.",
  es: "Memperhalus data lama: bulan terbaru berpengaruh paling besar, hasilnya datar.",
  wma: "Rata-rata beberapa bulan terakhir, bulan terbaru diberi bobot lebih besar, hasilnya datar.",
  mlr: "Garis tren dan pola musiman bulanan, ditambah rata-rata 3 bulan sebelumnya.",
};
export const METODE_LIST: Metode[] = ["ets", "etsx", "es", "wma", "mlr"];
export const parseMetode = (v?: string): Metode => (v === "etsx" || v === "es" || v === "wma" || v === "mlr" ? v : "ets");

/** Weighted moving average: jendela k terakhir dengan bobot linear (terbaru = k, terlama = 1); k dipilih dari {3,4,6,9,12} yang paling kecil galat satu langkahnya pada riwayat. */
export function wmaFit(y: number[]): { k: number; value: number } {
  const wavg = (w: number[]) => { const k = w.length; let s = 0, z = 0; w.forEach((v, i) => { s += v * (i + 1); z += i + 1; }); return k ? s / z : 0; };
  let best = { k: Math.min(3, Math.max(1, y.length)), sse: Infinity };
  for (const k of [3, 4, 6, 9, 12]) {
    if (y.length < k + 6) continue;
    let sse = 0;
    for (let i = k; i < y.length; i++) sse += (y[i] - wavg(y.slice(i - k, i))) ** 2;
    if (sse < best.sse) best = { k, sse };
  }
  return { k: best.k, value: wavg(y.slice(-best.k)) };
}
export function weightedMovingAverage(y: number[], h: number): number[] {
  return Array(h).fill(wmaFit(y).value);
}

/** Selesaikan sistem linear kecil (eliminasi Gauss dengan pivot). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) continue;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => (Math.abs(r[i]) < 1e-12 ? 0 : r[n] / r[i]));
}

/**
 * Multiple linear regression untuk UTJ bulanan. Peubah: konstanta, tren (t), musiman bulanan (sin dan cos), dan rata-rata 3 bulan sebelumnya.
 * m0 = indeks bulan pertama deret (ym). Proyeksi bertahap; hasil dipotong ke [0, 3 x maksimum riwayat].
 */
export function multipleLinearRegression(y: number[], h: number, m0 = 0): number[] {
  const n = y.length;
  if (n < 12) return Array(h).fill(mean(y));
  const feat = (i: number, hist: number[]) => {
    const ang = (2 * Math.PI * ((m0 + i) % 12)) / 12;
    return [1, i / 12, Math.sin(ang), Math.cos(ang), mean(hist.slice(Math.max(0, i - 3), i))];
  };
  const X: number[][] = [], Y: number[] = [];
  for (let i = 3; i < n; i++) { X.push(feat(i, y)); Y.push(y[i]); }
  const p = X[0].length;
  const A = Array.from({ length: p }, (_, r) => Array.from({ length: p }, (_, c) => X.reduce((s, row) => s + row[r] * row[c], 0) + (r === c && r > 0 ? 0.5 : 0)));
  const b = Array.from({ length: p }, (_, r) => X.reduce((s, row, i) => s + row[r] * Y[i], 0));
  const beta = solve(A, b);
  const cap = 3 * Math.max(1, ...y);
  const ext = [...y];
  for (let j = 0; j < h; j++) {
    const x = feat(n + j, ext);
    ext.push(Math.min(cap, Math.max(0, x.reduce((s, v, k) => s + v * beta[k], 0))));
  }
  return ext.slice(n);
}

/** Proyeksi UTJ h bulan dengan metode terpilih. m0 = indeks bulan pertama deret (ym). */
export function forecastUtj(metode: Metode, y: number[], h: number, m0 = 0): number[] {
  if (metode === "ets" || metode === "etsx") return etsForecast(y, h, metode === "etsx" ? "excel" : "aicc").map((v) => Math.floor(v + 1e-9));
  if (metode === "wma") return weightedMovingAverage(y, h);
  if (metode === "mlr") return multipleLinearRegression(y, h, m0);
  return exponentialSmoothing(y, h);
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
    for (let k = 0; k <= h - j && k <= MAX_AGE; k++) {
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

/** Tingkat batal dan akad tahun lalu: peristiwa batal (akad) dibagi UTJ pada tahun kalender penuh terakhir sebelum tahun proyeksi (hanya data sampai T). Tanpa tahun penuh: seluruh data. */
export function tingkatTahunLalu(txns: Txn[], T: string, tahun: number): { batal: number; akad: number; tahunAcuan: number | null } {
  const t = ym(T);
  const utj = new Map<number, number>(), batal = new Map<number, number>(), akad = new Map<number, number>();
  const tambah = (m: Map<number, number>, bulan?: string | null) => { if (bulan && ym(bulan) <= t) { const y = +bulan.slice(0, 4); m.set(y, (m.get(y) ?? 0) + 1); } };
  for (const x of txns) { tambah(utj, x.utj); tambah(batal, x.batal); tambah(akad, x.akad); }
  const penuh = [...utj.keys()].filter((y) => y < tahun && ym(`${y}-12`) <= t).sort((a, b) => b - a);
  if (penuh.length) { const y = penuh[0]; const u = utj.get(y)!; return { batal: (batal.get(y) ?? 0) / u, akad: (akad.get(y) ?? 0) / u, tahunAcuan: y }; }
  const U = [...utj.values()].reduce((s, v) => s + v, 0) || 1;
  return { batal: [...batal.values()].reduce((s, v) => s + v, 0) / U, akad: [...akad.values()].reduce((s, v) => s + v, 0) / U, tahunAcuan: null };
}

/** Rumus Excel (sheet SUMMARY): batal = ROUND(UTJ x tingkat batal), SPR & PPJB = UTJ - batal, akad = ROUND((proses bank bulan lalu + SPR & PPJB) x tingkat akad),
 *  proses bank = proses bank lalu + UTJ - batal - akad. Seperti di Excel, proses bank dimulai dari 0 pada bulan data terakhir (hanya arus yang diproyeksikan):
 *  dipakai berkas terbuka nyata sebagai awal, galat uji mundur akad naik dari 4,1 ke 9,7 unit (3 bulan). */
export function rumusAkadBatal(txns: Txn[], T: string, utj: number[]): { akad: number[]; batal: number[]; spr: number[]; proses: number[]; tahunAcuan: (number | null)[] } {
  let pb = 0;
  const akad: number[] = [], batal: number[] = [], spr: number[] = [], proses: number[] = [], acuan: (number | null)[] = [];
  const cache = new Map<number, ReturnType<typeof tingkatTahunLalu>>();
  utj.forEach((u, i) => {
    const th = +addMonths(T, i + 1).slice(0, 4);
    if (!cache.has(th)) cache.set(th, tingkatTahunLalu(txns, T, th));
    const r = cache.get(th)!;
    const b = Math.round(u * r.batal), s = u - b, a = Math.round((pb + s) * r.akad);
    pb = pb + u - b - a;
    akad.push(a); batal.push(b); spr.push(s); proses.push(pb); acuan.push(r.tahunAcuan);
  });
  return { akad, batal, spr, proses, tahunAcuan: acuan };
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
export function backtest(txns: Txn[], start: string, end: string, H = 3, minHist = 24, metode: Metode = "es"): BacktestResult {
  const u = monthlySeries(txns, "utj", start, end);
  const a = monthlySeries(txns, "akad", start, end);
  const n = u.values.length;
  let ae13 = 0, ae13n = 0, aeMa = 0, tot = 0, atot = 0, mtot = 0, origins = 0;
  const errs: number[][] = Array.from({ length: H }, () => []);
  for (let t = minHist; t <= n - H; t++) {
    const fc = forecastUtj(metode, u.values.slice(0, t), H, ym(start));
    const ma = movingAverage(u.values.slice(0, t), H, 12);
    const actU = u.values.slice(t, t + H), actA = a.values.slice(t, t + H);
    fc.forEach((p, i) => { ae13 += Math.abs(p - actU[i]); aeMa += Math.abs(ma[i] - actU[i]); ae13n++; errs[i].push(p - actU[i]); });
    tot += Math.abs(fc.reduce((x, y) => x + y, 0) - actU.reduce((x, y) => x + y, 0));
    const T = u.months[t - 1];
    const pa = rumusExcel(metode) ? rumusAkadBatal(txns, T, fc).akad : pipelineAkad(txns, T, fc);
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

export const fl = (v: number) => Math.floor(v + 1e-9);

/** utj/utjLo/utjHi mentah dipakai untuk perhitungan; *Int = dibulatkan ke bawah untuk tampilan (UTJ dan akad adalah cacah unit). */
export interface ForecastRow { bulan: string; utj: number; utjInt: number; utjLo: number; utjHi: number; utjLoInt: number; utjHiInt: number; akad: number; akadInt: number; batal: number; trend: number; batalInt?: number; spr?: number; proses?: number }

export interface BandingMetode { metode: Metode; utjMae13: number; utjMaeTotal3: number; akadMaeTotal3: number }

/** Perbandingan tiga metode lewat uji mundur yang sama. Paling mendekati = galat UTJ rata-rata (1-3 bulan) terkecil; seri dipecah oleh galat akad. */
export function bandingkanMetode(bts: Record<Metode, BacktestResult>): { baris: BandingMetode[]; terbaik: Metode } {
  const baris = METODE_LIST.map((m) => ({ metode: m, utjMae13: bts[m].utjMae13, utjMaeTotal3: bts[m].utjMaeTotal3, akadMaeTotal3: bts[m].akadMaeTotal3 }));
  const terbaik = [...baris].sort((a, b) => a.utjMae13 - b.utjMae13 || a.akadMaeTotal3 - b.akadMaeTotal3)[0].metode;
  return { baris, terbaik };
}

export function forecast(txns: Txn[], start: string, end: string, H = 12, metode: Metode = "es"): { rows: ForecastRow[]; bt: BacktestResult; trendDivergent: boolean; metode: Metode; banding: { baris: BandingMetode[]; terbaik: Metode } } {
  const u = monthlySeries(txns, "utj", start, end);
  const base = forecastUtj(metode, u.values, H, ym(start));
  const trend = linearTrend(u.values, H, 24);
  const rx = rumusExcel(metode) ? rumusAkadBatal(txns, end, base) : null;
  const pj = rx ?? pipelineAkadBatal(txns, end, base);
  const akad = pj.akad;
  const bts = { ets: backtest(txns, start, end, 3, 24, "ets"), etsx: backtest(txns, start, end, 3, 24, "etsx"), es: backtest(txns, start, end, 3, 24, "es"), wma: backtest(txns, start, end, 3, 24, "wma"), mlr: backtest(txns, start, end, 3, 24, "mlr") };
  const bt = bts[metode];
  const rows = base.map((p, i) => {
    const { lo, hi } = utjInterval(p, i + 1, bt.errorsByHorizon);
    return { bulan: addMonths(end, i + 1), utj: p, utjInt: fl(p), utjLo: lo, utjHi: hi, utjLoInt: fl(lo), utjHiInt: fl(hi), akad: akad[i], akadInt: fl(akad[i]), batal: pj.batal[i], trend: trend[i], ...(rx ? { batalInt: rx.batal[i], spr: rx.spr[i], proses: rx.proses[i] } : {}) };
  });
  const bs = mean(base), ts = mean(trend);
  return { rows, bt, trendDivergent: Math.abs(ts - bs) / Math.max(bs, 1) > 0.25, metode, banding: bandingkanMetode(bts) };
}
