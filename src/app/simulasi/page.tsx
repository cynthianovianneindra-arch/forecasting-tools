import { Nav, badge } from "@/components/Nav";
import { Simulasi } from "@/components/Simulasi";
import { getData } from "@/lib/data";
import { referensiDari } from "@/lib/referensi";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await getData();
  const r = referensiDari(d);
  return (<><Nav active="/simulasi" updated="Skenario" /><main className="wrap"><p>{badge(d.source)}</p>
    <Simulasi rows={d.f.rows} netPrice={r.netPriceMiliar} acuan={r.ref} stokOpen={d.stok?.open} belumDibangunPerTipe={d.stok?.belumDibangunPerTipe ?? []} korelasiEkonomi={r.korelasi} /></main></>);
}
