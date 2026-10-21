// Analisa lanjutan (semua angka dihitung deterministik dari data): efektivitas promo, skenario tanpa PPN DTP, unit diminati,
// rekomendasi order bangun, daya beli, dan sinyal pasar. Temuan berlabel "hipotesis" bila sampel kecil atau berupa perkiraan.
import type { Txn } from "./forecast";
import { addMonths, ym } from "./forecast";
import type { MacroRow, UnitRow } from "./importExcel";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const jmlBulan = (a: string, b: string) => ym(b) - ym(a) + 1;

// ---------- Promo ----------
export type VonisPromo = "Efektif" | "Cukup" | "Perlu diubah" | "Sampel kecil";
export interface BarisPromo { promo: string; utj: number; porsiUtj: number; akad: number; batal: number; proses: number; persenBatal: number | null; diskonPersen: number | null; bulanAktif: number; ppn: boolean; vonis: VonisPromo }

/** Promo satu transaksi; satu UTJ bisa memakai beberapa promo, dan dihitung di tiap promo itu. */
const daftarPromo = (t: Txn): string[] => t.promos ?? (t.promo ? [t.promo] : []);

const batalSelesai = (xs: Txn[]) => { const b = xs.filter((t) => t.batal).length, a = xs.filter((t) => t.akad).length; return b + a ? Math.round((b / (a + b)) * 1000) / 10 : null; };

/** Promo per kode: UTJ, porsi UTJ, batal, rata-rata diskon, lama aktif. Mutu dinilai dari persen batal pada UTJ yang sudah selesai (akad atau batal), karena UTJ baru yang masih diproses belum bisa batal.
 *  Efektif = batal jauh di bawah rata-rata (5 poin atau lebih); Perlu diubah = batal 10 poin atau lebih di atas rata-rata; UTJ kurang dari 5 = sampel kecil. */
export function analisaPromo(txns: Txn[]) {
  const ms = txns.map((t) => t.utj).sort();
  if (!ms.length) return { baris: [] as BarisPromo[], rataUtjBulan: 0, rataBatal: 0, tanpaPromo: { utj: 0, persenBatal: null as number | null } };
  const rataUtjBulan = txns.length / jmlBulan(ms[0], ms[ms.length - 1]);
  const rataBatal = batalSelesai(txns) ?? 0;
  const g = new Map<string, Txn[]>();
  for (const t of txns) for (const pr of daftarPromo(t)) g.set(pr, [...(g.get(pr) ?? []), t]);
  const baris = [...g].map(([promo, xs]): BarisPromo => {
    const bln = xs.map((t) => t.utj).sort();
    const utj = xs.length, batal = xs.filter((t) => t.batal).length, akad = xs.filter((t) => t.akad).length;
    const dis = xs.filter((t) => t.harga && t.diskon).map((t) => (t.diskon! / t.harga!) * 100);
    const pb = batalSelesai(xs);
    const vonis: VonisPromo = utj < 5 || pb === null ? "Sampel kecil" : pb <= rataBatal - 5 ? "Efektif" : pb >= rataBatal + 10 ? "Perlu diubah" : "Cukup";
    return { promo, utj, porsiUtj: pct(utj, txns.length), akad, batal, proses: utj - akad - batal, persenBatal: pb, diskonPersen: dis.length ? +(sum(dis) / dis.length).toFixed(1) : null, bulanAktif: jmlBulan(bln[0], bln[bln.length - 1]), ppn: promo.startsWith("PPN"), vonis };
  }).sort((a, b) => b.utj - a.utj);
  const tp = txns.filter((t) => !t.promo);
  return { baris, rataUtjBulan: +rataUtjBulan.toFixed(1), rataBatal, tanpaPromo: { utj: tp.length, persenBatal: batalSelesai(tp) } };
}

// ---------- Skenario tanpa PPN DTP ----------
export interface SkenarioPpn { adaPpn: boolean; akhirData: string; porsiPpn12: number; utjPpn12: number; utj12: number; batalPpn: number; batalLain: number; bulanPpn: { n: number; rata: number }; bulanLain: { n: number; rata: number };
  basis: { utj: number; akad: number; penerimaanM: number }; skenario: { nama: string; hilang: number; utj: number; akad: number; penerimaanM: number }[] }

