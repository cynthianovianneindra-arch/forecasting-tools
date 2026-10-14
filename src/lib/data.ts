import { loadMonthly, reconstructTxns } from "./demo";
import { forecast } from "./forecast";
import { NET_PRICE_MILIAR } from "./whatif";

export function getData() {
  const monthly = loadMonthly();
  const txns = reconstructTxns(monthly);
  const start = monthly[0].bulan, end = monthly[monthly.length - 1].bulan;
  const f = forecast(txns, start, end);
  const open = txns.filter((t) => !t.akad && !t.batal).length;
  return { monthly, f, end, open, netPrice: NET_PRICE_MILIAR };
}
export { f1, labelBulan, labelPanjang } from "./format";
