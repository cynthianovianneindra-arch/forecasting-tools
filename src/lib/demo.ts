import { readFileSync } from "node:fs";
import path from "node:path";
import { Txn, fromIdx, ym } from "./forecast";

/** Baca fixtures/monthly_utj_akad.csv. */
export function loadMonthly(): { bulan: string; utj: number; akad: number }[] {
  const f = path.join(process.cwd(), "fixtures", "monthly_utj_akad.csv");
  return readFileSync(f, "utf8").trim().split("\n").slice(1).map((l) => {
    const [bulan, utj, akad] = l.split(",");
    return { bulan, utj: +utj, akad: +akad };
  });
}

/**
 * DATA DEMO: fixture hanya berisi hitungan bulanan, bukan transaksi. Di sini transaksi direkonstruksi
 * (akad dipasangkan FIFO ke UTJ tertua; sisa UTJ yang lebih tua dari 8 bulan dianggap batal)
 * agar mesin pipeline bisa dijalankan. Bukan data asli; ganti dengan impor Excel/Sheets.
 */
export function reconstructTxns(rows: { bulan: string; utj: number; akad: number }[]): Txn[] {
  const open: Txn[] = [];
  const all: Txn[] = [];
  for (const r of rows) {
    for (let i = 0; i < r.utj; i++) { const t: Txn = { utj: r.bulan }; open.push(t); all.push(t); }
    for (let i = 0; i < r.akad; i++) {
      const j = open.findIndex((o) => ym(o.utj) <= ym(r.bulan));
      if (j >= 0) open.splice(j, 1)[0].akad = r.bulan;
    }
    for (let j = open.length - 1; j >= 0; j--) {
      if (ym(r.bulan) - ym(open[j].utj) >= 8) open.splice(j, 1)[0].batal = r.bulan;
    }
  }
  return all;
}
export { fromIdx };
