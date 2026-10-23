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
  expect(r.galat.some((g) => g.includes("CNN Indonesia") && g.includes("HTTP 403"))).toBe(true);
  const mati = (async () => { throw new Error("ENOTFOUND"); }) as unknown as typeof fetch;
  const r2 = await ambilBerita(mati, 1_000_000_000_000 + 40 * 60 * 1000); // cache 30 menit sudah lewat, hasil lama masih dipakai
  expect(r2.items.length).toBe(3);
  expect(r2.galat.length).toBeGreaterThan(0);
});

import { analisaDampak, ringkasDampak } from "./berita";

it("analisaDampak: arah bergantung pada topik", () => {
  expect(analisaDampak("BI Rate Turun 25 Bps, Cicilan KPR Makin Ringan")[0]).toMatchObject({ topik: "Suku bunga", arah: "mendukung" });
  expect(analisaDampak("Suku Bunga Acuan Naik, Pengembang Waswas")[0]).toMatchObject({ topik: "Suku bunga", arah: "menekan" });
  expect(analisaDampak("Insentif PPN DTP Rumah Diperpanjang hingga Akhir Tahun")[0]).toMatchObject({ topik: "Pajak", arah: "mendukung" });
  expect(analisaDampak("PPN DTP Rumah Berakhir Desember, Harga Naik")[0]).toMatchObject({ topik: "Pajak", arah: "menekan" });
  expect(analisaDampak("Kuota FLPP Dipangkas, Rumah Subsidi Seret")[0]).toMatchObject({ topik: "Subsidi", arah: "menekan" });
  expect(analisaDampak("Harga Rumah Tapak Naik 5 Persen")[0]).toMatchObject({ topik: "Harga", arah: "netral" });
  expect(analisaDampak("Cuaca cerah hari ini di Surabaya")).toEqual([]);
});

it("ringkasDampak menghitung arah utama dan topik terbanyak", () => {
  const d = ["BI Rate Turun, KPR Makin Ringan", "Suku Bunga Naik Lagi", "PPN DTP Diperpanjang", "Cuaca cerah di Surabaya"].map((j) => ({ dampak: analisaDampak(j) }));
  const r = ringkasDampak(d);
  expect(r.jumlah).toEqual({ mendukung: 2, menekan: 1, netral: 0 });
  expect(r.tanpaDampak).toBe(1);
  expect(r.perTopik[0].topik).toBe("Suku bunga");
});

it("analisaDampak: berita bunga tidak dihitung dua kali sebagai KPR, dan pengaruh pasar netral disembunyikan", () => {
  const a = analisaDampak("BI Rate Turun, Cicilan KPR Diprediksi Lebih Ringan Tahun Depan");
  expect(a.map((x) => x.topik)).toEqual(["Suku bunga"]);
  const b = analisaDampak("Kuota FLPP Dipangkas, Penjualan Rumah Subsidi Makin Seret");
  expect(b.map((x) => x.topik)).toEqual(["Subsidi"]);
});

import { kategoriBerita, HALAMAN_BERITA } from "./berita";

it("kategoriBerita mengenali Jawa Timur, instrumen ekonomi, daya beli, pajak, UMR, dan keputusan pemerintah", () => {
  expect(kategoriBerita("BI Rate Ditahan 5,75 Persen, Rupiah Menguat")).toContain("Instrumen ekonomi");
  expect(kategoriBerita("Daya Beli Kelas Menengah Melemah, PHK Meningkat")).toContain("Daya beli");
  expect(kategoriBerita("Insentif PPN DTP Rumah Diperpanjang")).toContain("Pajak properti");
  expect(kategoriBerita("UMK Sidoarjo 2027 Naik Jadi Rp5,4 Juta")).toContain("UMR dan upah");
  expect(kategoriBerita("Pemerintah Luncurkan Program 3 Juta Rumah untuk Pekerja")).toContain("Keputusan pemerintah");
  expect(kategoriBerita("Menteri Resmikan Jembatan Baru di Jawa Tengah")).toEqual([]);
  expect(kategoriBerita("Harga Rumah di Surabaya Naik")).toEqual(["Jawa Timur"]); // tanpa aktor pemerintah bukan 'keputusan pemerintah'
});

