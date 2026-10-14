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
  /** Rentang laporan: jumlah bulan, berapa yang sudah aktual / masih perkiraan, dan berapa bulan ke depan yang dipakai untuk stok. */
  nBulan?: number; aktualBulan?: number; proyeksiBulan?: number; horizon?: number;
}
export interface Rekomendasi { prioritas: "Tinggi" | "Sedang" | "Rendah"; tindakan: string; alasan: string }

export function rekomendasiDari(i: RingkasInput): Rekomendasi[] {
  const r: Rekomendasi[] = [];
  const { k, stok, mk } = i;
  if (stok && stok.kurang && stok.kurang > 0) {
    const laku = new Map(k.byType.map((t) => [t.tipe, t.akad]));
    const kandidat = stockByType(stok).filter((t) => t.belum > 0).sort((a, b) => (laku.get(b.tipe) ?? 0) - (laku.get(a.tipe) ?? 0)).slice(0, 3);
    r.push({ prioritas: "Tinggi", tindakan: `Rencanakan **bangun minimal ${nf(stok.kurang)} unit** dari unit yang belum dibangun (Close)${kandidat.length ? `, mulai dari tipe ${kandidat.map((t) => `${t.tipe} (${nf(laku.get(t.tipe) ?? 0)} akad sejauh ini)`).join(", ")}` : ""}.`, alasan: `Stok siap jual ${nf(stok.open)} unit diperkirakan habis di bulan ke-${stok.habis}.` });
  }
  const batalPct = k.funnel.utj ? Math.round((k.funnel.batal / k.funnel.utj) * 100) : 0;
  if (batalPct >= 25) {
    const alasan = k.alasan.rinci[0];
    r.push({ prioritas: "Tinggi", tindakan: `**Kurangi pembatalan**${alasan ? `, mulai dari penyebab terbanyak (${alasan.alasan.toLowerCase()}, ${nf(alasan.jml)} kasus)` : ""}: cek kemampuan bank dan kelengkapan berkas sebelum menerima UTJ.`, alasan: `${batalPct}% UTJ berakhir batal (${nf(k.funnel.batal)} dari ${nf(k.funnel.utj)}).` });
  }
  const bank = k.bank.filter((b) => b.berkas >= 10);
  if (bank.length >= 2) {
    const terbaik = [...bank].sort((a, b) => b.approve - a.approve)[0], terburuk = [...bank].sort((a, b) => a.approve - b.approve)[0];
    if (terbaik.approve - terburuk.approve >= 15) r.push({ prioritas: "Sedang", tindakan: `Arahkan lebih banyak berkas ke bank yang lebih sering menyetujui (${terbaik.bank} ${terbaik.approve}%), dan evaluasi pengajuan ke ${terburuk.bank} (${terburuk.approve}%).`, alasan: `Persetujuan antar bank berbeda ${nf(terbaik.approve - terburuk.approve)}% (bank dengan minimal 10 berkas).` });
  }
  if (mk) for (const f of mk.findings.slice(0, 3)) r.push({ prioritas: f.prioritas, tindakan: f.tindakan, alasan: f.temuan });
  if (i.trendBerubah) r.push({ prioritas: "Sedang", tindakan: "Pantau tiap bulan apakah arah penjualan benar-benar berubah.", alasan: "Garis tren berbeda lebih dari 25% dari proyeksi utama." });
  const urut = { Tinggi: 0, Sedang: 1, Rendah: 2 } as const;
  return r.sort((a, b) => urut[a.prioritas] - urut[b.prioritas]).slice(0, 7);
}

