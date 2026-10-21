import { existsSync } from "node:fs";
import path from "node:path";
import { loadMonthly, reconstructTxns } from "./demo";
import { forecast, monthlySeries, Txn, Metode } from "./forecast";
import { latestDataset, listMacroLive, listMacroManual, listTarget, LiveRowDb, MacroManualDb, storeConfigured } from "./store";
import { mergeMacro } from "./macroLive";
import { filterMarketing, marketingInsights } from "./marketing";
import { driveConfigured, fetchFromDrive } from "./drive";
import { importPenjualan, ImportReport } from "./importExcel";
import { applyFilter, cards, Filter, options, rentangPeriode } from "./insights";
import { stockSummary, stockoutMonth, stockShortfall } from "./stock";
import { macroContext, utjMonthMap } from "./macro";
import { NET_PRICE_MILIAR } from "./whatif";

export const EXCEL_PATH = path.join(process.cwd(), "data", "FORECASTING_UPDATE.xlsx");

export async function getData(mode: "kalender" | "excel" = "kalender", filter: Filter = {}, metode: Metode = "ets") {
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
  const start0 = monthly[0].bulan, end0 = monthly[monthly.length - 1].bulan;
  // Periode ikut memengaruhi proyeksi: deret dibatasi ke [dari, sampai] dan proyeksi 12 bulan dihitung setelah bulan akhir rentang.
  const rp = rentangPeriode(filter);
  const start = rp.dari && rp.dari > start0 ? rp.dari : start0;
  const end = rp.sampai && rp.sampai < end0 ? rp.sampai : end0;
  const periodeAktif = start <= end && (start !== start0 || end !== end0)
    ? { start, end, n: monthlySeries([], "utj", start, end).months.length } : null;
  const [fs, fe] = periodeAktif ? [start, end] : [start0, end0];
  const ft = applyFilter(txns, filter, true);
  if (ft.length !== txns.length || periodeAktif) {
    const u = monthlySeries(ft, "utj", fs, fe), a = monthlySeries(ft, "akad", fs, fe);
    monthly = u.months.map((b, i) => ({ bulan: b, utj: u.values[i], akad: a.values[i] }));
  }
  const f = forecast(ft, fs, fe, 12, metode);
  const open = ft.filter((t) => !t.akad && !t.batal).length;
  const kartu = source === "demo" ? null : cards(applyFilter(txns, filter, false));
  const filtered = ft.length !== txns.length;
  const sampaiAwal = !periodeAktif || fe >= end0; // stok adalah kondisi terkini: hanya relevan bila proyeksi berawal dari bulan data terakhir
  const txPeriode = applyFilter(txns, filter, false);
  const mkData = report?.marketing ? filterMarketing(report.marketing, filter) : null;
  const mk = mkData && mkData.leads.length ? marketingInsights(mkData, txPeriode) : null;
  const stok = report?.units && sampaiAwal ? stockSummary(report.units.filter((u) => (!filter.cluster || u.cluster === filter.cluster) && (!filter.tahap || u.tahap === filter.tahap) && (!filter.tipe || u.tipe === filter.tipe))) : null;
  const stokHabis = stok ? stockoutMonth(f.rows.map((x) => x.utj), stok.open, 0, f.rows.map((x) => x.batal)) : null;
  const stokKurang = stok ? stockShortfall(f.rows.map((x) => x.utj), stok.open, f.rows.map((x) => x.batal)) : null;
  let live: LiveRowDb[] = [];
  try { live = await listMacroLive(); } catch { live = []; }
  let targets: { bulan: string; utj: number; akad: number }[] = [];
  try { targets = await listTarget(); } catch { targets = []; }
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
  return { targets, monthly, f, end, open, netPrice: NET_PRICE_MILIAR, source, report, driveInfo, driveError, uploadInfo, storeError, opts, kartu, filtered, nTxn: ft.length, txns, marketing: report?.marketing ?? null, stok, stokHabis, stokKurang, periodeAktif, mk, mkAda: !!report?.marketing, makro, units: report?.units ?? null, macroRows: macroGabung, liveStatus, manualMacro: manual.slice(0, 10) };
}
export { f1, labelBulan, labelPanjang } from "./format";
