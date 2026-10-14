import { Nav, DEMO_BADGE } from "@/components/Nav";
import { Simulasi } from "@/components/Simulasi";
import { getData } from "@/lib/data";
export default function Page() {
  const d = getData();
  return (<><Nav active="/simulasi" updated="Skenario" /><main className="wrap"><p>{DEMO_BADGE}</p><Simulasi rows={d.f.rows} netPrice={d.netPrice} /></main></>);
}
