import { existsSync } from "node:fs";
import path from "node:path";
import { loadMonthly, reconstructTxns } from "./demo";
import { forecast, monthlySeries, Txn } from "./forecast";
import { driveConfigured, fetchFromDrive } from "./drive";
import { importPenjualan, ImportReport } from "./importExcel";
import { NET_PRICE_MILIAR } from "./whatif";

export const EXCEL_PATH = path.join(process.cwd(), "data", "FORECASTING_UPDATE.xlsx");

export async function getData(mode: "kalender" | "excel" = "kalender") {
  let txns: Txn[], monthly: { bulan: string; utj: number; akad: number }[];
  let source: "excel" | "drive" | "demo" = "demo";
  let driveInfo: { name: string; modifiedTime: string; fetchedAt: string } | null = null;
  let driveError: string | null = null;
  let report: ImportReport | null = null;
  if (driveConfigured()) {
    try {
      const f = await fetchFromDrive();
      report = await importPenjualan(f.buffer, mode);
      driveInfo = { name: f.name, modifiedTime: f.modifiedTime, fetchedAt: f.fetchedAt };
      source = "drive";
    } catch (e) { driveError = e instanceof Error ? e.message : String(e); }
  }
  if (!report && existsSync(EXCEL_PATH)) {
    report = await importPenjualan(EXCEL_PATH, mode);
    source = "excel";
  }
  if (report) {
    txns = report.txns;
    const months = txns.map((t) => t.utj).sort();
    const end = months[months.length - 1];
    const u = monthlySeries(txns, "utj", months[0], end), a = monthlySeries(txns, "akad", months[0], end);
    monthly = u.months.map((b, i) => ({ bulan: b, utj: u.values[i], akad: a.values[i] }));
  } else {
    monthly = loadMonthly();
    txns = reconstructTxns(monthly);
  }
  const start = monthly[0].bulan, end = monthly[monthly.length - 1].bulan;
  const f = forecast(txns, start, end);
  const open = txns.filter((t) => !t.akad && !t.batal).length;
  return { monthly, f, end, open, netPrice: NET_PRICE_MILIAR, source, report, driveInfo, driveError };
}
export { f1, labelBulan, labelPanjang } from "./format";
