import { Nav, DEMO_BADGE } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { getData } from "@/lib/data";
export default function Page() {
  const d = getData();
  return (<><Nav active="/" updated="Sumber: fixtures/monthly_utj_akad.csv" /><main className="wrap"><p>{DEMO_BADGE}</p><Dashboard monthly={d.monthly} rows={d.f.rows} netPrice={d.netPrice} open={d.open} divergent={d.f.trendDivergent} /></main></>);
}