export function ringkasanDetail(i: RingkasInput): { judul: string; butir: string[] }[] {
  const { k, tot, l12, bt, stok, mk, makro } = i;
  const f = k.funnel, pf = (x: number) => (f.utj ? Math.round((x / f.utj) * 100) : 0);
  const arah = (p: number) => (p >= 0 ? `naik ${nf(p)}%` : `turun ${nf(-p)}%`);
  const dUtj = l12.utj ? Math.round(((tot.utj - l12.utj) / l12.utj) * 100) : 0, dAkad = l12.akad ? Math.round(((tot.akad - l12.akad) / l12.akad) * 100) : 0;
  const out: { judul: string; butir: string[] }[] = [];
  const n = i.nBulan ?? 12, pj = i.proyeksiBulan ?? 12, ak = i.aktualBulan ?? 0, hz = i.horizon ?? 12;
  out.push({ judul: "Hasil dan perkiraan periode", butir: [
    `Periode ${i.periodeProyeksi}: UTJ ${nf(tot.utj)} unit${pj > 0 ? ` (kemungkinan besar antara ${nf(tot.lo)} dan ${nf(tot.hi)})` : ""}, akad ${nf(tot.akad)} unit, uang masuk sekitar Rp ${nf(tot.pen, 1)} miliar.`,
    ak > 0 && pj > 0 ? `${nf(ak)} bulan sudah berjalan (data nyata) dan ${nf(pj)} bulan masih perkiraan.` : "",
    l12.utj || l12.akad ? `Dibanding ${nf(n)} bulan terakhir (UTJ ${nf(l12.utj)}, akad ${nf(l12.akad)}): UTJ **${arah(dUtj)}**, akad **${arah(dAkad)}**.` : "",
    pj > 0 ? `Saat dicoba ke data lama, perkiraan UTJ rata-rata meleset ${nf(bt.utjMae13, 1)} unit per bulan dan perkiraan akad 3 bulan meleset ${nf(bt.akadMaeTotal3, 1)} unit.` : "",
  ].filter(Boolean) });
  out.push({ judul: "Penjualan sejauh ini", butir: [
    `Dari ${nf(f.utj)} UTJ yang tercatat pada data dasar: ${nf(f.akad)} (${pf(f.akad)}%) jadi akad, **${nf(f.batal)} (${pf(f.batal)}%) batal**, ${nf(f.cair)} sudah cair.`,
    k.byType.length ? `Tipe paling laku: ${k.byType.slice(0, 3).map((t) => `${t.tipe} (${nf(t.utj)} UTJ, ${nf(t.akad)} akad)`).join(", ")}.` : "",
    k.byAgent.length ? `Kanal terbanyak: ${k.byAgent.slice(0, 3).map((a) => `${a.agent} (${nf(a.utj)} UTJ, ${a.konversi}% jadi akad)`).join(", ")}.` : "",
    k.bank.length ? `Bank: ${k.bank.slice(0, 3).map((b) => `${b.bank} ${nf(b.berkas)} berkas, ${b.approve}% disetujui`).join("; ")}.` : "",
  ].filter(Boolean) });
  if (stok) out.push({ judul: "Stok rumah", butir: [
    `Siap dijual (Open): ${nf(stok.open)} unit dari total ${nf(stok.total)}. Belum dibangun (Close): ${nf(stok.belumDibangun)} unit.`,
    hz <= 0 ? "" : stok.habis !== null && stok.kurang ? `Stok Open diperkirakan **habis di bulan ke-${stok.habis}** dan **kurang sekitar ${nf(stok.kurang)} unit** dalam ${nf(hz)} bulan ke depan. Perlu bangun unit baru.` : `Stok Open **cukup** untuk ${nf(hz)} bulan ke depan.`,
  ].filter(Boolean) });
  if (mk) out.push({ judul: "Marketing", butir: [
    `Periode ${mk.stats.periode}: biaya event Rp ${nf(mk.stats.biayaJuta, 1)} juta, ${nf(mk.stats.leads)} leads, ${nf(mk.stats.utj)} UTJ. Rata-rata Rp ${mk.stats.biayaPerLeadRibu === null ? "-" : nf(mk.stats.biayaPerLeadRibu, 1)} ribu per lead dan Rp ${mk.stats.biayaPerUtjJuta === null ? "-" : nf(mk.stats.biayaPerUtjJuta, 1)} juta per UTJ.`,
    `**${nf(mk.stats.persenLeadsTanpaStatus, 1)}% leads belum diberi status**, jadi sumber leads yang paling efektif sulit dinilai.`,
    mk.findings.length ? `Temuan utama: ${mk.findings.slice(0, 3).map((x) => x.judul.toLowerCase()).join("; ")}.` : "",
  ].filter(Boolean) });
  if (makro) out.push({ judul: "Kondisi ekonomi", butir: [
    `Data terakhir: ${makro.map((m) => `${m.indikator} ${m.nilaiTerakhir === null ? "-" : nf(m.nilaiTerakhir, 2)}${m.terakhir ? ` (${m.terakhir})` : ""}`).join("; ")}.`,
    "Hubungannya dengan UTJ lemah, jadi hanya bahan pertimbangan dan tidak mengubah proyeksi.",
  ] });
  out.push({ judul: "Yang perlu diwaspadai", butir: [
    "Penjualan naik-turun tiap bulan, jadi lihat rentang kemungkinannya, bukan satu angka saja.",
    "Uang masuk dihitung dari akad × harga rata-rata; belum memakai jadwal pembayaran bertahap.",
    "Data marketing baru ada sejak Okt 2025 dan alasan batal baru sebagian terisi, jadi kesimpulannya masih dugaan.",
    i.trendBerubah ? "Arah penjualan mungkin berubah: garis tren berbeda cukup jauh dari proyeksi." : "",
  ].filter(Boolean) });
  return out;
}