it("analisaDampak untuk kategori baru", () => {
  expect(analisaDampak("UMK Sidoarjo 2027 Naik 6,5 Persen")[0]).toMatchObject({ topik: "UMR dan upah", arah: "mendukung" });
  expect(analisaDampak("PHK Meningkat, Daya Beli Masyarakat Melemah")[0]).toMatchObject({ topik: "Daya beli", arah: "menekan" });
  expect(analisaDampak("Inflasi Oktober Terkendali di Level 2,4 Persen")[0]).toMatchObject({ topik: "Inflasi", arah: "mendukung" });
  expect(analisaDampak("IHSG Anjlok 2 Persen, Rupiah Melemah")[0]).toMatchObject({ topik: "IHSG", arah: "menekan" });
  expect(analisaDampak("Pemerintah Luncurkan Program 3 Juta Rumah")[0]).toMatchObject({ topik: "Keputusan pemerintah", arah: "mendukung" });
});

it("halaman umum Berita Jatim disaring ke berita properti, dan halaman opsional yang gagal tidak dilaporkan", async () => {
  const umum = `<a href="https://beritajatim.com/ekonomi/harga-rumah-subsidi-di-sidoarjo-naik-pengembang-minta-kuota-tambahan/">Harga Rumah Subsidi di Sidoarjo Naik, Pengembang Minta Kuota Tambahan</a><span>23 Oktober 2026</span>
    <a href="https://beritajatim.com/olahraga/persebaya-menang-telak-atas-tamunya-di-gelora-bung-tomo-malam-ini/">Persebaya Menang Telak atas Tamunya di Gelora Bung Tomo Malam Ini</a>`;
  const f = (async (u: string) => (String(u) === "https://beritajatim.com/" ? new Response(umum) : String(u).includes("/tag/properti") ? new Response("x", { status: 404 }) : new Response("x", { status: 500 }))) as unknown as typeof fetch;
  const r = await ambilBerita(f, 2_000_000_000_000);
  expect(r.items.map((b) => b.judul)).toEqual(["Harga Rumah Subsidi di Sidoarjo Naik, Pengembang Minta Kuota Tambahan"]);
  expect(r.items[0]).toMatchObject({ sumber: "Berita Jatim", tanggal: "2026-10-23" });
  expect(r.items[0].kategori).toContain("Jawa Timur");
  expect(r.galat.some((g) => g.includes("Berita Jatim") && (g.includes("tag/properti") || g.includes("/ekonomi")))).toBe(false);
  expect(r.galat.some((g) => g.includes("HTTP 500"))).toBe(true);
  expect(HALAMAN_BERITA.some((h) => h.url.includes("jawapos.com/properti"))).toBe(true);
});

it("parseBerita Jawa Pos: alamat bernomor, tanggal dari teks di dekat tautan", () => {
  const html = `<div><a href="/properti/015123456/pasar-hunian-surabaya-barat-masih-diminati-meski-bunga-kpr-naik"><h3>Pasar Hunian Surabaya Barat Masih Diminati Meski Bunga KPR Naik</h3></a><time datetime="2026-10-22T09:00:00+07:00">22 Okt 2026</time></div>
    <a href="/properti">Properti</a><a href="/olahraga/015999999/liga-1-persebaya">Liga 1 Persebaya Kalahkan Arema di Kandang Sendiri Malam Ini</a>`;
  const b = parseBerita(html, SUMBER_BERITA[3]);
  expect(b.map((x) => x.judul)).toContain("Pasar Hunian Surabaya Barat Masih Diminati Meski Bunga KPR Naik");
  const h = b.find((x) => x.judul.startsWith("Pasar Hunian"))!;
  expect(h).toMatchObject({ sumber: "Jawa Pos", tanggal: "2026-10-22", url: "https://www.jawapos.com/properti/015123456/pasar-hunian-surabaya-barat-masih-diminati-meski-bunga-kpr-naik" });
  expect(h.kategori).toContain("Jawa Timur");
});

it("cariTanggal membaca datetime dan tanggal Indonesia", async () => {
  const { cariTanggal } = await import("./berita");
  expect(cariTanggal('<time datetime="2026-10-22T09:00:00">x</time>')).toBe("2026-10-22");
  expect(cariTanggal("Rabu, 5 Agustus 2026 pukul 10.00")).toBe("2026-08-05");
  expect(cariTanggal("tanpa tanggal")).toBeNull();
});
