import Link from "next/link";
import { after } from "next/server";
import { sesiSaatIni } from "@/lib/auth";
import { segarkanBilaPerlu } from "@/lib/sinkronExcel";
const ic = {
  "/": <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
  "/simulasi": <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  "/pasar": <><path d="M3.5 4v16.5H20M7 16l4-5 3 3 5-7" /></>,
  "/marketing": <><path d="M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6" /></>,
  "/bank": <><path d="M3.5 9.5L12 4l8.5 5.5M5.5 10.5v6.5M10 10.5v6.5M14 10.5v6.5M18.5 10.5v6.5M3.5 19.5h17" /></>,
  "/produk": <><path d="M4 11l8-6.5L20 11v8.5H4zM10 19.5v-5h4v5" /></>,
  "/penjualan": <><path d="M5 19.5V13M10 19.5V8M15 19.5v-9M20 19.5v-12" /></>,
  "/laporan": <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4M9.5 13h5M9.5 16.5h5" /></>,
  "/data": <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  "/pengguna": <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 5.2a3 3 0 0 1 0 5.6M17.5 14.3c2 .6 3.5 2.3 3.5 4.7" /></>,
  "/akun": <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></>,
} as Record<string, React.ReactNode>;
const dasar = [["/", "Dashboard"], ["/pasar", "Pasar & Ekonomi"], ["/marketing", "Marketing & Leads"], ["/bank", "Proses Bank"], ["/produk", "Produk & Stok"], ["/penjualan", "Penjualan"], ["/simulasi", "Simulasi"], ["/laporan", "Laporan PDF"]];
const NAMA_HALAMAN: Record<string, string> = { "/akun": "Akun saya", "/pengguna": "Pengguna", "/data": "Data (cadangan)" };
export async function Nav({ active, updated }: { active: string; updated: string }) {
  const sesi = await sesiSaatIni();
  const items = sesi?.rl === "admin" ? [...dasar, ["/pengguna", "Pengguna"]] : dasar;
  if (sesi) after(() => segarkanBilaPerlu()); // data Excel di OneDrive diperbarui otomatis di latar belakang bila sudah basi
  const nama = items.find(([h]) => h === active)?.[1] ?? NAMA_HALAMAN[active] ?? "Dashboard";
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
        {sesi && (
          <div className="sideuser">
            <Link href="/akun" className="who" title="Akun saya"><b>{sesi.nm}</b><small>{sesi.rl === "admin" ? "Admin" : "Pengguna"} · {sesi.em}</small></Link>
            <form method="post" action="/api/auth/logout"><button type="submit" className="keluar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H10M14.5 8l4 4-4 4M18.5 12H9.5" /></svg>Log Out</button></form>
          </div>)}
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
