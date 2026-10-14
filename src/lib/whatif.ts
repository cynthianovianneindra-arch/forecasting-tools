import { ForecastRow, fl } from "./forecast";
import { INDIKATOR_MANUAL } from "./manual";

// KOEFISIEN ILUSTRASI (SPEC 4.1). Belum dikalibrasi dari data; baca hasil sebagai gambaran arah.
export const KATEGORI_EVENT = ["Open House", "Open Table", "Open Booth", "Pameran", "Company Visit"] as const;

export interface Scenario {
  bangun: Record<string, number>;      // order bangun: jumlah unit per tipe (dari unit berstatus Close)
  mulaiBangun: number;                 // bulan mulai bangun (offset 0..11 dari bulan proyeksi pertama)
  harga: number | null;                // harga jual rata-rata baru, Rp juta (null = tidak diubah)
  promo: number;                       // nilai promo, Rp juta per unit
  leads: number | null;                // leads per bulan yang diinginkan (null = tidak diubah)
  event: Record<string, number>;       // jumlah event per bulan per kategori
  birate: number | null; ihsg: number | null; emas: number | null; inflasi: number | null; // level baru, isi manual
}
export const EMPTY: Scenario = { bangun: {}, mulaiBangun: 0, harga: null, promo: 0, leads: null, event: {}, birate: null, ihsg: null, emas: null, inflasi: null };

/** Nilai acuan saat ini (dari data) untuk menghitung perubahan dari isian manual. */
export interface Referensi { harga: number; leadsBulanan: number | null; birate: number | null; ihsg: number | null; emas: number | null; inflasi: number | null }

export const NET_PRICE_MILIAR = 0.762; // cadangan bila belum ada data harga (SPEC 5.1)
export const STOK_DEMO = 60;

export const totalBangun = (s: Scenario) => Object.values(s.bangun).reduce((a, b) => a + (b > 0 ? b : 0), 0);
export const totalEvent = (s: Scenario) => Object.values(s.event).reduce((a, b) => a + (b > 0 ? b : 0), 0);

/** Perubahan yang diturunkan dari isian manual dibanding nilai acuan. */
export function turunan(s: Scenario, ref: Referensi) {
  const hargaPct = s.harga !== null && ref.harga > 0 ? (s.harga / ref.harga - 1) * 100 : 0;
  const hargaDipakai = s.harga ?? ref.harga;
  return {
    hargaPct,
    promoPct: s.promo > 0 && hargaDipakai > 0 ? (s.promo / hargaDipakai) * 100 : 0,
    leadsPct: s.leads !== null && ref.leadsBulanan ? (s.leads / ref.leadsBulanan - 1) * 100 : 0,
    event: totalEvent(s),
    biratBps: s.birate !== null && ref.birate !== null ? (s.birate - ref.birate) * 100 : 0,
    ihsgPct: s.ihsg !== null && ref.ihsg ? (s.ihsg / ref.ihsg - 1) * 100 : 0,
    emasPct: s.emas !== null && ref.emas ? (s.emas / ref.emas - 1) * 100 : 0,
    inflasiPoin: s.inflasi !== null && ref.inflasi !== null ? s.inflasi - ref.inflasi : 0,
    bangun: totalBangun(s),
  };
}

export interface ScenarioRow { bulan: string; utj: number; utjInt: number; akad: number; akadInt: number; penerimaan: number }

/** Pengali UTJ per kelompok variabel (aditif; koefisien ilustrasi). */
export function pengali(t: ReturnType<typeof turunan>) {
  const hargaPromo = -0.008 * t.hargaPct + 0.02 * t.promoPct;
  const marketing = 0.005 * t.leadsPct + 0.03 * t.event;
  const ekonomi = -0.0004 * t.biratBps + 0.0015 * t.ihsgPct + 0.001 * t.emasPct - 0.03 * t.inflasiPoin;
  return { hargaPromo, marketing, ekonomi, total: Math.max(0, 1 + hargaPromo + marketing + ekonomi) };
}

export function applyScenario(base: ForecastRow[], s: Scenario, ref: Referensi, stok: number = STOK_DEMO, netPriceMiliar: number = NET_PRICE_MILIAR): { rows: ScenarioRow[]; stockWarning: boolean; stokNeto: number } {
  const t = turunan(s, ref);
  const utjMul = pengali(t).total;
  const extraUtj = Array(base.length).fill(0), extraAkad = Array(base.length).fill(0);
  if (t.bangun > 0) {
    const ready = s.mulaiBangun + 5; // unit siap jual ±5 bulan setelah mulai bangun (ilustrasi)
    for (let k = 0; k < 6; k++) {
      if (ready + k < base.length) extraUtj[ready + k] += (t.bangun * 0.55) / 6;
      if (ready + k + 1 < base.length) extraAkad[ready + k + 1] += (t.bangun * 0.4) / 6;
    }
  }
  let cum = 0; // pemakaian unit bersih = UTJ - batal (batal ikut skala UTJ)
  const rows = base.map((b, i) => {
    const utj = b.utj * utjMul + extraUtj[i];
    const akad = b.akad * (1 + (utjMul - 1) * 0.5) + extraAkad[i];
    cum += utj - (b.batal ?? 0) * utjMul;
    return { bulan: b.bulan, utj, utjInt: fl(utj), akad, akadInt: fl(akad), penerimaan: fl(akad) * netPriceMiliar };
  });
  return { rows, stockWarning: cum > stok + t.bangun, stokNeto: cum };
}

