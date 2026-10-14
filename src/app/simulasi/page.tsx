import { Nav, badge } from "@/components/Nav";
import { Simulasi } from "@/components/Simulasi";
import { stockByType } from "@/lib/stock";
import { getData } from "@/lib/data";
export const dynamic = "force-dynamic";
export default async function Page() {
  const d = await getData();
  return (<><Nav active="/simulasi" updated="Skenario" /><main className="wrap"><p>{badge(d.source)}</p><Simulasi rows={d.f.rows} netPrice={d.netPrice} stok={d.stok?.open} belumDibangun={d.stok?.belumDibangun} kekurangan={d.stokKurang} perTipe={d.stok ? stockByType(d.stok) : undefined} /></main></>);
}