/** Bila promo PPN DTP (kode berawalan "PPN") tidak ada lagi. Porsi UTJ ber-PPN diukur dari 12 bulan terakhir. Skenario: (1) hilang 25% dari porsinya, (2) kembali ke rata-rata UTJ bulan-bulan tanpa PPN DTP (dari data), (3) semua UTJ ber-PPN DTP hilang. Ketiganya asumsi, bukan ramalan. */
export function skenarioTanpaPpn(txns: Txn[], akhirData: string, proyeksi: { utj: number; akad: number }[], netPriceMiliar: number): SkenarioPpn {
  const mulai = addMonths(akhirData, -11);
  const r12 = txns.filter((t) => t.utj >= mulai && t.utj <= akhirData);
  const ppn = (t: Txn) => daftarPromo(t).some((x) => x.startsWith("PPN"));
  const utjPpn = r12.filter(ppn).length;
  const bulanPpn = new Set(txns.filter(ppn).map((t) => t.utj));
  const semuaBulan = [...new Set(txns.map((t) => t.utj))].sort();
  const cacah = (b: string) => txns.filter((t) => t.utj === b).length;
  const dalam = semuaBulan.filter((b) => bulanPpn.has(b)), luar = semuaBulan.filter((b) => !bulanPpn.has(b));
  const rata = (bs: string[]) => (bs.length ? +(sum(bs.map(cacah)) / bs.length).toFixed(1) : 0);
  const U = sum(proyeksi.map((r) => r.utj)), A = sum(proyeksi.map((r) => r.akad));
  const porsi = r12.length ? utjPpn / r12.length : 0;
  const skala = (nama: string, f: number) => ({ nama, hilang: +(1 - f).toFixed(2), utj: Math.floor(U * f), akad: Math.floor(A * f), penerimaanM: +(A * f * netPriceMiliar).toFixed(1) });
  const fLaju = U > 0 && luar.length ? Math.min(1, (rata(luar) * 12) / U) : 1 - porsi * 0.5;
  const batalPpn = pct(txns.filter((t) => ppn(t) && t.batal).length, txns.filter(ppn).length), batalLain = pct(txns.filter((t) => !ppn(t) && t.batal).length, txns.filter((t) => !ppn(t)).length);
  return { adaPpn: utjPpn > 0, akhirData, porsiPpn12: pct(utjPpn, r12.length), utjPpn12: utjPpn, utj12: r12.length, batalPpn, batalLain, bulanPpn: { n: dalam.length, rata: rata(dalam) }, bulanLain: { n: luar.length, rata: rata(luar) },
    basis: { utj: Math.floor(U), akad: Math.floor(A), penerimaanM: +(A * netPriceMiliar).toFixed(1) }, skenario: [skala("Sebagian pembeli ber-PPN DTP tetap beli (hilang 25% dari porsinya)", 1 - porsi * 0.25), skala("Kembali ke laju bulan-bulan tanpa PPN DTP", fLaju), skala("Semua UTJ ber-PPN DTP hilang", 1 - porsi)] };
}

// ---------- Unit paling diminati ----------
export interface MinatTipe { tipe: string; utj: number; akad: number; batal: number; persenAkad: number; open: number; total: number; minatPerUnit: number }
export function minatUnit(txns: Txn[], units: UnitRow[] | null) {
  const g = new Map<string, Txn[]>();
  for (const t of txns) if (t.tipe) g.set(t.tipe, [...(g.get(t.tipe) ?? []), t]);
  const perTipe = [...g].map(([tipe, xs]): MinatTipe => {
    const us = (units ?? []).filter((u) => u.tipe === tipe);
    const open = us.filter((u) => u.status.toUpperCase() === "OPEN").length;
    const akad = xs.filter((t) => t.akad).length;
    return { tipe, utj: xs.length, akad, batal: xs.filter((t) => t.batal).length, persenAkad: pct(akad, xs.length), open, total: us.length, minatPerUnit: us.length ? +(xs.length / us.length).toFixed(2) : 0 };
  }).sort((a, b) => b.utj - a.utj);
  const u = new Map<string, { n: number; tipe: string; akad: number }>();
  for (const t of txns) if (t.unit) { const e = u.get(t.unit) ?? { n: 0, tipe: t.tipe ?? "", akad: 0 }; e.n++; if (t.akad) e.akad++; u.set(t.unit, e); }
  const unitTop = [...u].map(([unit, e]) => ({ unit, tipe: e.tipe, peminat: e.n, akad: e.akad })).filter((x) => x.peminat >= 2).sort((a, b) => b.peminat - a.peminat).slice(0, 8);
  return { perTipe, unitTop };
}

