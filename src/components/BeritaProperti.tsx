import { ambilBerita } from "@/lib/berita";

const bulanId = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const tgl = (t: string | null) => { if (!t) return ""; const [y, m, d] = t.split("-"); return `${+d} ${bulanId[+m - 1] ?? m} ${y}`; };

/** Berita properti terbaru (Bisnis.com dan CNN Indonesia): judul dan tautan ke sumber asli. Dimuat terpisah (Suspense) supaya halaman tidak menunggu situs berita. */
export async function BeritaProperti() {
  const { items, galat } = await ambilBerita();
  return (
    <div className="card"><h2>Berita properti terbaru</h2>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Judul dari Bisnis.com dan CNN Indonesia; klik untuk membaca di situs aslinya. Label topik dikenali dari kata kunci judul, bukan penilaian dampak.</p>
      {items.length === 0
        ? <p className="muted">Berita belum bisa diambil{galat.length ? ` (${galat.join("; ")})` : ""}.</p>
        : items.map((b) => (
          <div key={b.url} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid #DEDDDB", alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="tgt-badge" style={{ flex: "none", minWidth: 96, textAlign: "center" }}>{b.sumber}</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{b.judul}</a>
              <div className="muted" style={{ fontSize: 12 }}>{tgl(b.tanggal)}{b.topik.length ? ` · ${b.topik.join(", ")}` : ""}</div></div>
          </div>))}
      {items.length > 0 && galat.length > 0 && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Sebagian sumber gagal diambil: {galat.join("; ")}.</p>}
    </div>
  );
}