const ada = (v: number | null) => v !== null && isFinite(v);
export const changedCount = (s: Scenario) =>
  Object.values(s.bangun).filter((v) => v > 0).length + (ada(s.harga) ? 1 : 0) + (s.promo > 0 ? 1 : 0) + (ada(s.leads) ? 1 : 0) +
  Object.values(s.event).filter((v) => v > 0).length + [s.birate, s.ihsg, s.emas, s.inflasi].filter(ada).length;

const klip = (v: unknown, min: number, max: number): number | null => { const n = Number(v); return v === null || v === undefined || v === "" || !isFinite(n) ? null : Math.min(max, Math.max(min, n)); };

/** Skenario dari query string (?s=JSON). Nilai di luar rentang dipotong; kunci tak dikenal diabaikan. */
export function parseScenario(raw: string | undefined): Scenario | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const out: Scenario = { ...EMPTY, bangun: {}, event: {} };
    if (j.bangun && typeof j.bangun === "object") for (const [k, v] of Object.entries(j.bangun as Record<string, unknown>)) { const n = klip(v, 0, 500); if (n && n > 0) out.bangun[k.slice(0, 40)] = Math.floor(n); }
    out.mulaiBangun = Math.floor(klip(j.mulaiBangun, 0, 11) ?? 0);
    out.harga = klip(j.harga, 100, 5000);
    out.promo = klip(j.promo, 0, 1000) ?? 0;
    out.leads = klip(j.leads, 0, 100000);
    if (j.event && typeof j.event === "object") for (const k of KATEGORI_EVENT) { const n = klip((j.event as Record<string, unknown>)[k], 0, 30); if (n && n > 0) out.event[k] = Math.floor(n); }
    out.birate = klip(j.birate, INDIKATOR_MANUAL.birate.min, INDIKATOR_MANUAL.birate.max);
    out.ihsg = klip(j.ihsg, INDIKATOR_MANUAL.ihsg.min, INDIKATOR_MANUAL.ihsg.max);
    out.emas = klip(j.emas, INDIKATOR_MANUAL.emas.min, INDIKATOR_MANUAL.emas.max);
    out.inflasi = klip(j.inflasi, INDIKATOR_MANUAL.inflasi.min, INDIKATOR_MANUAL.inflasi.max);
    return changedCount(out) > 0 ? out : null;
  } catch { return null; }
}
export const scenarioQuery = (s: Scenario) => encodeURIComponent(JSON.stringify(s));

/** Daftar variabel yang diubah, untuk ringkasan di layar dan laporan. */
export function describeScenario(s: Scenario, ref: Referensi): { label: string; nilai: string }[] {
  const t = turunan(s, ref), f = (n: number, d = 1) => n.toLocaleString("id-ID", { maximumFractionDigits: d });
  const out: { label: string; nilai: string }[] = [];
  for (const [tipe, n] of Object.entries(s.bangun)) if (n > 0) out.push({ label: `Order bangun ${tipe}`, nilai: `${n} unit (mulai bulan ke-${s.mulaiBangun + 1})` });
  if (ada(s.harga)) out.push({ label: "Harga jual rata-rata", nilai: `Rp ${f(s.harga!)} juta (${t.hargaPct >= 0 ? "+" : ""}${f(t.hargaPct)}% dari acuan Rp ${f(ref.harga)} juta)` });
  if (s.promo > 0) out.push({ label: "Nilai promo", nilai: `Rp ${f(s.promo)} juta per unit (${f(t.promoPct)}% dari harga)` });
  if (ada(s.leads)) out.push({ label: "Leads per bulan", nilai: `${f(s.leads!, 0)} (${t.leadsPct >= 0 ? "+" : ""}${f(t.leadsPct)}% dari acuan ${f(ref.leadsBulanan ?? 0, 0)})` });
  for (const [k, n] of Object.entries(s.event)) if (n > 0) out.push({ label: `Event ${k}`, nilai: `${n} per bulan` });
  if (ada(s.birate)) out.push({ label: "BI Rate", nilai: `${f(s.birate!, 2)}% (acuan ${ref.birate === null ? "-" : f(ref.birate, 2) + "%"})` });
  if (ada(s.ihsg)) out.push({ label: "IHSG", nilai: `${f(s.ihsg!, 0)} (acuan ${ref.ihsg === null ? "-" : f(ref.ihsg, 0)})` });
  if (ada(s.emas)) out.push({ label: "Harga emas", nilai: `USD ${f(s.emas!, 0)}/oz (acuan ${ref.emas === null ? "-" : f(ref.emas, 0)})` });
  if (ada(s.inflasi)) out.push({ label: "Inflasi", nilai: `${f(s.inflasi!, 2)}% (acuan ${ref.inflasi === null ? "-" : f(ref.inflasi, 2) + "%"})` });
  return out;
}
