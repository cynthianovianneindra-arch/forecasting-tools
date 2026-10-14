import { Nav, badge } from "@/components/Nav";
import { Simulasi } from "@/components/Simulasi";
import { getData } from "@/lib/data";
export default async function Page() {
  const d = await getData();
  return (<><Nav active="/simulasi" updated="Skenario" /><main className="wrap"><p>{badge(d.source)}</p><Simulasi rows={d.f.rows} netPrice={d.netPrice} /></main></>);
}
