import { ambilBerita, analisaDampak, ringkasDampak, KATEGORI, type Arah } from "@/lib/berita";

const bulanId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (t: string | null) => { if (!t) return ""; const [y, m, d] = t.split("-"); return `${+d} ${bulanId[+m - 1] ?? m} ${y}`; };
const KELAS: Record<Arah, string> = { mendukung: "ok", menekan: "neg", netral: "" };
const NAMA: Record<Arah, string> = { mendukung: "Mendukung", menekan: "Menekan", netral: "Netral" };
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;

/** Berita terkait penjualan rumah dari Bisnis.com dan CNN Indonesia: properti, instrumen ekonomi, daya beli, pajak, isu demo, UMR, dan keputusan pemerintah. Judul dan tautan ke situs asli; dimuat terpisah (Suspense) supaya halaman tidak menunggu situs berita. */
export async function BeritaProperti({ porsiPpn = null, biRate = null, umk = null, statusDayaBeli = null, kategori }: { porsiPpn?: number | null; biRate?: number | null; umk?: number | null; statusDayaBeli?: string | null; kategori?: string }) {
  const { items: mentah, galat } = await ambilBerita();
  const semua = mentah.map((b) => ({ ...b, dampak: analisaDampak(b.judul) }));
  const hitung = new Map<string, number>();
  for (const b of semua) for (const k of b.kategori) hitung.set(k, (hitung.get(k) ?? 0) + 1);
  const pilih = kategori && hitung.has(kategori) ? kategori : null;
  const items = (pilih ? semua.filter((b) => b.kategori.includes(pilih)) : semua).slice(0, 14);
  const ringkas = ringkasDampak(items);
  // Kaitan dengan data sendiri: topik yang paling relevan bagi Shaistanaya City
  const kait: Record<string, string> = {
    Pajak: porsiPpn !== null ? `${porsiPpn}% UTJ 12 bulan terakhir memakai promo PPN DTP, jadi berita pajak sangat relevan (lihat skenario di Marketing).` : "",
    "Suku bunga": biRate !== null ? `BI Rate di data saat ini ${biRate}%.` : "",
    "UMR dan upah": umk !== null ? `UMK Sidoarjo di data saat ini ${rp(umk)} per bulan.` : "",
    "Daya beli": statusDayaBeli ? `Status daya beli di data saat ini: ${statusDayaBeli}.` : "",
  };
  const href = (k: string | null) => `/pasar${k ? `?berita=${encodeURIComponent(k)}` : ""}#berita`;
  return (
    <div className="card" id="berita"><h2>Berita yang berpengaruh ke penjualan</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Dari Bisnis.com dan CNN Indonesia: properti, instrumen ekonomi, daya beli, pajak properti, isu demo, UMR, dan keputusan pemerintah. Klik judul untuk membaca di situs aslinya. Arah dan sasaran pengaruh diperkirakan dari kata kunci judul (bukan dari isi berita), jadi anggap sebagai hipotesis dan cocokkan dengan data penjualan.</p>
      {semua.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }} aria-label="Saring berita menurut kategori">
        <a href={href(null)} className={"tgt-badge" + (pilih ? "" : " ok")} style={{ textDecoration: "none" }}>Semua ({semua.length})</a>
        {KATEGORI.filter((k) => hitung.has(k.nama)).map((k) => <a key={k.nama} href={href(k.nama)} className={"tgt-badge" + (pilih === k.nama ? " ok" : "")} style={{ textDecoration: "none" }}>{k.nama} ({hitung.get(k.nama)})</a>)}
      </div>}
      {items.length > 0 && <div style={{ background: "#F1F2F3", borderRadius: 14, padding: "10px 14px", marginBottom: 6, fontSize: 13 }}>
        <b>Arah umum:</b> dari {items.length} berita{pilih ? ` (${pilih})` : ""}, {ringkas.jumlah.mendukung} cenderung mendukung penjualan, {ringkas.jumlah.menekan} menekan, {ringkas.jumlah.netral} netral{ringkas.tanpaDampak ? `, ${ringkas.tanpaDampak} tidak terkait langsung` : ""}.
        {ringkas.perTopik.length > 0 && <div style={{ marginTop: 4 }}><b>Topik yang disentuh:</b> {ringkas.perTopik.slice(0, 5).map((t) => `${t.topik} (${t.n}${t.arah === "netral" ? "" : t.arah === "mendukung" ? ", mendukung" : ", menekan"})`).join("; ")}.</div>}
        {ringkas.perTopik.filter((t) => kait[t.topik]).map((t) => <div key={t.topik} className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.topik}: {kait[t.topik]}</div>)}
      </div>}
      {items.length === 0
        ? <p className="muted">Berita belum bisa diambil{galat.length ? ` (${galat.join("; ")})` : ""}.</p>
        : items.map((b) => (
          <div key={b.url} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid #DEDDDB", alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="tgt-badge" style={{ flex: "none", minWidth: 96, textAlign: "center" }}>{b.sumber}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{b.judul}</a>
              <div className="muted" style={{ fontSize: 12 }}>{tgl(b.tanggal)}{b.kategori.length ? ` · ${b.kategori.join(", ")}` : b.topik.length ? ` · ${b.topik.join(", ")}` : ""}</div>
              {b.dampak.map((d) => <div key={d.topik} style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className={"tgt-badge " + KELAS[d.arah]} style={{ flex: "none", fontSize: 11 }}>{NAMA[d.arah]}</span>
                <span><b>Berpengaruh ke:</b> {d.ke}. {d.alasan}</span></div>)}</div>
          </div>))}
      {items.length > 0 && galat.length > 0 && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Sebagian halaman gagal diambil: {galat.join("; ")}.</p>}
    </div>
  );
}
