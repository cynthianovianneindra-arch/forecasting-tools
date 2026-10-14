import Link from "next/link";
const ic = {
  "/": <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  "/simulasi": <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
  "/laporan": <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4M9.5 13h5M9.5 16.5h5" /></>,
  "/data": <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
} as Record<string, React.ReactNode>;
const items = [["/", "Dashboard"], ["/simulasi", "Simulasi"], ["/laporan", "Laporan PDF"], ["/data", "Data & Integrasi"]];
export function Nav({ active, updated }: { active: string; updated: string }) {
  const nama = items.find(([h]) => h === active)?.[1] ?? "Dashboard";
  return (
    <>
      <input type="checkbox" id="navtoggle" className="navtoggle" aria-label="Sembunyikan atau tampilkan menu" />
      <aside className="side" aria-label="Menu utama">
        <div className="brandcard">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo Shaistanaya City" />
          <div><b>Shaistanaya City</b><small>Forecast Penjualan</small></div>
        </div>
        <nav>{items.map(([h, l]) => <Link key={h} href={h} className={"navitem" + (h === active ? " navon" : "")}><svg viewBox="0 0 24 24" aria-hidden="true">{ic[h]}</svg><span>{l}</span></Link>)}</nav>
        <span className="sidegap" />
        <div className="sidefoot">PT Neo Pudji Jaya</div>
      </aside>
      <div className="topbar">
        <div className="topleft">
          <label htmlFor="navtoggle" className="togglebtn" title="Sembunyikan atau tampilkan menu">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M9.5 4.5v15" /></svg>
          </label>
          <span className="crumb"><svg viewBox="0 0 24 24" aria-hidden="true">{ic[active] ?? ic["/"]}</svg>{nama}</span>
        </div>
        <span className="pill">{updated}</span>
      </div>
    </>
  );
}
export const DEMO_BADGE = <span className="warn">Data demo: direkonstruksi dari hitungan bulanan (fixture), bukan transaksi asli</span>;
export const badge = (source: "upload" | "excel" | "drive" | "demo") => (source === "demo" ? DEMO_BADGE : <span className="ok">{source === "upload" ? "Data dari unggahan dashboard" : source === "drive" ? "Data dari Google Drive" : "Data dari data/FORECASTING_UPDATE.xlsx"}</span>);
