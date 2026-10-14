import type { Txn } from "./forecast";
import type { MarketingData } from "./importExcel";
import { avgNetPrice } from "./laporan";
import type { Referensi } from "./whatif";

const pilih = (makro: { indikator: string; nilaiTerakhir: number | null }[] | null, awalan: string) => makro?.find((m) => m.indikator.startsWith(awalan))?.nilaiTerakhir ?? null;

/** Nilai acuan simulasi dari data: harga bersih rata-rata, leads per bulan (rata-rata 6 bulan data terakhir), dan nilai terakhir indikator ekonomi. */
export function referensiDari(d: { txns: Txn[]; netPrice: number; source: string; marketing: MarketingData | null; makro: { indikator: string; nilaiTerakhir: number | null; korelasi: number | null }[] | null }) {
  const hargaRp = d.source !== "demo" ? avgNetPrice(d.txns) : null;
  const per = new Map<string, number>();
  for (const l of d.marketing?.leads ?? []) per.set(l.bulan, (per.get(l.bulan) ?? 0) + l.n);
  const bln = [...per.keys()].sort().slice(-6);
  const ref: Referensi = {
    harga: hargaRp ? Math.round(hargaRp / 1e6) : Math.round(d.netPrice * 1000),
    leadsBulanan: bln.length ? Math.round(bln.reduce((a, b) => a + per.get(b)!, 0) / bln.length) : null,
    birate: pilih(d.makro, "BI Rate"), ihsg: pilih(d.makro, "IHSG"), emas: pilih(d.makro, "Harga emas"), inflasi: pilih(d.makro, "Inflasi"),
  };
  return { ref, netPriceMiliar: hargaRp ? hargaRp / 1e9 : d.netPrice, korelasi: d.makro ? Math.max(0, ...d.makro.map((m) => Math.abs(m.korelasi ?? 0))) : null };
}
