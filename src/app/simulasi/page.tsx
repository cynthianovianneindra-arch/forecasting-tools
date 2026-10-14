import { Nav, badge } from "@/components/Nav";
import { Simulasi } from "@/components/Simulasi";
import { getData } from "@/lib/data";
import { referensiDari } from "@/lib/referensi";
import { parseMetode, METODE_NAMA } from "@/lib/forecast";
import { MetodeSelect } from "@/components/Metode";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ metode?: string }> }) {
  const metode = parseMetode((await searchParams).metode);
  const d = await getData("kalender", {}, metode);
  const r = referensiDari(d);
  return (<><Nav active="/simulasi" updated="Skenario" /><main className="wrap"><p>{badge(d.source)}</p>
    <form method="get" className="card" style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap" }}><MetodeSelect metode={metode} terbaik={d.f.banding.terbaik} /><button className="btn" type="submit">Terapkan</button><span className="muted" style={{ fontSize: 12 }}>Proyeksi dasar memakai {METODE_NAMA[metode]}.</span></form>
    <Simulasi rows={d.f.rows} netPrice={r.netPriceMiliar} acuan={r.ref} stokOpen={d.stok?.open} belumDibangunPerTipe={d.stok?.belumDibangunPerTipe ?? []} korelasiEkonomi={r.korelasi} /></main></>);
}
