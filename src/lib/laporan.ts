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