// ---------- Rekomendasi order bangun ----------
export const LEAD_ORDER_BANGUN_BULAN = 6; // asumsi lama dari order bangun sampai unit siap dijual
export interface BarisOrder { tipe: string; porsi: number; kebutuhan: number; open: number; kurang: number; belum: number; bangun: number }
export function rekomendasiOrderBangun(txns: Txn[], akhirData: string, utj12: number, batalPersen: number, units: UnitRow[] | null, stokHabisBulan: number | null) {
  if (!units) return null;
  const mulai = addMonths(akhirData, -11);
  const r12 = txns.filter((t) => t.utj >= mulai && t.tipe);
  const porsi = new Map<string, number>();
  for (const t of r12) porsi.set(t.tipe!, (porsi.get(t.tipe!) ?? 0) + 1);
  const tipeSemua = new Set([...porsi.keys(), ...units.map((u) => u.tipe)]);
  const baris: BarisOrder[] = [...tipeSemua].map((tipe) => {
    const p = r12.length ? (porsi.get(tipe) ?? 0) / r12.length : 0;
    const open = units.filter((u) => u.tipe === tipe && u.status.toUpperCase() === "OPEN").length, belum = units.filter((u) => u.tipe === tipe && u.status.toUpperCase() === "CLOSE").length;
    const kebutuhan = Math.round(utj12 * p * (1 - batalPersen / 100));
    const kurang = Math.max(0, kebutuhan - open);
    return { tipe, porsi: +(p * 100).toFixed(1), kebutuhan, open, kurang, belum, bangun: Math.min(kurang, belum) };
  }).filter((b) => b.porsi > 0 || b.open > 0 || b.belum > 0).sort((a, b) => b.kurang - a.kurang || b.kebutuhan - a.kebutuhan);
  const totalBangun = sum(baris.map((b) => b.bangun));
  const mulaiBulan = stokHabisBulan === null ? null : Math.max(0, stokHabisBulan - LEAD_ORDER_BANGUN_BULAN);
  return { baris, totalBangun, kurangTanpaLahan: sum(baris.map((b) => b.kurang - b.bangun)), stokHabisBulan, mulaiBulan, leadBulan: LEAD_ORDER_BANGUN_BULAN };
}

// ---------- Daya beli dan sinyal pasar ----------
/** Inflasi di Excel berupa pecahan (0,0242), dari sumber web berupa persen (2,42): samakan ke persen. */
const inflasiPersen = (v: number) => (Math.abs(v) <= 0.2 ? +(v * 100).toFixed(2) : v);
const terakhirAda = (macro: MacroRow[], k: keyof MacroRow) => { for (let i = macro.length - 1; i >= 0; i--) if (typeof macro[i][k] === "number") return { i, v: macro[i][k] as number, bulan: macro[i].bulan }; return null; };
const tahunLalu = (macro: MacroRow[], k: keyof MacroRow, bulan: string) => macro.find((m) => m.bulan === addMonths(bulan, -12))?.[k] as number | null | undefined;

export function dayaBeli(macro: MacroRow[] | null, hargaBersihMiliar: number) {
  if (!macro?.length) return null;
  const sda = terakhirAda(macro, "umkSda"), sby = terakhirAda(macro, "umkSby");
  const acuan = sda ?? sby;
  const infl = terakhirAda(macro, "inflasi"), bi = terakhirAda(macro, "birate"), ihpr = terakhirAda(macro, "ihpr");
  const tumbuh = (x: { v: number; bulan: string } | null, k: keyof MacroRow) => { if (!x) return null; const lalu = tahunLalu(macro, k, x.bulan); return typeof lalu === "number" && lalu > 0 ? +(((x.v - lalu) / lalu) * 100).toFixed(1) : null; };
  const pernikahan = terakhirAda(macro, "nikah"), lahir = terakhirAda(macro, "lahir");
  const gUmk = tumbuh(acuan, sda ? "umkSda" : "umkSby");
  const gIhpr = tumbuh(ihpr, "ihpr");
  // Rasio harga rumah terhadap upah: berapa tahun upah minimum untuk membeli satu rumah (makin besar = makin berat)
  const tahunUpah = acuan ? +((hargaBersihMiliar * 1e9) / (acuan.v * 12)).toFixed(1) : null;
  const proyUmk = acuan && gUmk !== null ? Math.round(acuan.v * (1 + gUmk / 100)) : null;
  const proyHarga = gIhpr !== null ? +(hargaBersihMiliar * (1 + gIhpr / 100)).toFixed(2) : hargaBersihMiliar;
  const tahunUpahDepan = proyUmk && proyUmk > 0 ? +((proyHarga * 1e9) / (proyUmk * 12)).toFixed(1) : null;
  const nilai = [infl ? inflasiPersen(infl.v) : null, bi ? bi.v : null];
  const tekanan = (nilai[0] !== null && nilai[0] > 3.5 ? 1 : 0) + (nilai[1] !== null && nilai[1] >= 6 ? 1 : 0) + (gUmk !== null && gUmk < (nilai[0] ?? 0) ? 1 : 0);
  const status = tekanan >= 2 ? "Tertekan" : tekanan === 1 ? "Waspada" : "Cukup sehat";
  return { acuan: acuan ? { nama: sda ? "UMK Sidoarjo" : "UMK Surabaya", nilai: acuan.v, bulan: acuan.bulan } : null, umkSby: sby?.v ?? null, umkSda: sda?.v ?? null, umrJatim: terakhirAda(macro, "umrJatim")?.v ?? null,
    pertumbuhanUmk: gUmk, inflasi: infl ? { nilai: inflasiPersen(infl.v), bulan: infl.bulan } : null, biRate: bi ? { nilai: bi.v, bulan: bi.bulan } : null, ihpr: ihpr ? { nilai: ihpr.v, bulan: ihpr.bulan, tumbuh: gIhpr } : null,
    pernikahan: pernikahan?.v ?? null, kelahiran: lahir?.v ?? null, tahunUpah, tahunUpahDepan, proyeksiUmk: proyUmk, proyeksiHarga: proyHarga, status };
}

