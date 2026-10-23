import { it, expect } from "vitest";
import { parseBerita, gabungBerita, topikJudul, SUMBER_BERITA, ambilBerita } from "./berita";

const [bisnis, cnn] = SUMBER_BERITA;
const HTML_BISNIS = `<html><body>
<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","url":"https://ekonomi.bisnis.com/read/20261020/47/1900001/kpr-subsidi-flpp-ditambah","name":"KPR Subsidi FLPP Ditambah untuk Tahun Depan"}]}</script>
<a href="https://ekonomi.bisnis.com/read/20261022/47/1900002/harga-rumah-naik"><img src="x.jpg"></a>
<h2><a href="https://ekonomi.bisnis.com/read/20261022/47/1900002/harga-rumah-naik"><span>Harga Rumah Tapak Naik 5 Persen, Pengembang Tahan Diskon</span></a></h2>
<a href="/read/20261021/47/1900003/bi-rate">BI Rate Turun, Cicilan KPR Diprediksi Lebih Ringan</a>
<a href="https://ekonomi.bisnis.com/read/20261021/47/1900004/pendek">Pendek</a>
<a href="https://ekonomi.bisnis.com/properti">Properti</a>
<a href="https://iklan.example.com/read/20261022/1/1/spam">Iklan palsu yang cukup panjang untuk lolos filter panjang</a>
</body></html>`;
const HTML_CNN = `<a href="https://www.cnnindonesia.com/ekonomi/20261023101500-92-1100001/pemerintah-siapkan-insentif-ppn-rumah"><h2>Pemerintah Siapkan Insentif PPN Rumah untuk Pembeli Pertama</h2></a>
<a href="https://www.cnnindonesia.com/tag/properti">Properti</a>
<a href="https://www.cnnindonesia.com/ekonomi/20261022090000-92-1100000/harga-tanah-naik">Harga Tanah di Sidoarjo Naik, Developer Cari Lahan Baru</a>`;

it("parseBerita membaca JSON-LD dan tautan artikel, menyaring yang bukan artikel", () => {
  const b = parseBerita(HTML_BISNIS, bisnis);
  expect(b.map((x) => x.judul)).toEqual([
    "Harga Rumah Tapak Naik 5 Persen, Pengembang Tahan Diskon",
    "BI Rate Turun, Cicilan KPR Diprediksi Lebih Ringan",
    "KPR Subsidi FLPP Ditambah untuk Tahun Depan",
  ]);
  expect(b[0]).toMatchObject({ sumber: "Bisnis.com", tanggal: "2026-10-22", url: "https://ekonomi.bisnis.com/read/20261022/47/1900002/harga-rumah-naik" });
  expect(b[2].tanggal).toBe("2026-10-20");
});

it("parseBerita CNN: tanggal dari alamat", () => {
  const b = parseBerita(HTML_CNN, cnn);
  expect(b).toHaveLength(2);
  expect(b[0]).toMatchObject({ tanggal: "2026-10-23", sumber: "CNN Indonesia" });
  expect(b[0].topik).toContain("Pajak");
});

it("topikJudul mengenali kata kunci", () => {
  expect(topikJudul("Suku bunga turun, KPR makin murah")).toEqual(["KPR", "Suku bunga"]);
  expect(topikJudul("Cuaca cerah hari ini di Surabaya")).toEqual([]);
});

it("gabungBerita urut terbaru dan membuang judul kembar", () => {
  const a = parseBerita(HTML_BISNIS, bisnis), c = parseBerita(HTML_CNN, cnn);
  const g = gabungBerita([a, [...c, { ...a[0], sumber: "CNN Indonesia" }]], 4);
  expect(g[0].tanggal).toBe("2026-10-23");
  expect(new Set(g.map((x) => x.judul)).size).toBe(g.length);
  expect(g).toHaveLength(4);
});

it("ambilBerita: gagal sebagian tetap menampilkan yang berhasil, semua gagal memberi pesan galat", async () => {
  const ok = (async (u: string) => (String(u).includes("bisnis") ? new Response(HTML_BISNIS) : new Response("nope", { status: 403 }))) as unknown as typeof fetch;
  const r = await ambilBerita(ok, 1_000_000_000_000);
  expect(r.items.length).toBe(3);
  expect(r.galat[0]).toContain("CNN Indonesia: HTTP 403");
  const mati = (async () => { throw new Error("ENOTFOUND"); }) as unknown as typeof fetch;
  const r2 = await ambilBerita(mati, 1_000_000_000_000 + 40 * 60 * 1000); // cache 30 menit sudah lewat, hasil lama masih dipakai
  expect(r2.items.length).toBe(3);
  expect(r2.galat).toHaveLength(2);
});
