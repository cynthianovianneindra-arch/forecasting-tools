// Exponential smoothing aditif (Holt-Winters; level, tren, dan musiman aditif), pendekatan untuk FORECAST.ETS di Excel (versi AAA).
// Parameter dicari dengan grid yang meminimalkan galat kuadrat satu langkah; periode musiman dipilih otomatis (tanpa musiman, 3, 4, 6, atau 12)
// dengan kriteria AICc. Tidak persis sama dengan Excel (Excel memakai optimasi dan deteksi musiman bawaannya), tetapi sejenis dan deterministik.

export interface EtsFit { m: number; trend: boolean; alpha: number; beta: number; gamma: number; level: number; trendVal: number; season: number[]; sse: number; aicc: number }

const ALPHA = [0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8];
const BETA = [0, 0.05, 0.15, 0.3];
const GAMMA = [0, 0.15, 0.4, 0.7];
const PERIODE = [1, 3, 4, 6, 12];

function jalankan(y: number[], m: number, trend: boolean, a: number, b: number, g: number) {
  const n = y.length;
  const rata = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  let L: number, T: number;
  const S: number[] = Array(m).fill(0);
  if (m > 1) {
    L = rata(y.slice(0, m));
    T = trend ? (rata(y.slice(m, 2 * m)) - L) / m : 0;
    for (let i = 0; i < m; i++) S[i] = y[i] - L;
  } else { L = y[0]; T = trend ? y[1] - y[0] : 0; }
  let sse = 0;
  for (let t = 0; t < n; t++) {
    const s = m > 1 ? S[t % m] : 0;
    const e = y[t] - (L + T + s);
    sse += e * e;
    const Ln = L + T + a * e;
    T = trend ? T + b * a * e : 0;
    if (m > 1) S[t % m] = s + g * (1 - a) * e;
    L = Ln;
  }
  return { sse, L, T, S };
}

/** mode "aicc": periode musiman dipilih dengan kriteria AICc (hati-hati terhadap pola kebetulan). mode "excel": semua periode 2 sampai n/2 dicoba dan dipilih yang galat kuadratnya terkecil, tanpa penalti, mirip deteksi musiman otomatis FORECAST.ETS di Excel (bisa menangkap siklus kebetulan). */
export type ModeEts = "aicc" | "excel";

export function etsFit(y: number[], mode: ModeEts = "aicc"): EtsFit | null {
  const n = y.length;
  if (n < 4) return null;
  let best: EtsFit | null = null;
  const periode = mode === "excel" ? [1, ...Array.from({ length: Math.floor(n / 2) - 1 }, (_, i) => i + 2)] : PERIODE;
  for (const m of periode) {
    if (m > 1 && n < 2 * m) continue;
    for (const trend of [false, true]) {
      const k = 2 + (trend ? 2 : 0) + (m > 1 ? 1 + m : 0);
      if (n - k - 1 <= 0) continue;
      const bs = trend ? BETA : [0], gs = m > 1 ? GAMMA : [0];
      for (const a of ALPHA) for (const b of bs) for (const g of gs) {
        const r = jalankan(y, m, trend, a, b, g);
        const aicc = mode === "excel" ? r.sse : n * Math.log(r.sse / n + 1e-9) + 2 * k + (2 * k * (k + 1)) / (n - k - 1);
        if (!best || aicc < best.aicc) best = { m, trend, alpha: a, beta: b, gamma: g, level: r.L, trendVal: r.T, season: r.S, sse: r.sse, aicc };
      }
    }
  }
  return best;
}

/** Proyeksi h langkah ke depan (tidak negatif). Data terlalu pendek: rata-rata data. */
export function etsForecast(y: number[], h: number, mode: ModeEts = "aicc"): number[] {
  const f = etsFit(y, mode);
  if (!f) { const mu = y.length ? y.reduce((s, x) => s + x, 0) / y.length : 0; return Array(h).fill(mu); }
  const n = y.length;
  return Array.from({ length: h }, (_, i) => {
    const k = i + 1;
    const v = f.level + (f.trend ? f.trendVal * k : 0) + (f.m > 1 ? f.season[(n + k - 1) % f.m] : 0);
    return Math.max(0, v);
  });
}
