import { existsSync } from "node:fs";
import path from "node:path";
import { loadMonthly, reconstructTxns } from "./demo";
import { forecast, monthlySeries, Txn } from "./forecast";
import { latestDataset, listMacroLive, listMacroManual, LiveRowDb, MacroManualDb, storeConfigured } from "./store";
import { mergeMacro } from "./macroLive";
import { filterMarketing, marketingInsights } from "./marketing";
import { driveConfigured, fetchFromDrive } from "./drive";
import { importPenjualan, ImportReport } from "./importExcel";
import { applyFilter, cards, Filter, options } from "./insights";
import { stockSummary, stockoutMonth, stockShortfall } from "./stock";
import { macroContext, utjMonthMap } from "./macro";
import { NET_PRICE_MILIAR } from "./whatif";

export const EXCEL_PATH = path.join(process.cwd(), "data", "FORECASTING_UPDATE.xlsx");

export async function getData(mode: "kalender" | "excel" = "kalender", filter: Filter = {}) {
  let txns: Txn[], monthly: { bulan: string; utj: number; akad: number }[];
  let source: "upload" | "excel" | "drive" | "demo" = "demo";
  let uploadInfo: { filename: string; uploaded_at: string } | null = null;
  let storeError: string | null = null;
  let driveInfo: { name: string; modifiedTime: string; fetchedAt: string } | null = null;
  let driveError: string | null = null;
  let report: ImportReport | null = null;
  if (storeConfigured()) {
    try {
      const ds = await latestDataset();
      if (ds) {
        txns = ds.txns;
        report = { units: ds.units ?? undefined, macro: ds.macro ?? undefined, marketing: ds.marketing ?? undefined, txns, rows: ds.rows, utj: ds.utj, akad: ds.akad, batal: ds.batal, warnings: ds.warnings };
        uploadInfo = { filename: ds.filename, uploaded_at: ds.uploaded_at };
        source = "upload";
      }
    } catch (e) { storeError = e instanceof Error ? e.message : String(e); }
  }
  if (!report && driveConfigured()) {
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
  const opts = options(txns);
  const start = monthly[0].bulan, end = monthly[monthly.length - 1].bulan;
  const ft = applyFilter(txns, filter, true);
  if (ft.length !== txns.length) {
    const u = monthlySeries(ft, "utj", start, end), a = monthlySeries(ft, "akad", start, end);
    monthly = u.months.map((b, i) => ({ bulan: b, utj: u.values[i], akad: a.values[i] }));
  }
  const f = forecast(ft, start, end);
  const open = ft.filter((t) => !t.akad && !t.batal).length;
  const kartu = source === "demo" ? null : cards(applyFilter(txns, filter, false));
  const filtered = ft.length !== txns.length;
  const txPeriode = applyFilter(txns, filter, false);
  const mk = report?.marketing && report.marketing.leads.length ? marketingInsights(filterMarketing(report.marketing, filter), txPeriode) : null;
  const stok = report?.units ? stockSummary(report.units.filter((u) => (!filter.cluster || u.cluster === filter.cluster) && (!filter.tahap || u.tahap === filter.tahap) && (!filter.tipe || u.tipe === filter.tipe))) : null;
  const stokHabis = stok ? stockoutMonth(f.rows.map((x) => x.utj), stok.open, 0, f.rows.map((x) => x.batal)) : null;
  const stokKurang = stok ? stockShortfall(f.rows.map((x) => x.utj), stok.open, f.rows.map((x) => x.batal)) : null;
  let live: LiveRowDb[] = [];
  try { live = await listMacroLive(); } catch { live = []; }
  let manual: MacroManualDb[] = [];
  try { manual = await listMacroManual(); } catch { manual = []; }
  // urutan prioritas: input manual > data live > Excel
  const macroGabung = report?.macro ? mergeMacro(mergeMacro(report.macro, live), manual) : null;
  const makro = macroGabung ? macroContext(macroGabung, utjMonthMap(txns)) : null;
  const liveStatus = (["ihsg", "emas", "inflasi", "birate"] as const).map((k) => {
    const rows = live.filter((x) => x.indikator === k);
    const last = rows[rows.length - 1];
    return { indikator: k, bulan: last?.bulan ?? null, nilai: last?.nilai ?? null, sumber: last?.sumber ?? null, diambil: rows.reduce((m, x) => (x.diambil > m ? x.diambil : m), "") || null };
  });
  return { monthly, f, end, open, netPrice: NET_PRICE_MILIAR, source, report, driveInfo, driveError, uploadInfo, storeError, opts, kartu, filtered, nTxn: ft.length, txns, marketing: report?.marketing ?? null, stok, stokHabis, stokKurang, mk, makro, units: report?.units ?? null, macroRows: macroGabung, liveStatus, manualMacro: manual.slice(0, 10) };
}
export { f1, labelBulan, labelPanjang } from "./format";