export interface Sinyal { judul: string; arah: "menekan" | "mendukung" | "netral"; keterangan: string }
/** Sinyal pasar dari data ekonomi yang ada (bukan berita): perubahan BI Rate, inflasi, IHSG dan emas beberapa bulan terakhir. */
export function sinyalPasar(macro: MacroRow[] | null): Sinyal[] {
  if (!macro?.length) return [];
  const out: Sinyal[] = [];
  const delta = (k: keyof MacroRow, n: number) => { const a = terakhirAda(macro, k); if (!a) return null; const b = [...macro.slice(0, a.i + 1)].reverse().filter((m) => typeof m[k] === "number")[n]; return b ? { ke: a.v, dari: b[k] as number, bulan: a.bulan } : null; };
  const bi = delta("birate", 3);
  if (bi && Math.abs(bi.ke - bi.dari) >= 0.25) out.push(bi.ke > bi.dari ? { judul: "BI Rate naik", arah: "menekan", keterangan: `Dari ${bi.dari} ke ${bi.ke} dalam 3 data terakhir. Suku bunga naik biasanya membuat cicilan KPR lebih berat.` } : { judul: "BI Rate turun", arah: "mendukung", keterangan: `Dari ${bi.dari} ke ${bi.ke} dalam 3 data terakhir. Suku bunga turun biasanya meringankan cicilan KPR.` });
  else if (bi) out.push({ judul: "BI Rate stabil", arah: "netral", keterangan: `Tetap sekitar ${bi.ke}.` });
  const infRaw = delta("inflasi", 3);
  const inf = infRaw ? { ...infRaw, ke: inflasiPersen(infRaw.ke), dari: inflasiPersen(infRaw.dari) } : null;
  if (inf && Math.abs(inf.ke - inf.dari) >= 0.5) out.push(inf.ke > inf.dari ? { judul: "Inflasi meningkat", arah: "menekan", keterangan: `Dari ${inf.dari}% ke ${inf.ke}%. Harga kebutuhan naik menggerus kemampuan menyisihkan uang muka.` } : { judul: "Inflasi menurun", arah: "mendukung", keterangan: `Dari ${inf.dari}% ke ${inf.ke}%.` });
  const ih = delta("ihsg", 3);
  if (ih && ih.dari > 0) { const g = ((ih.ke - ih.dari) / ih.dari) * 100; if (Math.abs(g) >= 5) out.push(g < 0 ? { judul: "IHSG turun", arah: "menekan", keterangan: `Turun ${Math.abs(g).toFixed(1)}% dalam 3 data terakhir; sentimen investor melemah.` } : { judul: "IHSG naik", arah: "mendukung", keterangan: `Naik ${g.toFixed(1)}% dalam 3 data terakhir; sentimen membaik.` }); }
  const em = delta("emas", 3);
  if (em && em.dari > 0) { const g = ((em.ke - em.dari) / em.dari) * 100; if (Math.abs(g) >= 5) out.push({ judul: g > 0 ? "Harga emas naik" : "Harga emas turun", arah: "netral", keterangan: `${g > 0 ? "Naik" : "Turun"} ${Math.abs(g).toFixed(1)}%; emas bersaing dengan properti sebagai tempat menyimpan uang.` }); }
  return out;
}
