import Link from "next/link";
const items = [["/", "Dashboard"], ["/simulasi", "Simulasi"], ["/laporan", "Laporan PDF"], ["/data", "Data & Integrasi"]];
export function Nav({ active, updated }: { active: string; updated: string }) {
  return (
    <header className="hdr"><div className="wrap hdrin">
      <div className="brand"><span className="logo" /><b>Forecast Penjualan</b><span className="pill">Shaistanaya City</span></div>
      <nav>{items.map(([h, l]) => <Link key={h} href={h} className={"navlink" + (h === active ? " navon" : "")}>{l}</Link>)}</nav>
      <small className="muted">{updated}</small>
    </div></header>
  );
}
export const DEMO_BADGE = <span className="warn">Data demo: direkonstruksi dari hitungan bulanan (fixture), bukan transaksi asli</span>;
