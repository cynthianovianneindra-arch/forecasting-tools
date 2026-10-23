import { ambilBerita, analisaDampak, ringkasDampak, type Arah } from "@/lib/berita";

const bulanId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (t: string | null) => { if (!t) return ""; const [y, m, d] = t.split("-"); return `${+d} ${bulanId[+m - 1] ?? m} ${y}`; };

/** Berita properti terbaru (Bisnis.com dan CNN Indonesia): judul dan tautan ke sumber asli. Dimuat terpisah (Suspense) supaya halaman tidak menunggu situs berita. */
const KELAS: Record<Arah, string> = { mendukung: "ok", menekan: "neg", netral: "" };
const NAMA: Record<Arah, string> = { mendukung: "Mendukung", menekan: "Menekan", netral: "Netral" };

export async function BeritaProperti({ porsiPpn = null, biRate = null }: { porsiPpn?: number | null; biRate?: number | null }) {
  const { items: mentah, galat } = await ambilBerita();
  const items = mentah.map((b) => ({ ...b, dampak: analisaDampak(b.judul) }));
  const ringkas = ringkasDampak(items);
  // Kaitan dengan data sendiri: topik yang paling relevan bagi Shaistanaya City
  const kait: Record<string, string> = {
    Pajak: porsiPpn !== null ? `${porsiPpn}% UTJ 12 bulan terakhir memakai promo PPN DTP, jadi berita pajak sangat relevan (lihat skenario di Marketing).` : "",
    "Suku bunga": biRate !== null ? `BI Rate di data saat ini ${biRate}%.` : "",
  };
  return (
    <div className="card"><h2>Berita properti terbaru</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Judul dari Bisnis.com dan CNN Indonesia; klik untuk membaca di situs aslinya. Arah dan sasaran pengaruh diperkirakan dari kata kunci judul (bukan dari isi berita), jadi anggap sebagai hipotesis dan cocokkan dengan data penjualan.</p>
      {items.length > 0 && <div style={{ background: "#F1F2F3", borderRadius: 14, padding: "10px 14px", marginBottom: 6, fontSize: 13 }}>
        <b>Arah umum:</b> dari {items.length} berita, {ringkas.jumlah.mendukung} cenderung mendukung penjualan, {ringkas.jumlah.menekan} menekan, {ringkas.jumlah.netral} netral{ringkas.tanpaDampak ? `, ${ringkas.tanpaDampak} tidak terkait langsung` : ""}.
        {ringkas.perTopik.length > 0 && <div style={{ marginTop: 4 }}><b>Topik yang disentuh:</b> {ringkas.perTopik.slice(0, 4).map((t) => `${t.topik} (${t.n}${t.arah === "netral" ? "" : t.arah === "mendukung" ? ", mendukung" : ", menekan"})`).join("; ")}.</div>}
        {ringkas.perTopik.filter((t) => kait[t.topik]).map((t) => <div key={t.topik} className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t.topik}: {kait[t.topik]}</div>)}
      </div>}
      {items.length === 0
        ? <p className="muted">Berita belum bisa diambil{galat.length ? ` (${galat.join("; ")})` : ""}.</p>
        : items.map((b) => (
          <div key={b.url} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid #DEDDDB", alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="tgt-badge" style={{ flex: "none", minWidth: 96, textAlign: "center" }}>{b.sumber}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{b.judul}</a>
              <div className="muted" style={{ fontSize: 12 }}>{tgl(b.tanggal)}{b.topik.length ? ` · ${b.topik.join(", ")}` : ""}</div>
              {b.dampak.map((d) => <div key={d.topik} style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 8, alignItems: "baseline" }}>
                <span className={"tgt-badge " + KELAS[d.arah]} style={{ flex: "none", fontSize: 11 }}>{NAMA[d.arah]}</span>
                <span><b>Berpengaruh ke:</b> {d.ke}. {d.alasan}</span></div>)}</div>
          </div>))}
      {items.length > 0 && galat.length > 0 && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Sebagian sumber gagal diambil: {galat.join("; ")}.</p>}
    </div>
  );
}
