import type { Txn } from "./forecast";
import { cards } from "./insights";

const rp = (n: number) => `Rp ${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} miliar`;

/** Harga bersih rata-rata dan porsi nilai per tipe (hanya akad yang punya net price). */
export function priceByType(t: Txn[]) {
  const m = new Map<string, { n: number; sum: number }>();
  for (const x of t) if (x.akad && x.tipe && x.netPrice) { const e = m.get(x.tipe) ?? { n: 0, sum: 0 }; e.n++; e.sum += x.netPrice; m.set(x.tipe, e); }
  const total = [...m.values()].reduce((a, e) => a + e.sum, 0);
  return [...m].map(([tipe, e]) => ({ tipe, akad: e.n, rata: e.sum / e.n, porsi: total ? Math.round((e.sum / total) * 100) : 0 })).sort((a, b) => b.akad - a.akad);
}
export const avgNetPrice = (t: Txn[]) => {
  const v = t.filter((x) => x.akad && x.netPrice).map((x) => x.netPrice!);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export interface Ringkas { utj: number; akad: number; penerimaanM: number; lo: number; hi: number }

/** Kalimat ringkasan dari angka (cadangan deterministik bila narasi Claude tidak tersedia). Tidak membuat angka baru. */
export function ringkasanTeks(r: Ringkas, k: ReturnType<typeof cards>, last12: { utj: number; akad: number }) {
  const batalPct = k.funnel.utj ? Math.round((k.funnel.batal / k.funnel.utj) * 100) : 0;
  return [
    `Dalam 12 bulan ke depan, proyeksi dasar memperkirakan sekitar ${r.utj.toFixed(0)} UTJ dan ${r.akad.toFixed(0)} akad, dengan penerimaan sekitar Rp ${r.penerimaanM.toFixed(1)} miliar. Sebagai pembanding, 12 bulan terakhir mencatat ${last12.utj} UTJ dan ${last12.akad} akad.`,
    `Penjualan per bulan sangat berfluktuasi, jadi satu angka tidak cukup: rentang UTJ bulanan yang masuk akal terlihat pada grafik dan tabel.`,
    `Dari seluruh UTJ yang pernah tercatat, ${batalPct}% berakhir batal. Proses bank dan pembatalan adalah faktor yang paling terukur memengaruhi jumlah akad.`,
  ];
}
export { rp };

// ---------- Ringkasan manajemen detail dan rekomendasi (deterministik; semua angka dari mesin hitung) ----------
import type { marketingInsights } from "./marketing";
import { stockByType } from "./stock";

const nf = (n: number, d = 0) => n.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const sg = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + nf(Math.abs(n));

export interface RingkasInput {
  jenis: string; periodeProyeksi: string; akhirData: string;
  tot: { utj: number; akad: number; pen: number; lo: number; hi: number };
  l12: { utj: number; akad: number };
  bt: { utjMae13: number; utjMae13Ma12: number; akadMaeTotal3: number; akadMaeMa12: number; origins: number };
  k: ReturnType<typeof cards>;
  stok: { open: number; belumDibangun: number; total: number; perTipe: { tipe: string; n: number }[]; belumDibangunPerTipe: { tipe: string; n: number }[]; habis: number | null; kurang: number | null } | null;
  mk: ReturnType<typeof marketingInsights> | null;
  makro: { indikator: string; korelasi: number | null; terakhir: string | null; nilaiTerakhir: number | null }[] | null;
  trendBerubah: boolean;
}
export interface Rekomendasi { prioritas: "Tinggi" | "Sedang" | "Rendah"; tindakan: string; alasan: string }

export function rekomendasiDari(i: RingkasInput): Rekomendasi[] {
  const r: Rekomendasi[] = [];
  const { k, stok, mk } = i;
  if (stok && stok.kurang && stok.kurang > 0) {
    const laku = new Map(k.byType.map((t) => [t.tipe, t.akad]));
    const kandidat = stockByType(stok).filter((t) => t.belum > 0).sort((a, b) => (laku.get(b.tipe) ?? 0) - (laku.get(a.tipe) ?? 0)).slice(0, 3);
    r.push({ prioritas: "Tinggi", tindakan: `Rencanakan order bangun sedikitnya ${nf(stok.kurang)} unit dari unit berstatus Close${kandidat.length ? `, dengan prioritas tipe ${kandidat.map((t) => `${t.tipe} (${nf(t.belum)} unit belum dibangun, ${nf(laku.get(t.tipe) ?? 0)} akad historis)`).join(", ")}` : ""}.`, alasan: `Stok Open ${nf(stok.open)} unit habis di bulan ke-${stok.habis} pada laju proyeksi (UTJ dikurangi batal).` });
  }
  const batalPct = k.funnel.utj ? Math.round((k.funnel.batal / k.funnel.utj) * 100) : 0;
  if (batalPct >= 25) {
    const alasan = k.alasan.rinci[0];
    r.push({ prioritas: "Tinggi", tindakan: `Turunkan pembatalan${alasan ? `, mulai dari penyebab terbanyak yang tercatat (${alasan.alasan.toLowerCase()}, ${nf(alasan.jml)} kasus)` : ""}: saring kelayakan bank dan kelengkapan berkas sebelum UTJ.`, alasan: `${batalPct}% UTJ berakhir batal (${nf(k.funnel.batal)} dari ${nf(k.funnel.utj)}).` });
  }
  const bank = k.bank.filter((b) => b.berkas >= 10);
  if (bank.length >= 2) {
    const terbaik = [...bank].sort((a, b) => b.approve - a.approve)[0], terburuk = [...bank].sort((a, b) => a.approve - b.approve)[0];
    if (terbaik.approve - terburuk.approve >= 15) r.push({ prioritas: "Sedang", tindakan: `Arahkan lebih banyak berkas ke bank dengan persetujuan lebih tinggi (${terbaik.bank} ${terbaik.approve}%) dan evaluasi pengajuan ke ${terburuk.bank} (${terburuk.approve}%).`, alasan: `Selisih tingkat persetujuan antarbank ${nf(terbaik.approve - terburuk.approve)} poin pada bank dengan sedikitnya 10 berkas.` });
  }
  if (mk) for (const f of mk.findings.slice(0, 3)) r.push({ prioritas: f.prioritas, tindakan: f.tindakan, alasan: f.temuan });
  if (i.trendBerubah) r.push({ prioritas: "Sedang", tindakan: "Pantau bulanan apakah arah penjualan benar-benar berubah; garis tren berjauhan dari proyeksi utama.", alasan: "Garis tren regresi linear berbeda lebih dari 25% dari proyeksi exponential smoothing." });
  const urut = { Tinggi: 0, Sedang: 1, Rendah: 2 } as const;
  return r.sort((a, b) => urut[a.prioritas] - urut[b.prioritas]).slice(0, 7);
}

export function ringkasanDetail(i: RingkasInput): { judul: string; butir: string[] }[] {
  const { k, tot, l12, bt, stok, mk, makro } = i;
  const f = k.funnel, pf = (x: number) => (f.utj ? Math.round((x / f.utj) * 100) : 0);
  const dUtj = l12.utj ? Math.round(((tot.utj - l12.utj) / l12.utj) * 100) : 0, dAkad = l12.akad ? Math.round(((tot.akad - l12.akad) / l12.akad) * 100) : 0;
  const out: { judul: string; butir: string[] }[] = [];
  out.push({ judul: "Hasil utama proyeksi", butir: [
    `Proyeksi dasar ${i.periodeProyeksi}: UTJ ${nf(tot.utj)} unit (kisaran 10–90%: ${nf(tot.lo)}–${nf(tot.hi)}), akad ${nf(tot.akad)} unit, dan penerimaan sekitar Rp ${nf(tot.pen, 1)} miliar.`,
    `Dibanding 12 bulan terakhir (UTJ ${nf(l12.utj)}, akad ${nf(l12.akad)}), proyeksi UTJ ${sg(dUtj)}% dan akad ${sg(dAkad)}%.`,
    `Metode UTJ: exponential smoothing. Pada uji mundur ${nf(bt.origins)} titik, galat rata-rata 1–3 bulan ${nf(bt.utjMae13, 1)} unit per bulan (rata-rata 12 bulan: ${nf(bt.utjMae13Ma12, 1)}). Akad dihitung dari pipeline UTJ: galat total 3 bulan ${nf(bt.akadMaeTotal3, 1)} unit (rata-rata 12 bulan: ${nf(bt.akadMaeMa12, 1)}).`,
    "UTJ dan akad dibulatkan ke bawah per bulan karena merupakan cacah unit; jumlah 12 bulan bisa lebih kecil daripada jumlah angka mentah.",
  ] });
  out.push({ judul: "Kinerja penjualan", butir: [
    `Dari ${nf(f.utj)} UTJ yang pernah tercatat: ${nf(f.spr)} (${pf(f.spr)}%) sampai SPR & PPJB, ${nf(f.akad)} (${pf(f.akad)}%) akad, ${nf(f.cair)} pencairan, dan ${nf(f.batal)} (${pf(f.batal)}%) batal.`,
    k.byType.length ? `Tipe dengan UTJ terbanyak: ${k.byType.slice(0, 3).map((t) => `${t.tipe} (${nf(t.utj)} UTJ, ${nf(t.akad)} akad)`).join(", ")}.` : "",
    k.byAgent.length ? `Kanal dengan UTJ terbanyak: ${k.byAgent.slice(0, 3).map((a) => `${a.agent} (${nf(a.utj)} UTJ, konversi ${a.konversi}%)`).join(", ")}.` : "",
    k.bank.length ? `Proses bank: ${k.bank.slice(0, 3).map((b) => `${b.bank} ${nf(b.berkas)} berkas dengan ${b.approve}% disetujui`).join("; ")}.` : "",
    k.alasan.rinci.length ? `Alasan batal tercatat untuk ${nf(k.alasan.tercatat)} dari ${nf(k.alasan.total)} kasus; terbanyak ${k.alasan.rinci[0].alasan.toLowerCase()} (${nf(k.alasan.rinci[0].jml)}).` : "",
  ].filter(Boolean) });
  if (stok) out.push({ judul: "Stok dan kapasitas penjualan", butir: [
    `Stok tersedia dijual (status Open) ${nf(stok.open)} unit dari ${nf(stok.total)} unit; ${nf(stok.belumDibangun)} unit berstatus Close (belum dibangun) baru bisa dijual setelah dibangun.`,
    stok.habis !== null && stok.kurang ? `Dengan pemakaian unit bersih (UTJ dikurangi batal), stok Open habis di bulan ke-${stok.habis} dan kurang sekitar ${nf(stok.kurang)} unit dalam 12 bulan; proyeksi di atas mengasumsikan unit tersedia.` : "Stok Open cukup untuk seluruh 12 bulan proyeksi.",
  ] });
  if (mk) out.push({ judul: "Marketing", butir: [
    `Periode ${mk.stats.periode}: biaya event Rp ${nf(mk.stats.biayaJuta, 1)} juta, ${nf(mk.stats.leads)} leads, dan ${nf(mk.stats.utj)} UTJ; sekitar Rp ${mk.stats.biayaPerLeadRibu === null ? "-" : nf(mk.stats.biayaPerLeadRibu, 1)} ribu per lead dan Rp ${mk.stats.biayaPerUtjJuta === null ? "-" : nf(mk.stats.biayaPerUtjJuta, 1)} juta per UTJ.`,
    `${nf(mk.stats.persenLeadsTanpaStatus, 1)}% leads belum punya status, sehingga efektivitas sumber leads belum bisa dinilai penuh.`,
    mk.findings.length ? `Temuan utama: ${mk.findings.slice(0, 3).map((x) => x.judul.toLowerCase()).join("; ")}.` : "",
  ].filter(Boolean) });
  if (makro) out.push({ judul: "Kondisi ekonomi", butir: [
    `Indikator terakhir: ${makro.map((m) => `${m.indikator} ${m.nilaiTerakhir === null ? "-" : nf(m.nilaiTerakhir, 2)}${m.terakhir ? ` (${m.terakhir})` : ""}`).join("; ")}.`,
    `Korelasi bulanan dengan UTJ lemah (${makro.map((m) => `${m.indikator.split(" ")[0]} ${m.korelasi === null ? "-" : nf(m.korelasi, 2)}`).join("; ")}), sehingga indikator ini hanya konteks dan tidak menggerakkan proyeksi.`,
  ] });
  out.push({ judul: "Risiko dan keterbatasan", butir: [
    "Penjualan bulanan sangat berfluktuasi; satu angka tidak menjamin hasil, jadi baca kisaran proyeksi.",
    "Penerimaan dihitung dari akad × harga bersih rata-rata, belum memodelkan jadwal termin.",
    "Data marketing baru tersedia sejak Okt 2025 dan alasan batal baru terisi sebagian; kesimpulan dari data itu bersifat hipotesis.",
    i.trendBerubah ? "Garis tren berjauhan dari proyeksi utama: arah penjualan mungkin berubah." : "",
  ].filter(Boolean) });
  return out;
}
