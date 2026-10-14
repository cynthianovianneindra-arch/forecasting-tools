import { Nav, badge } from "@/components/Nav";
import { Dashboard } from "@/components/Dashboard";
import { getData } from "@/lib/data";
export default async function Page() {
  const d = await getData();
  return (<><Nav active="/" updated="Sumber: fixtures/monthly_utj_akad.csv" /><main className="wrap"><p>{badge(d.source)}</p><Dashboard monthly={d.monthly} rows={d.f.rows} netPrice={d.netPrice} open={d.open} divergent={d.f.trendDivergent} /></main></>);
}
